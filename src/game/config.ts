/**
 * Token姬·抽卡计划 — 数值配置（V1.2）
 * 战斗：3 名角色 = 小丑卡，从左到右依次施加 buff（乘区不同），顺序决定最终数值。
 * 怪物：单只，token 按等级比例喂血，打掉多少血给多少奖励。
 */
import type { ArtifactSlot, CharacterDef, PoolId, StatKey } from './types';

export const ECONOMY = {
  // 怪物喂血：每 token = (1 + 等级×0.5) × 1%，即 0.01 + 等级×0.005 HP（缩水 100 倍，随等级回涨）
  HP_PER_TOKEN_BASE: 0.01,
  HP_PER_TOKEN_PER_LEVEL: 0.005,
  // 奖励：每打掉 1 HP 得 0.8 代币、0.5 经验（HP 缩水后按比例补偿，避免收益过低）
  COIN_PER_HP: 0.8,
  EXP_PER_HP: 0.5,
  MAX_ROUNDS: 20,
  DAMAGE_CAP_PER_LEVEL: 5000,   // 单回合伤害上限 = 等级 × 5000
  ARTIFACT_DROP_CHANCE: 0.05,   // 每次战斗 5% 掉圣遗物
  MAX_LEVEL: 100,
  EXP_NEED_PER_LEVEL: 500,      // 升级所需 = 当前等级 × 500
  TEAM_SIZE: 3,
  COMBO_MULT: 1.5,              // 连击：每回合 ×1.5
  COMBO_CAP: 3,                 // 连击封顶（Claude 提到 5）
  PULL_COST: 160,
  PULL10_COST: 1600,
  ENHANCE_COST_BASE: 50,
  ENHANCE_COST_PER_LEVEL: 20,
  WEAPON_UPGRADE_BASE: 30,
  WEAPON_UPGRADE_PER_LEVEL: 10,
  ARTIFACT_MAX_LEVEL: 20,
  ARTIFACT_SUBSTAT_CAP: 4,          // 最多 4 个副词条
  SUBSTAT_ADD_CHANCE: 0.4,          // 每次升级 40% 新增词条（未满 4 条），否则升级已有词条
  FODDER_EXP_BASE: 100,             // 真圣遗物当狗粮：100 + 等级×50
  FODDER_EXP_PER_LEVEL: 50,
  R_FODDER_EXP: 150,                // 抽卡产出的无属性狗粮经验值
  SR_FODDER_EXP: 400,
  SYNTHESIZE_SUCCESS: 0.8,          // 双圣遗物合成成功率（失败 20%，两件同时消失）
} as const;

export const GACHA = {
  UP_SHARE: 0.5,
  R_CHAR_SHARE: 0.15,
  SR_CHAR_SHARE: 0.6,
  WEAPON_SSR: 0.007,
  WEAPON_PITY: 80,
  NEWBIE_SSR: 0.06,
  NEWBIE_PITY: 20,
  NEWBIE_TOTAL: 20,
} as const;

export interface PoolDef {
  id: PoolId;
  name: string;
  unlockLevel: number;
  ssrRate: number;
  srRate: number;
  pity: number;
  desc: string;
}

export const POOLS: PoolDef[] = [
  { id: 'basic', name: '基础池', unlockLevel: 1, ssrRate: 0.006, srRate: 0.051, pity: 90, desc: 'Lv1 解锁 · SSR 0.6%' },
  { id: 'advanced', name: '进阶池', unlockLevel: 10, ssrRate: 0.012, srRate: 0.08, pity: 80, desc: 'Lv10 解锁 · SSR 1.2%' },
  { id: 'elite', name: '精英池', unlockLevel: 20, ssrRate: 0.025, srRate: 0.1, pity: 70, desc: 'Lv20 解锁 · SSR 2.5%' },
  { id: 'legendary', name: '传说池', unlockLevel: 40, ssrRate: 0.05, srRate: 0.12, pity: 60, desc: 'Lv40 解锁 · SSR 5%（封顶）' },
];

/**
 * 角色技能（skill）：从左到右流水线 buff，乘区不同 → 顺序影响最终数值。
 *  - add: 攻击 +N（加法）
 *  - mult: 当前伤害 ×N（乘法，放大前面的加法）
 *  - crit2: 暴击率 ×2（在暴击折算步生效）
 *  - dmg_add: 增伤 +N
 * special：回合/光环机制（combo 连击+ / ramp 每回合+10% / burst 每5回合×3 / combocap 连击上限×5 / stutter 5%卡顿）
 */
export const CHARACTERS: CharacterDef[] = [
  // ---- 基础池（R / SR）----
  { id: 'codeium', name: 'Codeium娘', rarity: 'R', baseAtk: 480, critRate: 0.05, critDmg: 0.5, dmgBonus: 0,
    skill: { op: 'crit2', value: 2, label: '暴击率 ×2' }, special: null, weaponId: null },
  { id: 'cursor', name: 'Cursor娘', rarity: 'R', baseAtk: 500, critRate: 0.05, critDmg: 0.5, dmgBonus: 0,
    skill: { op: 'add', value: 600, label: '攻击 +600' }, special: null, weaponId: null },
  { id: 'copilot', name: 'Copilot娘', rarity: 'R', baseAtk: 550, critRate: 0.05, critDmg: 0.5, dmgBonus: 0,
    skill: { op: 'mult', value: 1.5, label: '总伤 ×1.5' }, special: null, weaponId: null },
  { id: 'doubao', name: '豆包娘', rarity: 'SR', baseAtk: 900, critRate: 0.05, critDmg: 0.5, dmgBonus: 0,
    skill: { op: 'add', value: 300, label: '攻击 +300' }, special: null, weaponId: null },
  // ---- 进阶池（SR / SSR）----
  { id: 'wenxin', name: '文心娘', rarity: 'SR', baseAtk: 920, critRate: 0.05, critDmg: 0.5, dmgBonus: 0,
    skill: { op: 'mult', value: 1.4, label: '攻击 ×1.4' }, special: null, weaponId: null },
  { id: 'tongyi', name: '通义娘', rarity: 'SR', baseAtk: 950, critRate: 0.05, critDmg: 0.5, dmgBonus: 0,
    skill: null, special: 'combo', weaponId: null },
  { id: 'kimi', name: 'Kimi娘', rarity: 'SSR', baseAtk: 1000, critRate: 0.05, critDmg: 0.5, dmgBonus: 0,
    skill: { op: 'mult', value: 1.2, label: '总伤 ×1.2' }, special: 'ramp', weaponId: 'weapon_kimi' },
  // ---- 精英池（SSR）----
  { id: 'llama', name: 'Llama娘', rarity: 'SSR', baseAtk: 1150, critRate: 0.05, critDmg: 0.5, dmgBonus: 0,
    skill: null, special: null, aura: { atkPct: 0.05 }, weaponId: 'weapon_llama' },
  { id: 'gemini', name: 'Gemini娘', rarity: 'SSR', baseAtk: 1100, critRate: 0.05, critDmg: 0.5, dmgBonus: 0,
    skill: null, special: null, aura: { dmgBonus: 0.1 }, weaponId: 'weapon_gemini' },
  { id: 'deepseek', name: 'DeepSeek娘', rarity: 'SSR', baseAtk: 1200, critRate: 0.05, critDmg: 0.5, dmgBonus: 0,
    skill: { op: 'mult', value: 1.5, label: '暴击时总伤 ×1.5' }, special: null, weaponId: 'weapon_deepseek' },
  // ---- 传说池（SSR 5%）----
  { id: 'gpt', name: 'GPT娘', rarity: 'SSR', baseAtk: 1500, critRate: 0.05, critDmg: 0.5, dmgBonus: 0,
    skill: { op: 'mult', value: 1.8, label: '总伤 ×1.8' }, special: 'stutter', weaponId: 'weapon_gpt' },
  { id: 'o3', name: 'o3娘', rarity: 'SSR', baseAtk: 1400, critRate: 0.05, critDmg: 0.5, dmgBonus: 0,
    skill: { op: 'mult', value: 1.4, label: '总伤 ×1.4' }, special: 'burst', weaponId: 'weapon_o3' },
  { id: 'glm', name: 'GLM娘', rarity: 'SSR', baseAtk: 1450, critRate: 0.05, critDmg: 0.5, dmgBonus: 0,
    skill: { op: 'dmg_add', value: 0.4, label: '增伤 +40%' }, special: null, weaponId: 'weapon_glm' },
  { id: 'claude', name: 'Claude娘', rarity: 'SSR', baseAtk: 1600, critRate: 0.05, critDmg: 0.5, dmgBonus: 0,
    skill: { op: 'mult', value: 1.6, label: '总伤 ×1.6' }, special: 'combocap', weaponId: 'weapon_claude' },
];

export const WEAPONS: Record<string, { name: string; charId: string }> = {
  weapon_kimi: { name: '长上下文', charId: 'kimi' },
  weapon_llama: { name: '开源圣典', charId: 'llama' },
  weapon_gemini: { name: '双子棱镜', charId: 'gemini' },
  weapon_deepseek: { name: '洞察之眼', charId: 'deepseek' },
  weapon_gpt: { name: '涡轮引擎', charId: 'gpt' },
  weapon_o3: { name: '推理之环', charId: 'o3' },
  weapon_claude: { name: '羽毛笔', charId: 'claude' },
  weapon_glm: { name: '全能智核', charId: 'glm' },
};

export const charById = (id: string): CharacterDef => CHARACTERS.find(c => c.id === id)!;
export const weaponById = (id: string) => WEAPONS[id];

// ===== 圣遗物 =====
export const ARTIFACT_MAIN: Record<ArtifactSlot, StatKey[]> = {
  flower: ['hp_flat'],
  plume: ['atk_flat'],
  sands: ['atk_pct', 'def_pct', 'er'],
  goblet: ['dmg_bonus'],
  circlet: ['crit_rate', 'crit_dmg'],
};

export const ARTIFACT_SLOT_NAME: Record<ArtifactSlot, string> = {
  flower: '花', plume: '羽', sands: '沙', goblet: '杯', circlet: '头',
};

export const STAT_NAME: Record<StatKey, string> = {
  hp_flat: '生命', atk_flat: '攻击', atk_pct: '攻击%', def_pct: '防御%',
  crit_rate: '暴击率', crit_dmg: '暴伤', dmg_bonus: '增伤', er: '充能',
};

export const SUBSTAT_POOL: StatKey[] = ['atk_pct', 'def_pct', 'crit_rate', 'crit_dmg', 'dmg_bonus', 'er'];

export const SUBSTAT_RANGE: Record<StatKey, [number, number]> = {
  atk_pct: [0.041, 0.058], def_pct: [0.051, 0.073], crit_rate: [0.027, 0.039],
  crit_dmg: [0.054, 0.078], dmg_bonus: [0.047, 0.065], er: [0.05, 0.07],
  hp_flat: [0, 0], atk_flat: [0, 0],
};

export const MAIN_STAT_GROWTH = 0.04;

// ===== 百分百先生语录 =====
export const QUOTES: Record<string, string[]> = {
  prePull: ['这波必出金，我的算法 100% 确定', '概率在我眼里没有意义', '看着，这是最后一次预言'],
  gold: ['看，我说什么来着', '这就是 100% 的实力', '我甚至没用力'],
  whiff: ['这不科学……', '我的模型不可能错，是这个世界错了', '一定是概率学背叛了我'],
  preEnhance: ['防御主词条，稳了', '这发必中暴伤', '词条我已经算好了'],
  enhanceMiss: ['误差，纯属误差', '下次一定', '这不是我的问题'],
  battle: ['10 回合，多一秒算我输', '对面 HP 我已经看穿了', '这波稳如老狗'],
  signin: ['今天的运势？100% 大吉', '这广告位，我 100% 满意', '签到我早就算到了'],
  apology: ['对不起，我 100% 确定我没错，但流程上我道个歉'],
  easter: ['别赌了，去写代码吧——这句话我 100% 正确'],
};
