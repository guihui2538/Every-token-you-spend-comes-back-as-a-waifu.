/**
 * Token姬·抽卡计划 — Host 半区（Cordis 插件）
 * 职责：token 累计、JSON 存档、HTTP 路由、随机逻辑权威裁决（策划案 §5）
 * 参照 dsh-plugin-wallpaper-engine 的插件形态：export { inject, apply }。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { consumeTokens, damageCap, damageRewards, hpPerToken } from '../game/economy';
import { attackRound, teamDps } from '../game/battle';
import { enhanceArtifact, enhanceCoinsCost, fodderExp, levelsFromExp, synthesize } from '../game/artifact';
import { ensureDailyUp, pull } from '../game/gacha';
import { createArtifact } from '../game/artifact';
import { dateKey, defaultSave, migrate, pickQuote, pushEvent, pushQuote, recordSlap, signIn, tryLevelUp } from '../game/state';
import { chance, pick } from '../game/rng';
import { ECONOMY, QUOTES, charById } from '../game/config';
import type { PoolId, SaveData, StateResponse } from '../game/types';

export const inject = ['webServer'];

export function apply(ctx: any) {
  const webServer = ctx.webServer;
  if (!webServer || typeof webServer.register !== 'function') return () => {};

  // ===== 存档 =====
  const savePath = join(homedir(), '.dsh-token-gacha', 'save.json');
  let save: SaveData = loadSave();

  function loadSave(): SaveData {
    try {
      if (existsSync(savePath)) {
        return migrate(JSON.parse(readFileSync(savePath, 'utf8')));
      }
    } catch (err) {
      console.warn('[token-gacha] save load failed, using default:', err);
    }
    return defaultSave();
  }

  function persist() {
    try {
      save.updatedAt = new Date().toISOString();
      mkdirSync(dirname(savePath), { recursive: true });
      writeFileSync(savePath, JSON.stringify(save, null, 2), 'utf8');
    } catch (err) {
      console.warn('[token-gacha] save failed:', err);
    }
  }

  // ===== token 累计（会话投影 tokenUsage）=====
  ctx.inject(['sessionProjections'], (pc: any) => {
    const last = new Map<string, number>();
    ctx.on('session/event', (session: any) => {
      const sid = typeof session === 'string' ? session : session?.id ?? session?.sid;
      if (!sid) return;
      try {
        const unit = pc.sessionProjections.stateOf(session, 'tokenUsage');
        const t = unit?.totals;
        if (!t) return;
        const total = (t.uncachedInputTokens ?? 0) + (t.outputTokens ?? 0)
          + (t.cacheReadTokens ?? 0) + (t.cacheWriteTokens ?? 0);
        const prev = last.get(sid) ?? 0;
        if (total > prev) {
          consumeTokens(save, total - prev);
          persist();
        }
        last.set(sid, total);
      } catch { /* 投影未就绪 */ }
    });
  });

  // ===== HTTP 路由 =====
  const BASE = '/token-gacha';
  const disposers: (() => void)[] = [];

  function json(res: ServerResponse, code: number, body: unknown) {
    const payload = JSON.stringify(body);
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(payload);
  }

  function readJson(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          resolve(raw ? JSON.parse(raw) : {});
        } catch (e) { reject(e); }
      });
      req.on('error', reject);
    });
  }

  function reg(path: string, handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>) {
    disposers.push(webServer.register({ kind: 'exact', path: `${BASE}${path}`, handler }));
  }

  // ---- 健康检查（重启后验证插件是否加载）----
  reg('/health', async (_req, res) => {
    json(res, 200, { ok: true, name: 'dsh-plugin-token-gacha', version: '0.1.0' });
  });

  // ---- GET 状态 ----
  reg('/state', async (_req, res) => {
    const now = new Date();
    const today = dateKey(now);
    ensureDailyUp(save.gacha, now); // 每日卡池轮换
    const dps = teamDps(save);
    const body: StateResponse = {
      ok: true,
      save,
      computed: {
        dps: Math.round(dps),
        showPopup: save.popup.lastDate !== today,
        signedInToday: save.signIn.lastDate === today,
        damageCap: damageCap(save.level),
        hpPerToken: hpPerToken(save.level),
        coinPerHp: ECONOMY.COIN_PER_HP,
      },
    };
    // 注意：不在这里消费弹窗标记（后台轮询会误吞），由 POST /popup-shown 在实际展示时标记
    persist();
    json(res, 200, body);
  });

  // ---- 弹窗已展示（每日一次，客户端实际展示时调用）----
  reg('/popup-shown', async (_req, res) => {
    save.popup.lastDate = dateKey(new Date());
    persist();
    json(res, 200, { ok: true });
  });

  // ---- 新手教程完成 ----
  reg('/tutorial-done', async (_req, res) => {
    save.meta.tutorialSeen = true;
    persist();
    json(res, 200, { ok: true });
  });

  // ---- 每日签到 ----
  reg('/signin', async (_req, res) => {
    const r = signIn(save);
    persist();
    json(res, 200, { ok: true, ...r });
  });

  // ---- 抽卡 ----
  reg('/pull', async (req, res) => {
    try {
      const body = await readJson(req);
      const pool: PoolId = body.pool ?? 'basic';
      const count = body.count === 10 ? 10 : 1;
      const out = pull(save, pool, count);
      if (out.results.length === 0) {
        json(res, 400, { ok: false, error: '代币或抽卡券不足' });
        return;
      }
      // 百分百先生：十连无 SSR → 打脸
      const hasSSR = out.results.some(r => r.rarity === 'SSR');
      recordSlap(save, hasSSR);
      const quote = hasSSR ? pickQuote('gold') : pickQuote('whiff');
      pushQuote(save, quote);
      const ssr = out.results.filter(r => r.rarity === 'SSR').map(r => r.charId ?? r.weaponId ?? '');
      pushEvent(save, 'pull',
        out.results.length === 10 ? `十连 ${ssr.length ? `出 ${ssr.map(s => nameOf(s)).join('、')}` : '无 SSR'}` : `单抽 ${ssr.length ? nameOf(ssr[0]) : '无 SSR'}`,
        quote);
      persist();
      json(res, 200, { ok: true, results: out.results, coins: save.economy.coins, tickets: save.tickets, quote });
    } catch (e) {
      json(res, 400, { ok: false, error: String((e as Error)?.message ?? e) });
    }
  });

  // ---- 圣遗物强化（狗粮模式 或 代币直升模式）----
  reg('/enhance', async (req, res) => {
    try {
      const body = await readJson(req);
      const target = save.artifacts.find(a => a.uid === body.targetUid);
      if (!target) { json(res, 400, { ok: false, error: '目标圣遗物不存在' }); return; }
      if (target.fodder) { json(res, 400, { ok: false, error: '狗粮不能被强化' }); return; }

      let levels = 0;
      let expGain = 0;
      let fodders: typeof target[] = [];
      const coinLevels = Number(body.coinLevels ?? 0);

      if (coinLevels > 0) {
        // 代币直升：花钱升 N 级
        levels = Math.min(coinLevels, ECONOMY.ARTIFACT_MAX_LEVEL - target.level);
        if (levels <= 0) { json(res, 400, { ok: false, error: '已满级' }); return; }
      } else {
        // 狗粮模式（已装备的圣遗物也可当狗粮，消耗后自动卸下）
        const fodderIds: string[] = Array.isArray(body.fodderUids) ? body.fodderUids : [];
        fodders = fodderIds.map(uid => save.artifacts.find(a => a.uid === uid)).filter(Boolean) as typeof fodders;
        if (fodders.some(f => f.uid === target.uid) || fodders.length === 0) {
          json(res, 400, { ok: false, error: '请选择狗粮（不能包含目标本身）' }); return;
        }
        expGain = fodders.reduce((s, f) => s + fodderExp(f), 0);
        levels = levelsFromExp(target, expGain);
        if (levels === 0) { json(res, 400, { ok: false, error: '狗粮不足以升级' }); return; }
      }

      const cost = enhanceCoinsCost(target, target.level + levels);
      if (save.economy.coins < cost) { json(res, 400, { ok: false, error: `代币不足（需要 ${cost}）` }); return; }
      save.economy.coins -= cost;
      save.economy.coinsSpent += cost;
      save.meta.totalEnhances += 1;
      unequipConsumed(fodders);
      fodders.forEach(f => save.artifacts.splice(save.artifacts.indexOf(f), 1));
      if (expGain > 0) target.exp += expGain;
      const outcome = enhanceArtifact(target, levels, cost);
      // 百分百先生：词条未如预言 → 打脸
      recordSlap(save, outcome.changed === 'new_substat' || (outcome.statKey === 'crit_rate' || outcome.statKey === 'crit_dmg'));
      const quote = outcome.changed === 'level_up' ? pickQuote('enhanceMiss') : pickQuote('gold');
      pushQuote(save, quote);
      pushEvent(save, 'enhance', `圣遗物 +${outcome.levelsGained} 级`,
        outcome.changed === 'new_substat' ? `新增词条 ${outcome.statKey}` : outcome.changed === 'stat_up' ? `${outcome.statKey} 升级` : '仅升级');
      persist();
      json(res, 200, { ok: true, ...outcome, quote, coins: save.economy.coins });
    } catch (e) {
      json(res, 400, { ok: false, error: String((e as Error)?.message ?? e) });
    }
  });

  // ---- 双圣遗物合成（80% 双词条 / 20% 失败两件消失；已装备的也可合成，消耗后自动卸下）----
  reg('/synthesize', async (req, res) => {
    try {
      const body = await readJson(req);
      const a = save.artifacts.find(x => x.uid === body.uidA);
      const b = save.artifacts.find(x => x.uid === body.uidB);
      if (!a || !b || a.uid === b.uid) { json(res, 400, { ok: false, error: '请选择两件不同的圣遗物' }); return; }
      const out = synthesize(a, b);
      unequipConsumed([a, b]);
      save.artifacts.splice(save.artifacts.indexOf(a), 1);
      save.artifacts.splice(save.artifacts.indexOf(b), 1);
      if (out.ok && out.result) save.artifacts.push(out.result);
      const quote = out.ok ? pickQuote('gold') : pickQuote('whiff');
      pushQuote(save, quote);
      pushEvent(save, 'enhance', out.ok ? '合成成功' : '合成失败（两件消失）',
        out.ok ? '获得双词条圣遗物' : '20% 失败，圣遗物灰飞烟灭');
      persist();
      json(res, 200, { ok: true, success: out.ok, artifact: out.result ?? null, quote });
    } catch (e) {
      json(res, 400, { ok: false, error: String((e as Error)?.message ?? e) });
    }
  });

  /** 消耗的圣遗物若在共享装备位上，自动卸下 */
  function unequipConsumed(items: { uid: string }[]) {
    const uids = new Set(items.map(i => i.uid));
    for (const slot of Object.keys(save.equipped) as (keyof typeof save.equipped)[]) {
      const uid = save.equipped[slot];
      if (uid && uids.has(uid)) delete save.equipped[slot];
    }
  }

  // ---- 攻击（每次调用只打一回合，按打掉的血结算）----
  reg('/attack', async (_req, res) => {
    if (save.monster.hp <= 0) {
      json(res, 400, { ok: false, error: '怪物血已打空，继续使用 DSH 消耗 token 补血' });
      return;
    }
    const result = attackRound(save);
    save.meta.totalBattles += 1;
    save.monster.hp = result.hpAfter;
    save.monster.combo = result.defeated ? 0 : result.round; // 存活累计连击，打空重置
    save.economy.coins += result.rewards.coins;
    save.economy.coinsEarned += result.rewards.coins;
    save.exp += result.rewards.exp;
    const levels = tryLevelUp(save);
    let artifact;
    if (result.dealt > 0 && chance(ECONOMY.ARTIFACT_DROP_CHANCE)) {
      artifact = createArtifact();
      save.artifacts.push(artifact);
    }
    const quote = result.defeated ? pickQuote('gold') : pickQuote('whiff');
    pushQuote(save, quote);
    pushEvent(save, 'battle',
      `第 ${result.round} 回合 · 造成 ${result.dealt.toLocaleString()} 伤害`,
      `+${result.rewards.coins} 代币 +${Math.floor(result.rewards.exp)} 经验${levels ? `，升了 ${levels} 级！` : ''}${artifact ? '，掉落圣遗物！' : ''}${result.defeated ? ' · 血已打空' : ''}`);
    json(res, 200, {
      ok: true,
      result,
      rewards: { coins: result.rewards.coins, exp: result.rewards.exp, levels, artifact: artifact ?? null },
      coins: save.economy.coins, level: save.level, exp: save.exp, quote,
    });
    persist();
  });

  // ---- 调整上场顺序 ----
  reg('/reorder', async (req, res) => {
    try {
      const body = await readJson(req);
      const raw: string[] = Array.isArray(body.order) ? body.order : [];
      // 同一角色只能上场一个：去重后取前 3
      const order = [...new Set(raw)].slice(0, ECONOMY.TEAM_SIZE);
      if (!order.every(id => save.chars.some(c => c.charId === id))) {
        json(res, 400, { ok: false, error: '存在未拥有的角色' }); return;
      }
      save.order = order;
      persist();
      json(res, 200, { ok: true, order: save.order });
    } catch (e) {
      json(res, 400, { ok: false, error: String((e as Error)?.message ?? e) });
    }
  });

  // ---- 装备圣遗物（全员共享一套）----
  reg('/equip', async (req, res) => {
    try {
      const body = await readJson(req);
      const slot = body.slot as keyof typeof save.equipped;
      if (body.artifactUid == null) {
        delete save.equipped[slot];
      } else {
        const art = save.artifacts.find(a => a.uid === body.artifactUid);
        if (!art || art.fodder || art.slot !== slot) { json(res, 400, { ok: false, error: '圣遗物无效或部位不符' }); return; }
        save.equipped[slot] = art.uid;
      }
      persist();
      json(res, 200, { ok: true });
    } catch (e) {
      json(res, 400, { ok: false, error: String((e as Error)?.message ?? e) });
    }
  });

  // ---- 百分百先生今日预言（弹窗用）----
  reg('/quote', async (_req, res) => {
    const q = pick([...QUOTES.signin, ...QUOTES.prePull]);
    json(res, 200, { ok: true, quote: q });
  });

  return () => disposers.forEach(d => d());
}

function nameOf(id: string): string {
  if (!id) return '???';
  try { return charById(id).name; } catch { return id; }
}
