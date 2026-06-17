// audio.ts — Web Audio API ベースの簡易シンセエンジン。
// 動きの大きさ (energy: 0..1) を受け取り、音程・音量・リズムを変化させる。
// モードごとに音色 (oscillator type) と音階を切り替える。
// 外部ライブラリを使わず、ブラウザ標準APIのみで動作する。

import type { MusicMode } from "./settings";

// ペンタトニックスケール (音楽的に外れにくいので展示用途に最適)
const SCALES: Record<MusicMode, number[]> = {
  ambient: [220.0, 261.6, 329.6, 392.0, 440.0, 523.3], // A minor pentatonic
  edm:     [130.8, 164.8, 196.0, 246.9, 329.6, 392.0], // 低めで太い
  piano:   [261.6, 293.7, 329.6, 392.0, 440.0, 523.3], // C major
};

const OSC_TYPES: Record<MusicMode, OscillatorType> = {
  ambient: "sine",
  edm: "sawtooth",
  piano: "triangle",
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private lastNoteAt = 0;
  private mode: MusicMode = "ambient";
  private volume = 0.6;
  private muted = false;

  async start() {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctor();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;

    // 簡易リバーブ (短いノイズインパルス)
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.2, 2.5);

    const dry = this.ctx.createGain(); dry.gain.value = 0.7;
    const wet = this.ctx.createGain(); wet.gain.value = 0.35;
    this.masterGain.connect(dry).connect(this.ctx.destination);
    this.masterGain.connect(wet).connect(this.reverb).connect(this.ctx.destination);
  }

  setMode(m: MusicMode) { this.mode = m; }
  setVolume(v: number) {
    this.volume = v;
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : v;
  }
  setMuted(m: boolean) {
    this.muted = m;
    if (this.masterGain) this.masterGain.gain.value = m ? 0 : this.volume;
  }

  // energy: 0..1 を毎フレーム渡す。閾値を超えたら音符を鳴らす (動きに応じた頻度)
  tick(energy: number) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    // 動きが大きいほど発音間隔が短くなる
    const minGap = 0.6 - Math.min(0.5, energy * 0.55);
    if (now - this.lastNoteAt < minGap) return;
    if (energy < 0.05) return;
    this.lastNoteAt = now;

    const scale = SCALES[this.mode];
    // energy が高いほど高音域寄り
    const idx = Math.min(scale.length - 1, Math.floor(energy * scale.length * 1.2));
    const freq = scale[idx];
    this.playNote(freq, 0.6 + energy * 0.6, energy);
  }

  private playNote(freq: number, dur: number, energy: number) {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = OSC_TYPES[this.mode];
    osc.frequency.value = freq;

    const peak = 0.08 + energy * 0.18; // 動きが大きいほど大きな音
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private makeImpulse(duration: number, decay: number): AudioBuffer {
    const rate = this.ctx!.sampleRate;
    const len = rate * duration;
    const buf = this.ctx!.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  dispose() {
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
