/**
 * 抽卡系统：分级卡池、保底、up、每日轮换（策划案 §3.5）
 */
import { CHARACTERS, charById, ECONOMY, GACHA, POOLS, weaponById, WEAPONS } from './config';
import { chance, pick, rand } from './rng';
import { createArtifact, createFodder } from './artifact';
import type { GachaState, OwnedCharacter, PoolId, PullResult, SaveData } from './types';

const SSR_CHARS = CHARACTERS.filter(c => c.rarity === 'SSR');
const SR_CHARS = CHARACTERS.filter(c => c.rarity === 'SR');
const R_CHARS = CHARACTERS.filter(c => c.rarity === 'R');

const CHARACTER_POOLS: PoolId[] = ['basic', 'advanced', 'elite', 'legendary'];

export function poolDef(pool: PoolId) {
  if (pool === 'weapon' || pool === 'newbie') return null;
  return POOLS.find(p => p.id === pool)!;
}

/** 每日轮换：过期或无效则重掷 up */
export function ensureDailyUp(gacha: GachaState, now: Date): void {
  const reset = new Date(gacha.dailyUp?.resetsAt ?? '');
  const needsRoll = !gacha.dailyUp || isNaN(reset.getTime()) || now >= reset;
  if (needsRoll) {
    const prev = gacha.dailyUp?.character;
    const next = pick(SSR_CHARS.filter(c => c.id !== prev));
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);
    gacha.dailyUp = { character: next.id, weapon: next.weaponId!, resetsAt: nextMidnight.toISOString() };
  }
}

export function newGachaState(now: Date): GachaState {
  const s: GachaState = {
    characterPity: { basic: 0, advanced: 0, elite: 0, legendary: 0, weapon: 0, newbie: 0 },
    characterGuaranteed: { basic: false, advanced: false, elite: false, legendary: false, weapon: false, newbie: false },
    weaponPity: 0,
    weaponGuaranteed: false,
    newbiePulls: 0,
    dailyUp: { character: SSR_CHARS[0].id, weapon: SSR_CHARS[0].weaponId!, resetsAt: '' },
  };
  ensureDailyUp(s, now);
  return s;
}

export interface PullOutcome {
  results: PullResult[];
  coinsSpent: number;
  ticketsUsed: { single: number; ten: number };
}

/**
 * 执行 n 连抽。扣费顺序：十连券 → 单抽券 → 代币。
 * 直接修改 save（coins/tickets/gacha/chars/weapons/artifacts）。
 */
export function pull(save: SaveData, pool: PoolId, count: number): PullOutcome {
  const out: PullOutcome = { results: [], coinsSpent: 0, ticketsUsed: { single: 0, ten: 0 } };
  const perCost = GACHA_PULL_COST(pool);

  for (let i = 0; i < count; i++) {
    // 扣费（最后一抽用单抽逻辑）
    const isTen = count === 10 && i === 0;
    if (!chargeOne(save, pool, isTen, out)) break;
    out.results.push(rollOne(save, pool));
  }
  return out;
}

function GACHA_PULL_COST(pool: PoolId): number {
  void pool;
  return 160;
}

function chargeOne(save: SaveData, pool: PoolId, isTen: boolean, out: PullOutcome): boolean {
  // 十连券只能用于 10 连第一抽
  if (isTen && save.tickets.ten > 0) {
    save.tickets.ten -= 1;
    out.ticketsUsed.ten += 1;
    return true;
  }
  if (save.tickets.single > 0) {
    save.tickets.single -= 1;
    out.ticketsUsed.single += 1;
    return true;
  }
  if (save.economy.coins >= 160) {
    save.economy.coins -= 160;
    save.economy.coinsSpent += 160;
    out.coinsSpent += 160;
    return true;
  }
  return false; // 余额不足，中断
}

function rollOne(save: SaveData, pool: PoolId): PullResult {
  save.meta.totalPulls += 1;
  const g = save.gacha;

  if (pool === 'weapon') return rollWeapon(save);
  if (pool === 'newbie') return rollNewbie(save);

  const def = poolDef(pool)!;
  const pity = g.characterPity[pool];
  g.characterPity[pool] = pity + 1;

  const atPity = pity + 1 >= def.pity;
  const r = rand();

  if (r < def.ssrRate || atPity) {
    // SSR → 角色
    g.characterPity[pool] = 0;
    const up = g.dailyUp.character;
    let charId: string;
    if (g.characterGuaranteed[pool] || chance(GACHA.UP_SHARE)) {
      charId = up;
      g.characterGuaranteed[pool] = false;
    } else {
      charId = pick(SSR_CHARS.filter(c => c.id !== up)).id;
      g.characterGuaranteed[pool] = true;
    }
    return grantCharacter(save, charId, 'SSR');
  }
  if (r < def.ssrRate + def.srRate) {
    // SR → SR 角色 或 圣遗物
    if (chance(GACHA.SR_CHAR_SHARE)) {
      const c = pick(SR_CHARS);
      return grantCharacter(save, c.id, 'SR');
    }
    // SR 非角色：真圣遗物 / 无属性狗粮
    if (chance(GACHA.SR_ARTIFACT_SHARE)) {
      return { kind: 'artifact', rarity: 'SR', artifact: createArtifact() };
    }
    return { kind: 'fodder', rarity: 'SR', artifact: createFodder(ECONOMY.SR_FODDER_EXP) };
  }
  // R → R 角色 或 圣遗物/狗粮（大量）
  if (chance(GACHA.R_CHAR_SHARE)) {
    const c = pick(R_CHARS);
    return grantCharacter(save, c.id, 'R');
  }
  if (chance(GACHA.R_ARTIFACT_SHARE)) {
    return { kind: 'artifact', rarity: 'R', artifact: createArtifact() };
  }
  return { kind: 'fodder', rarity: 'R', artifact: createFodder(ECONOMY.R_FODDER_EXP) };
}

function rollWeapon(save: SaveData): PullResult {
  const g = save.gacha;
  g.weaponPity += 1;
  const atPity = g.weaponPity >= GACHA.WEAPON_PITY;
  if (rand() < GACHA.WEAPON_SSR || atPity) {
    g.weaponPity = 0;
    let wid = g.dailyUp.weapon;
    if (!(g.weaponGuaranteed || chance(GACHA.UP_SHARE))) {
      wid = pick(Object.keys(WEAPONS).filter(w => w !== wid));
      g.weaponGuaranteed = true;
    } else {
      g.weaponGuaranteed = false;
    }
    return grantWeapon(save, wid);
  }
  // 材料
  return { kind: 'fodder', rarity: rand() < 0.3 ? 'SR' : 'R' };
}

function rollNewbie(save: SaveData): PullResult {
  const g = save.gacha;
  g.newbiePulls += 1;
  const atPity = g.newbiePulls >= GACHA.NEWBIE_PITY;
  if (rand() < GACHA.NEWBIE_SSR || atPity) {
    g.newbiePulls = 0;
    const up = g.dailyUp.character;
    const charId = chance(GACHA.UP_SHARE) ? up : pick(SSR_CHARS.filter(c => c.id !== up)).id;
    return grantCharacter(save, charId, 'SSR');
  }
  if (chance(0.4)) {
    const c = pick(SR_CHARS);
    return grantCharacter(save, c.id, 'SR');
  }
  return { kind: 'artifact', rarity: 'R', artifact: createArtifact() };
}

function grantCharacter(save: SaveData, charId: string, rarity: PullResult['rarity']): PullResult {
  const owned = save.chars.find(c => c.charId === charId);
  if (owned) {
    owned.constellation = Math.min(6, owned.constellation + 1);
    return { kind: 'character', rarity, charId, dupe: true };
  }
  const c: OwnedCharacter = { charId, constellation: 0, weaponId: null };
  save.chars.push(c);
  // 豆包娘自动入队（若队伍不满 3 人）
  if (save.order.length < 3 && !save.order.includes(charId)) save.order.push(charId);
  return { kind: 'character', rarity, charId };
}

function grantWeapon(save: SaveData, weaponId: string): PullResult {
  const owned = save.weapons.find(w => w.weaponId === weaponId);
  if (owned) {
    owned.refinement = Math.min(5, owned.refinement + 1);
    return { kind: 'weapon', rarity: 'SSR', weaponId, dupe: true };
  }
  save.weapons.push({ weaponId, refinement: 1 });
  // 已拥有对应角色则自动装备
  const info = weaponById(weaponId);
  const owner = save.chars.find(c => c.charId === info?.charId);
  if (owner && !owner.weaponId) owner.weaponId = weaponId;
  return { kind: 'weapon', rarity: 'SSR', weaponId };
}

export const charDef = charById;
