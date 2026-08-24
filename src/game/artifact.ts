/**
 * 圣遗物系统：掉落生成、狗粮升级、合成、乘区汇总
 *  - 全员共享一套装备（5 部位）
 *  - 抽卡大量产出无属性狗粮；狗粮用完可直接代币升级
 *  - 每次升级随机倍率加成（40% 新增词条 / 60% 升级已有，随机幅度，最多 4 条）
 *  - 双圣遗物合成：80% 得双词条圣遗物 / 20% 失败两件消失
 */
import { ARTIFACT_MAIN, ECONOMY, MAIN_STAT_GROWTH, SUBSTAT_POOL, SUBSTAT_RANGE } from './config';
import { chance, pick, randRange, uid } from './rng';
import type { ArtifactInstance, ArtifactSlot, StatKey } from './types';

// 主词条等级 0 时的基础值
const MAIN_BASE: Partial<Record<StatKey, number>> = {
  hp_flat: 4000, atk_flat: 311, atk_pct: 0.07, def_pct: 0.09, er: 0.07,
  crit_rate: 0.05, crit_dmg: 0.1, dmg_bonus: 0.07,
};

export function mainStatValue(key: StatKey, level: number): number {
  const base = MAIN_BASE[key] ?? 0;
  return Math.round(base * (1 + level * MAIN_STAT_GROWTH) * 1000) / 1000;
}

/** 抽卡掉落：真圣遗物（初始 1 词条） */
export function createArtifact(slot?: ArtifactSlot): ArtifactInstance {
  const s = slot ?? pick(Object.keys(ARTIFACT_MAIN) as ArtifactSlot[]);
  return {
    uid: uid('art'),
    slot: s,
    mainKey: pick(ARTIFACT_MAIN[s]),
    substats: [{ key: pick(SUBSTAT_POOL), value: rollSubstat(pick(SUBSTAT_POOL)) }],
    level: 0,
    exp: 0,
  };
}

/** 无属性狗粮（仅经验值，无主/副词条） */
export function createFodder(exp: number): ArtifactInstance {
  return {
    uid: uid('fod'),
    slot: 'flower',
    mainKey: 'atk_flat',
    substats: [],
    level: 0,
    exp,
    fodder: true,
  };
}

function rollSubstat(key: StatKey): number {
  const [min, max] = SUBSTAT_RANGE[key];
  return randRange(min, max);
}

/** 狗粮经验值：狗粮 = 自身经验；真圣遗物 = 100 + 等级×50 */
export function fodderExp(a: ArtifactInstance): number {
  if (a.fodder) return a.exp;
  return ECONOMY.FODDER_EXP_BASE + a.level * ECONOMY.FODDER_EXP_PER_LEVEL;
}

export interface EnhanceOutcome {
  artifact: ArtifactInstance;
  changed: 'level_up' | 'stat_up' | 'new_substat';
  statKey?: StatKey;
  crit?: boolean; // 词条双倍强化
  coinsSpent: number;
  levelsGained: number;
}

/**
 * 升级 levelCount 级：每级随机倍率加成（40% 新增词条，未满 4 条时；否则升级已有词条，随机幅度）。
 * exp 由调用方先累加（狗粮模式），或直接走 coinLevels（代币模式）。
 */
export function enhanceArtifact(target: ArtifactInstance, levelCount: number, coinsPaid: number): EnhanceOutcome {
  let changed: EnhanceOutcome['changed'] = 'level_up';
  let statKey: StatKey | undefined;
  let crit: boolean | undefined;

  for (let i = 0; i < levelCount; i++) {
    const canAdd = target.substats.length < ECONOMY.ARTIFACT_SUBSTAT_CAP;
    const add = canAdd && chance(ECONOMY.SUBSTAT_ADD_CHANCE);
    if (add) {
      const key = pick(SUBSTAT_POOL.filter(k => !target.substats.some(s => s.key === k)));
      target.substats.push({ key, value: rollSubstat(key) });
      changed = 'new_substat';
      statKey = key;
    } else if (target.substats.length > 0) {
      const idx = Math.floor(Math.random() * target.substats.length);
      const roll = target.substats[idx];
      crit = chance(0.1); // 10% 双倍
      roll.value = Math.round((roll.value + rollSubstat(roll.key) * (crit ? 2 : 1)) * 1000) / 1000;
      changed = 'stat_up';
      statKey = roll.key;
    }
  }

  target.level = Math.min(ECONOMY.ARTIFACT_MAX_LEVEL, target.level + levelCount);
  return { artifact: target, changed, statKey, crit, coinsSpent: coinsPaid, levelsGained: levelCount };
}

export function expNeed(level: number): number {
  return 100 + level * 50;
}

/** 给定经验增量，预估可提升的等级数（强化前算代币用） */
export function levelsFromExp(artifact: ArtifactInstance, expGain: number): number {
  let level = artifact.level;
  let exp = artifact.exp + expGain;
  let gained = 0;
  while (level < ECONOMY.ARTIFACT_MAX_LEVEL && exp >= expNeed(level)) {
    exp -= expNeed(level);
    level += 1;
    gained += 1;
  }
  return gained;
}

/** 升级到指定等级所需代币（从当前等级起） */
export function enhanceCoinsCost(target: ArtifactInstance, toLevel: number): number {
  let cost = 0;
  for (let l = target.level; l < toLevel; l++) cost += ECONOMY.ENHANCE_COST_BASE + l * ECONOMY.ENHANCE_COST_PER_LEVEL;
  return cost;
}

/** 单件圣遗物贡献的乘区（狗粮无属性） */
export function artifactStats(a: ArtifactInstance): Partial<Record<StatKey, number>> {
  const out: Partial<Record<StatKey, number>> = {};
  if (a.fodder) return out;
  addStat(out, a.mainKey, mainStatValue(a.mainKey, a.level));
  for (const s of a.substats) addStat(out, s.key, s.value);
  return out;
}

function addStat(out: Partial<Record<StatKey, number>>, key: StatKey, value: number) {
  out[key] = (out[key] ?? 0) + value;
}

export interface SynthesizeOutcome {
  ok: boolean;                 // false = 合成失败，两件消失
  result?: ArtifactInstance;   // 成功 = 双词条圣遗物
}

/** 双圣遗物合成：80% 得双词条圣遗物，20% 失败两件同时消失 */
export function synthesize(a: ArtifactInstance, b: ArtifactInstance): SynthesizeOutcome {
  if (chance(ECONOMY.SYNTHESIZE_SUCCESS)) {
    const result = createArtifact();
    // 补足第二条词条（不重复）
    const key = pick(SUBSTAT_POOL.filter(k => !result.substats.some(s => s.key === k)));
    result.substats.push({ key, value: rollSubstat(key) });
    return { ok: true, result };
  }
  return { ok: false };
}
