// audio.ts — Tone.js による音楽エンジン。
// 6 モード (Ambient / Electronic / Piano / Orchestra / Future Bass / Music) と
// 8 種類のインパクトサウンドを提供する。
// 身体の動き (energy 0..1) と二人の距離 (closeness 0..1) で BPM / Filter / Reverb / Volume が変化。

import * as Tone from "tone";
import type { MusicMode, ImpactSound } from "./settings";

const SCALES: Record<MusicMode, string[]> = {
  ambient:    ["A3", "C4", "E4", "G4", "A4", "C5", "E5"],
  electronic: ["C3", "Eb3", "G3", "Bb3", "C4", "Eb4", "G4"],
  piano:      ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5"],
  orchestra:  ["C3", "E3", "G3", "B3", "D4", "E4", "G4", "B4"],
  futurebass: ["F3", "Ab3", "C4", "Eb4", "F4", "Ab4", "C5"],
  music:      ["C4", "D4", "E4", "G4", "A4", "C5"],
};

export class AudioEngine {
  private started = false;
  private mode: MusicMode = "ambient";
  private muted = false;
  private masterVol!: Tone.Volume;
  private reverb!: Tone.Reverb;
  private filter!: Tone.Filter;
  private delay!: Tone.FeedbackDelay;

  private leadSynth!: Tone.PolySynth;
  private bass!: Tone.MonoSynth;
  private pad!: Tone.PolySynth;

  // Music モード用ループ
  private loop?: Tone.Loop;
  private noise!: Tone.NoiseSynth;
  private membrane!: Tone.MembraneSynth;
  private metal!: Tone.MetalSynth;

  private lastNoteAt = 0;
  private impactCooldown = 0;

  async start() {
    if (this.started) return;
    await Tone.start();
    this.started = true;

    this.masterVol = new Tone.Volume(-6).toDestination();
    this.reverb = new Tone.Reverb({ decay: 4, wet: 0.35 }).connect(this.masterVol);
    this.delay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.25, wet: 0.2 }).connect(this.reverb);
    this.filter = new Tone.Filter(1200, "lowpass").connect(this.delay);

    this.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.6, decay: 0.5, sustain: 0.6, release: 2 },
      volume: -14,
    }).connect(this.filter);

    this.leadSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 1.2 },
      volume: -10,
    }).connect(this.filter);

    this.bass = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      filter: { Q: 2, type: "lowpass", rolloff: -24 },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.6 },
      volume: -14,
    }).connect(this.filter);

    this.noise = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
      volume: -10,
    }).connect(this.reverb);

    this.membrane = new Tone.MembraneSynth({ volume: -6 }).connect(this.reverb);
    this.metal = new Tone.MetalSynth({ volume: -18 }).connect(this.reverb);

    Tone.getTransport().bpm.value = 96;
    Tone.getTransport().start();
  }

  setMode(m: MusicMode) {
    this.mode = m;
    this.loop?.dispose();
    this.loop = undefined;
    if (m === "music") this.startMusicLoop();
  }

  setVolume(v: number) {
    if (!this.started) return;
    this.masterVol.volume.rampTo(this.muted ? -Infinity : Tone.gainToDb(Math.max(0.0001, v)), 0.1);
  }
  setMuted(m: boolean) {
    this.muted = m;
    if (this.started) this.masterVol.mute = m;
  }

  /** energy:動きの大きさ 0..1, closeness:二人の近さ 0..1 (近いほど大) */
  tick(energy: number, closeness = 0) {
    if (!this.started || this.muted) return;

    // 距離による調和度: 近いほどフィルター開放・リバーブ抑え・ディレイ控えめ
    const cutoff = 400 + (energy * 0.6 + closeness * 0.4) * 5500;
    this.filter.frequency.rampTo(cutoff, 0.2);
    this.reverb.wet.rampTo(0.5 - closeness * 0.3, 0.5);
    this.delay.wet.rampTo(0.15 + (1 - closeness) * 0.25, 0.5);

    // BPM は energy で 80..150
    const targetBpm = 80 + energy * 70 + closeness * 8;
    Tone.getTransport().bpm.rampTo(targetBpm, 0.5);

    if (this.mode === "music") return; // music モードはループに任せる
    this.spawnNote(energy);
  }

  private spawnNote(energy: number) {
    const now = Tone.now();
    const minGap = Math.max(0.12, 0.7 - energy * 0.6);
    if (now - this.lastNoteAt < minGap || energy < 0.04) return;
    this.lastNoteAt = now;

    const scale = SCALES[this.mode];
    const idx = Math.min(scale.length - 1, Math.floor(energy * scale.length * 1.1));
    const note = scale[idx];

    switch (this.mode) {
      case "ambient":
        this.pad.triggerAttackRelease(note, "2n", now, 0.4 + energy * 0.5);
        break;
      case "electronic":
        this.leadSynth.triggerAttackRelease(note, "16n", now, 0.5 + energy * 0.5);
        if (Math.random() < 0.3) this.bass.triggerAttackRelease(scale[0], "8n", now);
        break;
      case "piano":
        this.leadSynth.triggerAttackRelease(note, "8n", now, 0.5 + energy * 0.5);
        break;
      case "orchestra":
        this.pad.triggerAttackRelease([note, scale[(idx + 2) % scale.length]], "2n", now, 0.5);
        break;
      case "futurebass":
        this.leadSynth.triggerAttackRelease([note, scale[(idx + 2) % scale.length], scale[(idx + 4) % scale.length]], "8n", now, 0.7);
        if (Math.random() < 0.5) this.bass.triggerAttackRelease(scale[0], "8n", now);
        break;
    }
  }

  private startMusicLoop() {
    if (!this.started) return;
    const scale = SCALES.music;
    let step = 0;
    this.loop = new Tone.Loop((time) => {
      const n = scale[step % scale.length];
      this.leadSynth.triggerAttackRelease(n, "8n", time);
      if (step % 4 === 0) this.bass.triggerAttackRelease("C2", "8n", time);
      if (step % 2 === 0) this.membrane.triggerAttackRelease("C1", "16n", time, 0.5);
      if (step % 8 === 3) this.noise.triggerAttackRelease("16n", time, 0.4);
      step++;
    }, "8n").start(0);
  }

  /** インパクトサウンド — 接触時に呼ぶ。連射防止 (60ms) のクールダウン付き。 */
  playImpact(kind: ImpactSound) {
    if (!this.started || this.muted) return;
    const now = Tone.now();
    if (now - this.impactCooldown < 0.06) return;
    this.impactCooldown = now;
    switch (kind) {
      case "spark":
        this.metal.triggerAttackRelease("C6", "32n", now, 0.7);
        break;
      case "explosion":
        this.noise.triggerAttackRelease("4n", now, 1);
        this.membrane.triggerAttackRelease("C1", "8n", now, 1);
        break;
      case "magic":
        this.leadSynth.triggerAttackRelease(["C5", "E5", "G5", "B5"], "4n", now, 0.8);
        break;
      case "water":
        this.noise.triggerAttackRelease("8n", now, 0.5);
        this.pad.triggerAttackRelease(["A4", "C5", "E5"], "2n", now, 0.6);
        break;
      case "cyber":
        this.leadSynth.triggerAttackRelease("C6", "16n", now, 0.9);
        this.bass.triggerAttackRelease("C2", "8n", now, 0.8);
        break;
      case "drum":
        this.membrane.triggerAttackRelease("C2", "8n", now, 1);
        break;
      case "orchestraHit":
        this.pad.triggerAttackRelease(["C3", "E3", "G3", "C4", "E4"], "2n", now, 1);
        this.membrane.triggerAttackRelease("C1", "8n", now, 0.9);
        break;
      case "edmDrop":
        this.bass.triggerAttackRelease("C1", "2n", now, 1);
        this.noise.triggerAttackRelease("4n", now, 0.7);
        this.leadSynth.triggerAttackRelease(["C4", "G4", "C5"], "4n", now, 0.9);
        break;
    }
  }

  dispose() {
    try {
      this.loop?.dispose();
      Tone.getTransport().stop();
      this.leadSynth?.dispose(); this.bass?.dispose(); this.pad?.dispose();
      this.noise?.dispose(); this.membrane?.dispose(); this.metal?.dispose();
      this.filter?.dispose(); this.delay?.dispose(); this.reverb?.dispose();
      this.masterVol?.dispose();
    } catch {}
    this.started = false;
  }
}
