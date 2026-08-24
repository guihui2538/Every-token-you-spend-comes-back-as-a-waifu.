/** 随机工具 */
export function rand(): number { return Math.random(); }
export function chance(p: number): boolean { return Math.random() < p; }
export function randInt(n: number): number { return Math.floor(Math.random() * n); }
export function pick<T>(arr: T[]): T { return arr[randInt(arr.length)]; }

/** 加权抽样 */
export function pickWeighted<T>(items: { item: T; weight: number }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const i of items) {
    r -= i.weight;
    if (r <= 0) return i.item;
  }
  return items[items.length - 1].item;
}

/** 区间内随机一档（保留 3 位小数） */
export function randRange(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 1000) / 1000;
}

let uidSeq = 0;
export function uid(prefix: string): string {
  uidSeq += 1;
  return `${prefix}_${Date.now().toString(36)}_${uidSeq.toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}
