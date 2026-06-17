// contact.ts — 二人の手の接触判定。接触開始時のみイベントを発火する。
// 4 ペア (A左↔B左, A右↔B右, A左↔B右, A右↔B左) を監視。

import { dist, type PersonPose, type Vec2 } from "./pose";

export interface ContactEvent {
  midpoint: Vec2; // 0..1 画面比率での接触地点
  pair: string;
}

const THRESHOLD = 0.07;    // 正規化距離 (0..1) — 約 70px @ 1000px幅
const RELEASE = 0.12;      // ヒステリシス: これ以上離れたら「リリース」とみなす

type Pair = { name: string; a: keyof Pick<PersonPose, "wristL" | "wristR">; b: keyof Pick<PersonPose, "wristL" | "wristR"> };
const PAIRS: Pair[] = [
  { name: "LL", a: "wristL", b: "wristL" },
  { name: "RR", a: "wristR", b: "wristR" },
  { name: "LR", a: "wristL", b: "wristR" },
  { name: "RL", a: "wristR", b: "wristL" },
];

export class ContactDetector {
  private engaged = new Set<string>();

  /** persons は最大2人を想定。接触開始イベントの配列を返す。 */
  step(persons: PersonPose[]): ContactEvent[] {
    const events: ContactEvent[] = [];
    if (persons.length < 2) { this.engaged.clear(); return events; }
    const [A, B] = persons;
    for (const p of PAIRS) {
      const pa = A[p.a]; const pb = B[p.b];
      const d = dist(pa, pb);
      const was = this.engaged.has(p.name);
      if (!was && d < THRESHOLD) {
        this.engaged.add(p.name);
        events.push({ pair: p.name, midpoint: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 } });
      } else if (was && d > RELEASE) {
        this.engaged.delete(p.name);
      }
    }
    return events;
  }

  /** 二人の距離 (胴体中心) 0..1。1人以下なら null。 */
  static distance(persons: PersonPose[]): number | null {
    if (persons.length < 2) return null;
    return dist(persons[0].torso, persons[1].torso);
  }
}
