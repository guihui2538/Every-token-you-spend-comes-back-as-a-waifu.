/**
 * Token姬·抽卡计划 — 数据模型（纯数据，无 IO，host 与 client 共享）
 */

export type ArtifactSlot = 'flower' | 'plume' | 'sands' | 'goblet' | 'circlet';
export type StatKey = 'hp_flat' | 'atk_flat' | 'atk_pct' | 'def_pct' | 'crit_rate' | 'crit_dmg' | 'dmg_bonus' | 'er';
export type Rarity = 'SSR' | 'SR' | 'R';
export type PoolId = 'basic' | 'advanced' | 'elite' | 'legendary' | 'weapon' | 'newbie';

// ===== 静态定义（见 config.ts）=====
export type SkillOp = 'add' | 'mult' | 'crit2' | 'dmg_add';
export type Special = 'combo' | 'ramp' | 'burst' | 'combocap' | 'stutter';

export interface SkillDef {
  op: SkillOp;          // 乘区类型：add 攻击+ / mult 总伤× / crit2 暴击率×2 / dmg_add 增伤+
  value: number;
  label: string;        // 展示文案
}

export interface CharacterDef {
  id: string;
  name: string;
  rarity: Rarity;
  baseAtk: number;
  critRate: number;
  critDmg: number;
  dmgBonus: number;
  skill: SkillDef | null;   // 从左到右流水线 buff
  special: Special | null;  // 回合/光环机制
  aura?: { atkPct?: number; dmgBonus?: number };
  weaponId: string | null;
}

// ===== 持有态 =====
export interface OwnedCharacter {
  charId: string;
  constellation: number;           // 0-6
  weaponId: string | null;
}

export interface SubstatRoll { key: StatKey; value: number; }

export interface ArtifactInstance {
  uid: string;
  slot: ArtifactSlot;
  mainKey: StatKey;
  substats: SubstatRoll[];      // 0-4 条
  level: number;                // 0-20
  exp: number;                  // 已积累经验；狗粮时 = 自身经验值
  fodder?: boolean;             // 无属性狗粮：无主/副词条，仅用于升级
}

export interface OwnedWeapon { weaponId: string; refinement: number; }

export interface GachaState {
  characterPity: Record<PoolId, number>;
  characterGuaranteed: Record<PoolId, boolean>;
  weaponPity: number;
  weaponGuaranteed: boolean;
  newbiePulls: number;
  dailyUp: { character: string; weapon: string; resetsAt: string };
}

export interface MetaState {
  slaps: number;
  slapStreak: number;
  apologyCoupons: number;
  totalPulls: number;
  totalEnhances: number;
  totalBattles: number;
  quoteLog: string[];
  tutorialSeen?: boolean;  // 新手教程是否已完成
}

export interface RecentEvent {
  kind: 'pull' | 'enhance' | 'battle' | 'level' | 'signin' | 'slap';
  title: string;
  detail: string;
  at: string;
}

export interface SaveData {
  version: number;
  createdAt: string;
  updatedAt: string;
  level: number;              // 账号共同等级 1-100
  exp: number;
  economy: {
    tokensAccumulated: number;
    coins: number;
    coinsEarned: number;
    coinsSpent: number;
  };
  tickets: { single: number; ten: number; };
  monster: { hp: number; combo: number }; // 单只怪物：token 喂血；combo = 连击计数（每攻击一回合 +1）
  order: string[];            // 上场顺序（最多 3 个 charId，左→右 buff 顺序）
  chars: OwnedCharacter[];
  equipped: Partial<Record<ArtifactSlot, string>>; // 全员共享的一套圣遗物（5 部位）
  weapons: OwnedWeapon[];
  artifacts: ArtifactInstance[];
  gacha: GachaState;
  signIn: { lastDate: string; streak: number; };
  popup: { lastDate: string; };
  meta: MetaState;
  events: RecentEvent[];
}

// ===== 战斗 =====
export interface DamageStep {
  label: string;      // 步骤文案
  charId?: string;    // 高亮角色
  running: number;    // 该步后的累计伤害
}

export interface RoundLog {
  round: number;
  steps: DamageStep[];
  total: number;      // 本回合实际造成伤害（受上限/剩余血约束）
}

export interface BattleResult {
  rounds: number;
  hpBefore: number;
  hpAfter: number;
  damageDealt: number;
  defeated: boolean;  // 血被打空（可继续喂 token）
  damageLog: RoundLog[];
  rewards: { coins: number; exp: number };
}

/** 单回合攻击结果（每按一次打一回合） */
export interface AttackResult {
  round: number;          // 当前回合（combo+1）
  steps: DamageStep[];
  dealt: number;
  hpBefore: number;
  hpAfter: number;
  defeated: boolean;
  rewards: { coins: number; exp: number };
}

// ===== 抽卡 =====
export interface PullResult {
  kind: 'character' | 'weapon' | 'artifact' | 'fodder';
  rarity: Rarity;
  charId?: string;
  weaponId?: string;
  artifact?: ArtifactInstance;
  dupe?: boolean;
}

// ===== API 载荷 =====
export interface StateResponse {
  ok: true;
  save: SaveData;
  computed: {
    dps: number;
    showPopup: boolean;
    signedInToday: boolean;
    damageCap: number;
    hpPerToken: number;
    coinPerHp: number;
  };
}
export interface ApiError { ok: false; error: string; }
export type Api<T> = T | ApiError;
