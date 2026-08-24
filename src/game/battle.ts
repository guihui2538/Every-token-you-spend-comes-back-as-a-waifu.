/**
 * 战斗系统（V1.2）：3 名角色 = 小丑卡，从左到右依次施加 buff（乘区不同），顺序决定最终数值。
 * 流水线：基础攻击 → [角色技能 左→右] → 暴击折算 → 增伤 → 连击/回合机制 → 单回合伤害。
 * 怪物：单只，token 喂血；每回合打掉多少血结算多少奖励。
 */
import { charById, ECONOMY } from './config';
import { artifactStats } from './artifact';
import { damageCap } from './economy';
import type { AttackResult, DamageStep, SaveData } from './types';

/** 全员共享的一套圣遗物贡献的乘区 */
function sharedArtifactStats(save: SaveData): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = {};
  for (const slot of ['flower', 'plume', 'sands', 'goblet', 'circlet'] as const) {
    const uid = save.equipped[slot];
    const art = uid ? save.artifacts.find(a => a.uid === uid) : undefined;
    if (!art) continue;
    const s = artifactStats(art);
    for (const [k, v] of Object.entries(s)) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

/** 全队基础攻击（角色基础×命座×武器求和，再吃共享圣遗物攻击%） */
function teamBaseAtk(save: SaveData): number {
  const aura = teamAuras(save);
  const shared = sharedArtifactStats(save);
  let base = 0;
  for (const charId of save.order) {
    const def = charById(charId);
    const owned = save.chars.find(c => c.charId === charId);
    if (!owned) continue;
    const constellation = 1 + 0.12 * owned.constellation;
    const weapon = owned.weaponId ? 1 + 0.08 * (save.weapons.find(w => w.weaponId === owned.weaponId)?.refinement ?? 1) : 1;
    base += def.baseAtk * constellation * weapon;
  }
  return base * (1 + aura.atkPct + (shared.atk_pct ?? 0));
}

/** 全队光环：Llama 攻击 +5%、Gemini 增伤 +10% */
function teamAuras(save: SaveData): { atkPct: number; dmgBonus: number } {
  let atkPct = 0;
  let dmgBonus = 0;
  for (const id of save.order) {
    const def = charById(id);
    if (def.aura?.atkPct) atkPct += def.aura.atkPct;
    if (def.aura?.dmgBonus) dmgBonus += def.aura.dmgBonus;
  }
  return { atkPct, dmgBonus };
}

/** 全队暴击/增伤基础（角色基础 + 共享圣遗物 + 光环） */
function teamStats(save: SaveData): { critRate: number; critDmg: number; dmgBonus: number } {
  const aura = teamAuras(save);
  const shared = sharedArtifactStats(save);
  let critRate = 0;
  let critDmg = 0;
  let dmgBonus = aura.dmgBonus;
  for (const charId of save.order) {
    const def = charById(charId);
    critRate += def.critRate;
    critDmg += def.critDmg;
    dmgBonus += def.dmgBonus;
  }
  critRate += shared.crit_rate ?? 0;
  critDmg += shared.crit_dmg ?? 0;
  dmgBonus += shared.dmg_bonus ?? 0;
  return { critRate, critDmg, dmgBonus };
}

function comboCapFor(save: SaveData): number {
  return save.order.some(id => charById(id).special === 'combocap') ? 5 : ECONOMY.COMBO_CAP;
}

function comboMult(save: SaveData, round: number): number {
  const plus = save.order.some(id => charById(id).special === 'combo') ? 0.1 : 0;
  return Math.min(Math.pow(ECONOMY.COMBO_MULT + plus, round - 1), comboCapFor(save));
}

/** 回合机制：ramp 每回合+10%（封顶×2）、burst 每5回合×3 */
function roundMechanics(save: SaveData, round: number): number {
  let m = 1;
  for (const id of save.order) {
    const sp = charById(id).special;
    if (sp === 'ramp') m *= Math.min(1 + 0.1 * (round - 1), 2);
    if (sp === 'burst' && round % 5 === 0) m *= 3;
    if (sp === 'stutter' && Math.random() < 0.05) m *= 0; // GPT 5% 卡顿
  }
  return m;
}

/**
 * 单回合流水线：返回逐步展开的伤害步骤（供动画），最后一步 running = 未受上限约束的伤害。
 */
export function pipelineSteps(save: SaveData, round: number): DamageStep[] {
  const steps: DamageStep[] = [];
  const stats = teamStats(save);
  let value = teamBaseAtk(save);
  steps.push({ label: '基础攻击', running: value });

  // 从左到右依次施加角色 buff
  for (const charId of save.order) {
    const def = charById(charId);
    if (!def.skill) {
      if (def.aura) steps.push({ label: `${def.name} ${def.aura.atkPct ? '全队攻击+5%' : '全队增伤+10%'}`, charId, running: value });
      else if (def.special === 'combo') steps.push({ label: `${def.name} 连击+0.1/回合`, charId, running: value });
      continue;
    }
    switch (def.skill.op) {
      case 'add':
        value += def.skill.value;
        break;
      case 'mult':
        value *= def.skill.value;
        break;
      case 'crit2':
        stats.critRate = Math.min(1, stats.critRate * 2);
        break;
      case 'dmg_add':
        stats.dmgBonus += def.skill.value;
        break;
    }
    steps.push({ label: `${def.name} ${def.skill.label}`, charId, running: value });
  }

  // 暴击折算
  value *= 1 + Math.min(1, stats.critRate) * stats.critDmg;
  steps.push({ label: '暴击折算', running: value });
  // 增伤
  value *= 1 + stats.dmgBonus;
  steps.push({ label: '增伤', running: value });
  // 连击 + 回合机制
  const combo = comboMult(save, round);
  const rm = roundMechanics(save, round);
  value *= combo * rm;
  if (combo !== 1) steps.push({ label: `连击 ×${combo.toFixed(2)}`, running: value });
  if (rm !== 1) steps.push({ label: `机制 ×${rm.toFixed(2)}`, running: value });

  return steps;
}

/** 队伍 DPS（第 1 回合流水线终值，供 UI 展示） */
export function teamDps(save: SaveData): number {
  const steps = pipelineSteps(save, 1);
  return steps[steps.length - 1].running;
}

/**
 * 单回合攻击：每次调用只打一回合（combo+1），奖励按本回合实际打掉的血结算。
 */
export function attackRound(save: SaveData): AttackResult {
  const round = save.monster.combo + 1;
  const steps = pipelineSteps(save, round);
  const raw = steps[steps.length - 1].running;
  const hpBefore = save.monster.hp;
  const dealt = Math.min(raw, damageCap(save.level), hpBefore);
  steps[steps.length - 1].running = Math.floor(dealt);
  const hpAfter = hpBefore - dealt;
  return {
    round,
    steps,
    dealt: Math.floor(dealt),
    hpBefore,
    hpAfter: Math.max(0, hpAfter),
    defeated: hpAfter <= 0,
    rewards: {
      coins: Math.floor(dealt * ECONOMY.COIN_PER_HP),
      exp: dealt * ECONOMY.EXP_PER_HP,
    },
  };
}
