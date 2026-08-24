/**
 * 经济系统：token 喂血、按伤害结算奖励（策划案 V1.2）
 *  - 每 token 兑换 HP = 1 + 等级×0.5
 *  - 每打掉 1 HP 得 0.01 代币、0.005 经验（比率已调低）
 */
import { ECONOMY } from './config';
import type { SaveData } from './types';

/** 每 token 兑换的怪物血量（随等级提升） */
export function hpPerToken(level: number): number {
  return ECONOMY.HP_PER_TOKEN_BASE + level * ECONOMY.HP_PER_TOKEN_PER_LEVEL;
}

/** 消耗 token 增量 → 给单只怪物喂血（直接修改 save.monster.hp） */
export function consumeTokens(save: SaveData, delta: number): number {
  save.economy.tokensAccumulated += delta;
  const hp = Math.floor(delta * hpPerToken(save.level));
  save.monster.hp += hp;
  return hp;
}

/** 按实际造成的伤害结算奖励 */
export function damageRewards(level: number, damage: number): { coins: number; exp: number } {
  return {
    coins: Math.floor(damage * ECONOMY.COIN_PER_HP),
    exp: damage * ECONOMY.EXP_PER_HP,
  };
}

/** 单回合伤害上限（等级锁） */
export function damageCap(level: number): number {
  return level * ECONOMY.DAMAGE_CAP_PER_LEVEL;
}
