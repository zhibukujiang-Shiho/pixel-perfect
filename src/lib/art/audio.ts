// audio.ts — Tone.js による音響エンジン。
//
// 設計思想:
//   この作品の主役は「二人が触れ合う瞬間」。常時音楽は流さない。
//   - アンビエンス: 常にごく微弱 (約 10%) の空間音だけを鳴らす。
//   - 動作演出: 身体が動いた時にのみ、控えめな補助音を疎らに鳴らす (約 20%)。
//   - インパクト: 接触イベントの瞬間だけマスターを 100% に引き上げ、派手な効果音を鳴らす。
//
// 接触イベントを最大限に際立たせるため、常時鳴る音はあえて「音楽」として
// 認識できないレベルに抑えている。

import * as Tone from "tone";
import type { MusicMode, ImpactSound } from "./settings";

const SCALES: Record<Exclude<MusicMode, "music" | "funny">, string[]> = {
  ambient:    ["A3", "C4", "E4", "G4", "A4", "C5"],
  electronic: ["C3", "Eb3", "G3", "Bb3", "C4", "Eb4"],
  piano:      ["C4", "D4", "E4", "G4", "A4", "C5"],
  orchestra:  ["C3", "E3", "G3", "B3", "D4", "E4"],
  futurebass: ["F3", "Ab3", "C4", "Eb4", "F4", "Ab4"],
};

// 各バスのベース音量 (dB)。マスターはユーザ設定。
const AMBIENCE_BASE_DB = -22;   // 通常時 ≒ 10%
const AMBIENCE_MOVE_DB = -16;   // 動作時 ≒ 20%
const MOTION_BASE_DB   = -28;   // 動作時の補助音 (高音域は控えめ)
const IMPACT_BASE_DB   = 0;     // 接触時 = 100%

export class AudioEngine {
  private started = false;
  private mode: MusicMode = "ambient";
  private muted = false;
  private userVolume = 0.8;

  private master!: Tone.Volume;

  // 3つのバス: 常時アンビエンス / 動作補助音 / インパクト
  private ambienceBus!: Tone.Volume;
  private motionBus!: Tone.Volume;
  private impactBus!: Tone.Volume;

  private reverbAmb!: Tone.Reverb;
  private reverbImpact!: Tone.Reverb;

  // アンビエンス用 (常に鳴る低音ドローン + 微かなノイズ)
  private drone?: Tone.Oscillator;
  private droneSub?: Tone.Oscillator;
  private noiseBed?: Tone.Noise;
  private noiseFilter?: Tone.Filter;

  // 動作補助音
  private motionPad!: Tone.PolySynth;
  private motionFilter!: Tone.Filter;

  // インパクト用
  private impactSynth!: Tone.PolySynth;
  private impactBass!: Tone.MonoSynth;
  private impactNoise!: Tone.NoiseSynth;
  private impactMembrane!: Tone.MembraneSynth;
  private impactMetal!: Tone.MetalSynth;

  private lastMotionAt = 0;
  private impactCooldown = 0;
  private impactDuckTimer: number | null = null;

  async start() {
    if (this.started) return;
    await Tone.start();
    this.started = true;

    this.master = new Tone.Volume(Tone.gainToDb(this.userVolume)).toDestination();

    this.ambienceBus = new Tone.Volume(AMBIENCE_BASE_DB).connect(this.master);
    this.motionBus = new Tone.Volume(MOTION_BASE_DB).connect(this.master);
    this.impactBus = new Tone.Volume(IMPACT_BASE_DB).connect(this.master);

    this.reverbAmb = new Tone.Reverb({ decay: 8, wet: 0.7 }).connect(this.ambienceBus);
    this.reverbImpact = new Tone.Reverb({ decay: 3, wet: 0.4 }).connect(this.impactBus);

    // --- 常時アンビエンス: 低音ドローン + 5度の薄い倍音 + フィルタしたピンクノイズ ---
    this.drone = new Tone.Oscillator({ frequency: 55, type: "sine", volume: -8 }).connect(this.reverbAmb).start();
    this.droneSub = new Tone.Oscillator({ frequency: 82.4, type: "sine", volume: -16 }).connect(this.reverbAmb).start();
    this.noiseFilter = new Tone.Filter(800, "lowpass").connect(this.reverbAmb);
    this.noiseBed = new Tone.Noise({ type: "pink", volume: -22 }).connect(this.noiseFilter).start();

    // --- 動作補助音: 高音域を抑えたパッド ---
    this.motionFilter = new Tone.Filter(900, "lowpass").connect(this.motionBus);
    this.motionPad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: { attack: 0.4, decay: 0.4, sustain: 0.0, release: 1.6 },
      volume: -6,
    }).connect(this.motionFilter);

    // --- インパクト用シンセ群 ---
    this.impactSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.2, release: 1.2 },
      volume: -4,
    }).connect(this.reverbImpact);
    this.impactBass = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      filter: { Q: 2, type: "lowpass", rolloff: -24 },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0.3, release: 0.8 },
      volume: -6,
    }).connect(this.reverbImpact);
    this.impactNoise = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
      volume: -4,
    }).connect(this.reverbImpact);
    this.impactMembrane = new Tone.MembraneSynth({ volume: -2 }).connect(this.reverbImpact);
    this.impactMetal = new Tone.MetalSynth({ volume: -12 }).connect(this.reverbImpact);

    Tone.getTransport().start();
  }

  setMode(m: MusicMode) {
    this.mode = m;
  }

  setVolume(v: number) {
    this.userVolume = v;
    if (!this.started) return;
    this.master.volume.rampTo(this.muted ? -Infinity : Tone.gainToDb(Math.max(0.0001, v)), 0.1);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.started) this.master.mute = m;
  }

  /** energy: 動きの大きさ 0..1, closeness: 二人の近さ 0..1 (近いほど大)
   *  - アンビエンスの帯域・音量を緩やかにモジュレート
   *  - 動作補助音は energy が十分大きい時のみ、低頻度・低音量で鳴らす */
  tick(energy: number, closeness = 0) {
    if (!this.started || this.muted) return;

    // アンビエンス: 動き/近さで微かに膨らむだけ (常時は約10%)
    const movement = Math.min(1, energy * 0.7 + closeness * 0.3);
    const ambDb = AMBIENCE_BASE_DB + (AMBIENCE_MOVE_DB - AMBIENCE_BASE_DB) * movement;
    this.ambienceBus.volume.rampTo(ambDb, 0.4);
    if (this.noiseFilter) this.noiseFilter.frequency.rampTo(500 + movement * 1200, 0.5);
    if (this.droneSub) this.droneSub.volume.rampTo(-18 + movement * 6, 0.5);

    // 動作補助音 — 大きく動いた時だけ、まばらに
    this.spawnMotionAccent(energy);
  }

  private spawnMotionAccent(energy: number) {
    if (this.mode === "funny") return; // funny は接触に全振り
    const now = Tone.now();
    // 高い閾値 & 長いインターバルで「補助」程度に抑える
    if (energy < 0.35) return;
    const minGap = Math.max(0.8, 2.2 - energy * 1.5);
    if (now - this.lastMotionAt < minGap) return;
    if (Math.random() > 0.6) return;
    this.lastMotionAt = now;

    const scale = SCALES[this.mode === "music" ? "ambient" : this.mode] ?? SCALES.ambient;
    // 高音域を避けるため下半分から選ぶ
    const idx = Math.floor(Math.random() * Math.ceil(scale.length / 2));
    const note = scale[idx];
    this.motionPad.triggerAttackRelease(note, "2n", now, 0.25 + (energy - 0.35) * 0.4);
  }

  /** インパクトサウンド — 接触時に呼ぶ。瞬間的にマスターを 100% に引き上げる。 */
  playImpact(kind: ImpactSound) {
    if (!this.started || this.muted) return;
    const now = Tone.now();
    if (now - this.impactCooldown < 0.08) return;
    this.impactCooldown = now;

    // マスター・ダッキング: 直前のユーザ音量に関係なく一瞬 0dB(=100%) へ
    this.master.volume.cancelScheduledValues(now);
    this.master.volume.setValueAtTime(this.master.volume.value, now);
    this.master.volume.linearRampToValueAtTime(0, now + 0.02);
    // 1秒かけて元のユーザ音量へ戻す
    const targetDb = Tone.gainToDb(Math.max(0.0001, this.userVolume));
    this.master.volume.linearRampToValueAtTime(targetDb, now + 1.0);
    if (this.impactDuckTimer) window.clearTimeout(this.impactDuckTimer);
    this.impactDuckTimer = window.setTimeout(() => { this.impactDuckTimer = null; }, 1100);

    this.triggerImpactSound(kind, now);
  }

  private triggerImpactSound(kind: ImpactSound, now: number) {
    switch (kind) {
      case "spark":
        this.impactMetal.triggerAttackRelease("C6", "32n", now, 0.9);
        this.impactSynth.triggerAttackRelease(["E6", "G6"], "16n", now + 0.02, 0.7);
        break;
      case "explosion":
        this.impactNoise.triggerAttackRelease("4n", now, 1);
        this.impactMembrane.triggerAttackRelease("C1", "8n", now, 1);
        this.impactBass.triggerAttackRelease("C2", "4n", now, 1);
        break;
      case "magic":
        this.impactSynth.triggerAttackRelease(["C5", "E5", "G5", "B5", "D6"], "2n", now, 0.9);
        this.impactMetal.triggerAttackRelease("G6", "16n", now + 0.1, 0.5);
        break;
      case "water":
        this.impactNoise.triggerAttackRelease("8n", now, 0.6);
        this.impactSynth.triggerAttackRelease(["A4", "C5", "E5"], "2n", now, 0.7);
        break;
      case "cyber":
        this.impactSynth.triggerAttackRelease("C6", "16n", now, 0.95);
        this.impactBass.triggerAttackRelease("C2", "8n", now, 0.9);
        this.impactMetal.triggerAttackRelease("A5", "32n", now + 0.05, 0.5);
        break;
      case "drum":
        this.impactMembrane.triggerAttackRelease("C2", "8n", now, 1);
        this.impactNoise.triggerAttackRelease("16n", now, 0.4);
        break;
      case "orchestraHit":
        this.impactSynth.triggerAttackRelease(["C3", "E3", "G3", "C4", "E4", "G4"], "2n", now, 1);
        this.impactMembrane.triggerAttackRelease("C1", "8n", now, 0.9);
        break;
      case "edmDrop":
        this.impactBass.triggerAttackRelease("C1", "2n", now, 1);
        this.impactNoise.triggerAttackRelease("4n", now, 0.7);
        this.impactSynth.triggerAttackRelease(["C4", "G4", "C5"], "4n", now, 0.9);
        this.impactMembrane.triggerAttackRelease("C1", "8n", now + 0.25, 1);
        break;

      // ----- Funny Mode 系 -----
      case "spring": {
        // バイーン: ピッチが急上昇→急下降
        const s = new Tone.Synth({
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.005, decay: 0.5, sustain: 0, release: 0.1 },
          volume: -2,
        }).connect(this.impactBus);
        s.triggerAttackRelease("A3", 0.5, now, 0.9);
        s.frequency.setValueAtTime(120, now);
        s.frequency.exponentialRampToValueAtTime(900, now + 0.08);
        s.frequency.exponentialRampToValueAtTime(150, now + 0.45);
        setTimeout(() => s.dispose(), 800);
        break;
      }
      case "cymbal":
        this.impactMetal.triggerAttackRelease("C5", "2n", now, 1);
        this.impactNoise.triggerAttackRelease("2n", now, 0.7);
        break;
      case "cartoonHit":
        this.impactMembrane.triggerAttackRelease("C2", "16n", now, 1);
        this.impactNoise.triggerAttackRelease("16n", now, 0.8);
        this.impactSynth.triggerAttackRelease("C5", "16n", now + 0.04, 0.9);
        this.impactMetal.triggerAttackRelease("C6", "32n", now + 0.06, 0.6);
        break;
      case "boing": {
        const s = new Tone.Synth({
          oscillator: { type: "sine" },
          envelope: { attack: 0.005, decay: 0.4, sustain: 0, release: 0.1 },
          volume: -4,
        }).connect(this.impactBus);
        s.triggerAttackRelease("C4", 0.4, now, 0.9);
        s.frequency.setValueAtTime(200, now);
        s.frequency.exponentialRampToValueAtTime(700, now + 0.05);
        s.frequency.exponentialRampToValueAtTime(280, now + 0.18);
        s.frequency.exponentialRampToValueAtTime(500, now + 0.3);
        setTimeout(() => s.dispose(), 700);
        break;
      }
      case "partyHorn": {
        // パーティークラッカー: ノイズ + 上昇する音
        this.impactNoise.triggerAttackRelease("16n", now, 0.8);
        const s = new Tone.Synth({
          oscillator: { type: "square" },
          envelope: { attack: 0.005, decay: 0.35, sustain: 0, release: 0.1 },
          volume: -6,
        }).connect(this.impactBus);
        s.triggerAttackRelease("E4", 0.35, now + 0.02, 0.9);
        s.frequency.setValueAtTime(330, now + 0.02);
        s.frequency.exponentialRampToValueAtTime(880, now + 0.3);
        setTimeout(() => s.dispose(), 600);
        break;
      }
      case "fanfare": {
        // ゲームクリア風の短いファンファーレ
        const seq = [
          { n: "C5", t: 0.0,  d: "16n" },
          { n: "E5", t: 0.12, d: "16n" },
          { n: "G5", t: 0.24, d: "16n" },
          { n: "C6", t: 0.36, d: "4n" },
        ];
        for (const { n, t, d } of seq) {
          this.impactSynth.triggerAttackRelease(n, d, now + t, 0.9);
        }
        this.impactMembrane.triggerAttackRelease("C2", "8n", now, 0.8);
        break;
      }
    }
  }

  dispose() {
    try {
      if (this.impactDuckTimer) window.clearTimeout(this.impactDuckTimer);
      Tone.getTransport().stop();
      this.drone?.stop(); this.drone?.dispose();
      this.droneSub?.stop(); this.droneSub?.dispose();
      this.noiseBed?.stop(); this.noiseBed?.dispose();
      this.noiseFilter?.dispose();
      this.motionPad?.dispose(); this.motionFilter?.dispose();
      this.impactSynth?.dispose(); this.impactBass?.dispose();
      this.impactNoise?.dispose(); this.impactMembrane?.dispose(); this.impactMetal?.dispose();
      this.reverbAmb?.dispose(); this.reverbImpact?.dispose();
      this.ambienceBus?.dispose(); this.motionBus?.dispose(); this.impactBus?.dispose();
      this.master?.dispose();
    } catch {}
    this.started = false;
  }
}
