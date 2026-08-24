/**
 * Host 冒烟测试：用 mock ctx 驱动 lib/index.js，验证核心链路。
 * 运行：node test/smoke.mjs
 */
import { apply } from '../lib/index.js';
import { Readable } from 'node:stream';
import { rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

// 清掉上次运行留下的存档，写入预置存档（含圣遗物/狗粮），保证圣遗物用例确定执行
const SAVE_PATH = join(homedir(), '.dsh-token-gacha', 'save.json');
rmSync(SAVE_PATH, { force: true });
const seed = {
  version: 2,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  level: 1,
  exp: 0,
  economy: { tokensAccumulated: 0, coins: 300, coinsEarned: 300, coinsSpent: 0 },
  tickets: { single: 0, ten: 0 },
  monster: { hp: 0, combo: 0 },
  order: ['doubao'],
  chars: [{ charId: 'doubao', constellation: 0, weaponId: null }],
  equipped: {},
  weapons: [],
  artifacts: [
    { uid: 'art_a1', slot: 'flower', mainKey: 'hp_flat', substats: [{ key: 'atk_pct', value: 0.05 }], level: 0, exp: 0 },
    { uid: 'art_a2', slot: 'plume', mainKey: 'atk_flat', substats: [{ key: 'crit_rate', value: 0.03 }], level: 0, exp: 0 },
    { uid: 'fod_1', slot: 'flower', mainKey: 'atk_flat', substats: [], level: 0, exp: 150, fodder: true },
  ],
  gacha: {
    characterPity: { basic: 0, advanced: 0, elite: 0, legendary: 0, weapon: 0, newbie: 0 },
    characterGuaranteed: { basic: false, advanced: false, elite: false, legendary: false, weapon: false, newbie: false },
    weaponPity: 0, weaponGuaranteed: false, newbiePulls: 0,
    dailyUp: { character: 'kimi', weapon: 'weapon_kimi', resetsAt: '' },
  },
  signIn: { lastDate: '', streak: 0 },
  popup: { lastDate: '' },
  meta: { slaps: 0, slapStreak: 0, apologyCoupons: 0, totalPulls: 0, totalEnhances: 0, totalBattles: 0, quoteLog: [] },
  events: [],
};
writeFileSync(SAVE_PATH, JSON.stringify(seed), 'utf8');

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.error(`  ✗ ${msg}`); }
}

// ---- mock ctx ----
const routes = [];
const listeners = {};
const tokenTotals = { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

const ctx = {
  webServer: {
    register(r) { routes.push(r); return () => {}; },
  },
  on(ev, fn) { (listeners[ev] ??= []).push(fn); },
  inject(names, cb) {
    cb({ sessionProjections: { stateOf: () => ({ totals: { ...tokenTotals } }) } });
  },
};

const dispose = apply(ctx);
assert(routes.length >= 8, `路由注册数 ≥ 8（实际 ${routes.length}）`);

// ---- 0. 健康检查 ----
const h = await callRoute('/token-gacha/health');
assert(h.ok === true && h.name === 'dsh-plugin-token-gacha', 'GET /health 正常');

// ---- 路由调用辅助 ----
function callRoute(path, method = 'GET', body) {
  const route = routes.find(r => r.path === path);
  if (!route) return { error: `route not found: ${path}` };
  let req = new Readable({ read() {} });
  if (body !== undefined) {
    req = Readable.from([Buffer.from(JSON.stringify(body))]); // node http data 块是 Buffer
  }
  let resBody = '';
  const res = {
    statusCode: 0,
    setHeader() {},
    end(payload) { resBody = payload; },
  };
  return route.handler(req, res).then(() => JSON.parse(resBody || '{}'));
}

const state = async () => callRoute('/token-gacha/state');

// ---- 1. 初始状态 ----
const s0 = await state();
assert(s0.ok === true, 'GET /state 返回 ok');
assert(s0.save.level === 1 && s0.save.economy.coins === 300, '初始等级 1、代币 300（预置存档）');
assert(s0.computed.showPopup === true, '首次访问 showPopup=true');

// ---- 2. token 累计 → 喂血（5000 token × 0.015 HP/token = 75 HP）----
tokenTotals.uncachedInputTokens = 3000;
tokenTotals.outputTokens = 2000;
for (const fn of listeners['session/event']) fn({ id: 'sess-smoke' });
const s1 = await state();
assert(s1.save.economy.tokensAccumulated === 5000, 'token 累计 5000');
assert(s1.save.monster.hp === 75, '喂血 75 HP（5000 token × 0.015）');
assert(s1.computed.showPopup === true, '轮询访问不消费弹窗标记（仍为 true）');

// ---- 2.5 弹窗标记只在展示时消费 ----
const pp = await callRoute('/token-gacha/popup-shown', 'POST');
assert(pp.ok === true, 'POST /popup-shown 正常');
const s1b = await state();
assert(s1b.computed.showPopup === false, '展示后 showPopup=false（当天不再弹）');

// ---- 3. 签到 ----
const si = await callRoute('/token-gacha/signin', 'POST');
assert(si.ok === true && si.rewarded === true, '签到成功');
assert(si.tickets.single === 1, '签到获得 1 张单抽券');
const s2 = await state();
assert(s2.computed.signedInToday === true, '今日已签到');

// ---- 4. 抽卡（用券）----
const pull = await callRoute('/token-gacha/pull', 'POST', { pool: 'basic', count: 1 });
assert(pull.ok === true && pull.results.length === 1, '单抽成功（用券）');
assert(pull.tickets.single === 0, '消耗 1 张单抽券');

// 代币单抽
const pull2 = await callRoute('/token-gacha/pull', 'POST', { pool: 'basic', count: 1 });
assert(pull2.ok === true && ['character', 'weapon', 'artifact', 'fodder'].includes(pull2.results[0].kind), '代币单抽成功');
assert(pull2.coins === 140, '代币扣费 300→140');

// 余额不足时十连优雅失败
const pull10 = await callRoute('/token-gacha/pull', 'POST', { pool: 'basic', count: 10 });
assert(pull10.ok === false && !!pull10.error, '余额不足时十连优雅失败（需 1600）');

// 未解锁池请求不崩溃
const pLocked = await callRoute('/token-gacha/pull', 'POST', { pool: 'legendary', count: 1 });
assert(pLocked.ok === false && !!pLocked.error, '未解锁池余额不足优雅失败');

// ---- 5. 攻击（每次一回合，打掉多少血给多少奖励）----
let totalDealt = 0;
for (let i = 0; i < 20; i++) {
  const b = await callRoute('/token-gacha/attack', 'POST');
  if (!b.ok) break;
  assert(b.result.dealt > 0, `第 ${b.result.round} 回合造成伤害 ${b.result.dealt}`);
  assert(b.result.rewards.coins >= 0 && b.result.rewards.exp >= 0, `奖励 ${b.result.rewards.coins} 代币`);
  totalDealt += b.result.dealt;
  if (b.result.defeated) break;
}
assert(totalDealt > 0, `累计造成伤害 ${totalDealt}`);
const s3 = await state();
assert(s3.save.monster.hp >= 0, `怪物剩余 HP ${s3.save.monster.hp}`);
assert(s3.save.level >= 1 && s3.save.exp > 0, '经验已累计');

// ---- 6. 血打空后优雅失败（提示补血）----
const b2 = await callRoute('/token-gacha/attack', 'POST');
assert(b2.ok === false && !!b2.error, '血打空后攻击优雅失败（提示补血）');

// ---- 7. 继续喂 token 补血 ----
tokenTotals.uncachedInputTokens = 9000;
tokenTotals.outputTokens = 6000; // 累计 15000，较上次 5000 增量 10000 × 0.015 = 150 HP
for (const fn of listeners['session/event']) fn({ id: 'sess-smoke' });
const s5 = await state();
assert(s5.save.monster.hp === 150, `补血 150 HP（实际 ${s5.save.monster.hp}）`);

// ---- 8. 圣遗物系统（狗粮/合成/共享装备/代币升级，预置存档保证可执行）----
const arts = s5.save.artifacts;
assert(Array.isArray(arts), '圣遗物数组存在');
const fod = arts.find(a => a.fodder);
assert(!!fod, '预置狗粮存在');
const eqBad = await callRoute('/token-gacha/equip', 'POST', { slot: 'flower', artifactUid: fod.uid });
assert(eqBad.ok === false && !!eqBad.error, '狗粮不能被装备');

// 合成：用狗粮 + 一件真圣遗物（保留 art_a1 给装备/强化测试）
const sy = await callRoute('/token-gacha/synthesize', 'POST', { uidA: fod.uid, uidB: 'art_a2' });
assert(sy.ok === true && typeof sy.success === 'boolean', `合成路由正常（success=${sy.success}）`);

const s6 = await state();
const real = s6.save.artifacts.filter(a => !a.fodder);
assert(real.length > 0, '合成后仍有真圣遗物');
const eq = await callRoute('/token-gacha/equip', 'POST', { slot: real[0].slot, artifactUid: real[0].uid });
assert(eq.ok === true, '共享装备成功');
const s7 = await state();
assert(s7.save.equipped[real[0].slot] === real[0].uid, '装备已保存到共享槽位');
const en = await callRoute('/token-gacha/enhance', 'POST', { targetUid: real[0].uid, coinLevels: 1 });
assert(en.ok === true && en.levelsGained === 1, '代币直升 +1 级成功');

// ---- 清理 ----
dispose();
console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
