/**
 * 状态管理：默认存档、签到、升级、百分百先生、事件日志（策划案 V1.2）
 */
import { charById, ECONOMY, QUOTES } from './config';
import { newGachaState } from './gacha';
import { pick } from './rng';
import type { RecentEvent, SaveData } from './types';

export const SAVE_VERSION = 3; // V3：清除旧 monsters 字段；旧比例血量缩水 100 倍

export function defaultSave(now = new Date()): SaveData {
  const gacha = newGachaState(now);
  return {
    version: SAVE_VERSION,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    level: 1,
    exp: 0,
    economy: { tokensAccumulated: 0, coins: 200, coinsEarned: 200, coinsSpent: 0 },
    tickets: { single: 0, ten: 0 },
    monster: { hp: 0, combo: 0 },
    order: ['doubao'],
    chars: [{ charId: 'doubao', constellation: 0, weaponId: null }],
    equipped: {},
    weapons: [],
    artifacts: [],
    gacha,
    signIn: { lastDate: '', streak: 0 },
    popup: { lastDate: '' },
    meta: { slaps: 0, slapStreak: 0, apologyCoupons: 0, totalPulls: 0, totalEnhances: 0, totalBattles: 0, quoteLog: [] },
    events: [],
  };
}

/** 存档迁移：V1 的 monsters{count} → V2 的 monster{hp}（按旧怪物 HP 折算，尽量保留进度） */
export function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SaveData> & { monsters?: { count?: number; bossProgress?: number; kills?: number } };
  const s: SaveData = {
    ...base,
    ...r,
    economy: { ...base.economy, ...(r.economy ?? {}) },
    tickets: { ...base.tickets, ...(r.tickets ?? {}) },
    gacha: {
      ...base.gacha,
      ...(r.gacha ?? {}),
      characterPity: { ...base.gacha.characterPity, ...(r.gacha?.characterPity ?? {}) },
      characterGuaranteed: { ...base.gacha.characterGuaranteed, ...(r.gacha?.characterGuaranteed ?? {}) },
      dailyUp: { ...base.gacha.dailyUp, ...(r.gacha?.dailyUp ?? {}) },
    },
    signIn: { ...base.signIn, ...(r.signIn ?? {}) },
    popup: { ...base.popup, ...(r.popup ?? {}) },
    meta: { ...base.meta, ...(r.meta ?? {}) },
    events: r.events ?? [],
    order: r.order?.length ? r.order : base.order,
    chars: (r.chars ?? []).map(c => ({ charId: c.charId, constellation: c.constellation ?? 0, weaponId: c.weaponId ?? null })),
    equipped: { ...base.equipped, ...(r.equipped ?? {}) },
    weapons: r.weapons ?? [],
    artifacts: r.artifacts ?? [],
  };
  // 迁移旧版每角色独立装备 → 全员共享装备（按部位取第一件）
  if (Object.keys(s.equipped).length === 0 && (r.chars ?? []).some((c: any) => c.equipped)) {
    for (const c of (r.chars ?? []) as any[]) {
      for (const [slot, uid] of Object.entries(c.equipped ?? {})) {
        if (uid && s.equipped[slot as keyof typeof s.equipped] == null) s.equipped[slot as keyof typeof s.equipped] = uid as any;
      }
    }
  }
  // 迁移怪物：旧 count 只怪 × 旧怪 HP(等级²×1000) → 新单只血量
  if (!s.monster?.hp && (r as any).monsters?.count) {
    const oldCount = (r as any).monsters.count ?? 0;
    const level = s.level || 1;
    s.monster = { hp: oldCount * level * level * 1000, combo: 0 };
  }
  if (!s.monster) s.monster = { hp: 0, combo: 0 };
  if (s.monster.combo == null) s.monster.combo = 0;
  // V2 → V3：旧喂血比例(1+0.5×等级)积累的血量缩水 100 倍；清除已废弃的 monsters 字段
  if ((r as any).version < 3) {
    s.monster.hp = Math.floor(s.monster.hp / 100);
    delete (s as any).monsters;
  }
  // 保证初始角色在队
  if (!s.chars.some(c => c.charId === 'doubao')) s.chars.unshift(base.chars[0]);
  if (!s.order.some(id => s.chars.some(c => c.charId === id))) s.order = ['doubao'];
  s.version = SAVE_VERSION;
  return s;
}

// ===== 等级 =====
export function expNeeded(level: number): number {
  return level * ECONOMY.EXP_NEED_PER_LEVEL;
}

export function tryLevelUp(save: SaveData): number {
  let gained = 0;
  while (save.level < ECONOMY.MAX_LEVEL && save.exp >= expNeeded(save.level)) {
    save.exp -= expNeeded(save.level);
    save.level += 1;
    gained += 1;
    pushEvent(save, 'level', `等级提升至 Lv.${save.level}`, `解锁伤害上限 ${(save.level * ECONOMY.DAMAGE_CAP_PER_LEVEL).toLocaleString()}`);
  }
  return gained;
}

// ===== 签到 =====
export interface SignInResult {
  rewarded: boolean;
  streak: number;
  tickets: { single: number; ten: number };
}

export function signIn(save: SaveData, now = new Date()): SignInResult {
  const today = dateKey(now);
  if (save.signIn.lastDate === today) {
    return { rewarded: false, streak: save.signIn.streak, tickets: { ...save.tickets } };
  }
  const yesterday = dateKey(new Date(now.getTime() - 86400000));
  save.signIn.streak = save.signIn.lastDate === yesterday ? save.signIn.streak + 1 : 1;
  save.signIn.lastDate = today;
  save.tickets.single += 1;
  let ten = 0;
  if (save.signIn.streak % 7 === 0) {
    save.tickets.ten += 1;
    ten = 1;
  }
  pushEvent(save, 'signin', `连续签到 ${save.signIn.streak} 天`, ten ? '获得 1 张十连券' : '获得 1 张单抽券');
  return { rewarded: true, streak: save.signIn.streak, tickets: { single: 1, ten } };
}

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ===== 百分百先生 =====
export function pickQuote(category: keyof typeof QUOTES): string {
  return pick(QUOTES[category] ?? QUOTES.whiff);
}

export function pushQuote(save: SaveData, text: string): void {
  save.meta.quoteLog.push(text);
  if (save.meta.quoteLog.length > 10) save.meta.quoteLog.shift();
}

/** 打脸结算：预言未命中 → slaps+1；连续 5 次发道歉券 */
export function recordSlap(save: SaveData, hit: boolean): void {
  if (hit) {
    save.meta.slapStreak = 0;
    return;
  }
  save.meta.slaps += 1;
  save.meta.slapStreak += 1;
  if (save.meta.slapStreak >= 5) {
    save.meta.apologyCoupons += 1;
    save.meta.slapStreak = 0;
    pushQuote(save, QUOTES.apology[0]);
    pushEvent(save, 'slap', '百分百先生被打脸 ×5', '获得 1 张道歉券（梗图）');
  }
}

// ===== 事件日志 =====
export function pushEvent(save: SaveData, kind: RecentEvent['kind'], title: string, detail: string): void {
  save.events.unshift({ kind, title, detail, at: new Date().toISOString() });
  if (save.events.length > 20) save.events.pop();
}

export const charName = (id: string) => charById(id).name;
