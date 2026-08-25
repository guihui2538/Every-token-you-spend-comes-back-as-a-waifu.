/**
 * 四个 Tab：战斗 / 抽卡 / 背包(装备+强化) / 图鉴
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ARTIFACT_SLOT_NAME, charById, GACHA, POOLS, STAT_NAME, weaponById } from '../game/config';
import type { ArtifactSlot, PoolId, SaveData, StateResponse } from '../game/types';
import { fmt, Portrait, RarityChip, TiltCard } from './components';
import { charPosters, monsterImg } from './portraits';
import { IconCoin, IconLock, IconShare, IconSpark, IconSword, IconSynth, IconTicket, IconUp } from './icons';

export interface TabProps {
  save: SaveData;
  computed: StateResponse['computed'];
  refresh: () => Promise<void>;
  toast: (msg: string) => void;
}

// ================= 首页 · 战斗 =================
export function HomeTab({ save, computed, refresh, toast }: TabProps) {
  const [anim, setAnim] = useState<null | { result: any; rewards: any; quote: string }>(null);
  const [busy, setBusy] = useState(false);

  async function attack() {
    setBusy(true);
    try {
      const r = await api('/attack', { method: 'POST' });
      if (!r.ok) { toast(r.error ?? '攻击失败'); return; }
      setAnim({ result: r.result, rewards: r.rewards, quote: r.quote });
      await refresh();
    } finally { setBusy(false); }
  }

  return (
    <>
      <BattleStage save={save} computed={computed} anim={anim} busy={busy} onAttack={attack} refresh={refresh} toast={toast} />
      <RecentEvents save={save} />
    </>
  );
}

function RecentEvents({ save }: { save: SaveData }) {
  return (
    <div className="tg-card">
      <div className="tg-card-title">最近记录</div>
      {save.events.length === 0 && <div className="tg-empty">战斗、抽卡、强化的记录会显示在这里</div>}
      {save.events.slice(0, 6).map((e, i) => (
        <div key={i} style={{ padding: '5px 0', borderBottom: i < 5 ? '1px solid var(--tg-border)' : 'none' }}>
          <div style={{ fontSize: 11.5, fontWeight: 600 }}>{e.title}</div>
          <div className="tg-muted" style={{ fontSize: 10.5 }}>{e.detail}</div>
        </div>
      ))}
    </div>
  );
}

// ===== 数字滚动（赌场式缓动）=====
function useCountUp(target: number, duration = 600): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.floor(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return display;
}

// ===== 战斗区：怪物 + 队伍 + 排序编辑 + 攻击 + 动画 =====
function BattleStage({ save, computed, anim, busy, onAttack, refresh, toast }: {
  save: SaveData;
  computed: StateResponse['computed'];
  anim: null | { result: any; rewards: any; quote: string };
  busy: boolean;
  onAttack: () => void;
  refresh: () => Promise<void>;
  toast: (msg: string) => void;
}) {
  const [stepIdx, setStepIdx] = useState(-1);
  const [hpShown, setHpShown] = useState<number | null>(null);
  const [hitId, setHitId] = useState(0);
  const [editing, setEditing] = useState(false);
  const [dragChar, setDragChar] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [rarityFilter, setRarityFilter] = useState<'all' | 'SSR' | 'SR' | 'R'>('all');
  const [deployMenu, setDeployMenu] = useState<string | null>(null);

  const liveHp = save.monster.hp;
  const steps = anim?.result.steps ?? [];
  const displayedHp = hpShown ?? liveHp;

  useEffect(() => {
    if (!anim) { setStepIdx(-1); setHpShown(null); return; }
    setStepIdx(0);
    setHpShown(anim.result.hpBefore);
  }, [anim]);

  useEffect(() => {
    if (!anim || stepIdx < 0) return;
    if (stepIdx >= steps.length) {
      setHpShown(anim.result.hpAfter);
      setHitId(i => i + 1);
      return;
    }
    const t = setTimeout(() => setStepIdx(i => i + 1), 700);
    return () => clearTimeout(t);
  }, [stepIdx, anim, steps]);

  async function assign(charId: string, pos: number) {
    const order = save.order.filter(id => id !== charId);
    order[pos] = charId;
    const r = await api('/reorder', { method: 'POST', body: { order: order.filter(Boolean) } });
    if (!r.ok) { toast(r.error ?? '调整失败'); return; }
    await refresh();
  }

  const curStep = stepIdx >= 0 && stepIdx < steps.length ? steps[stepIdx] : null;
  const rolling = useCountUp(curStep?.running ?? 0, 600);
  const activeChar = curStep?.charId ?? null;
  const done = anim != null && stepIdx >= steps.length;
  const hpBefore = anim?.result.hpBefore ?? 0;
  const barPct = anim ? (hpBefore > 0 ? (displayedHp / hpBefore) * 100 : 0) : (liveHp > 0 ? 100 : 0);

  return (
    <div className="tg-card">
      <div className="tg-card-title">
        代码怪 · Lv.{save.level}
        <span className="tg-muted">每 token 喂 {computed.hpPerToken.toFixed(3)} HP · 连击 {save.monster.combo}</span>
      </div>

      <div className="tg-monster" style={{ position: 'relative' }}>
        <img className="tg-monster-icon" src={monsterImg} alt="代码怪" />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>HP {fmt(displayedHp)}</div>
          <div className="tg-bar"><i style={{ width: `${barPct}%` }} /></div>
        </div>
        {done && anim && <span key={hitId} className="tg-hit-fly">-{fmt(anim.result.dealt)}</span>}
      </div>

      <div className="tg-team-row" style={{ marginTop: 12 }}>
        {[0, 1, 2].map(i => {
          const id = save.order[i];
          const def = id ? charById(id) : null;
          const lit = activeChar === id;
          const owned = id ? save.chars.find(c => c.charId === id) : null;
          const weapon = owned?.weaponId ? save.weapons.find(w => w.weaponId === owned.weaponId) : null;
          return (
            <TiltCard key={i} className={`tg-slot-card ${lit ? 'lit' : ''}`}>
              <span className="tg-slot-pos">{i === 0 ? '左' : i === 1 ? '中' : '右'}</span>
              {def ? (
                <div className="tg-slot-card-in">
                  <Portrait name={def.name} rarity={def.rarity} size={96} hint="" />
                  <div className="tg-slot-name">{def.name}</div>
                  <div className="tg-slot-role">{def.skill?.label ?? (def.aura ? '光环' : def.special ?? '被动')}</div>
                  <div className="tg-slot-meta">
                    {owned && owned.constellation > 0 && <span className="tg-chip SR">命座 {owned.constellation}/6</span>}
                    {weapon && <span className="tg-chip SSR">已装 · {weaponById(owned!.weaponId!)?.name}</span>}
                  </div>
                </div>
              ) : (
                <div className="tg-empty" style={{ padding: '30px 0' }}>空</div>
              )}
            </TiltCard>
          );
        })}
      </div>

      {/* 调整上场顺序（拖拽） */}
      <div style={{ textAlign: 'right', marginTop: 6 }}>
        <button className="tg-btn ghost sm" onClick={() => setEditing(e => !e)}>
          {editing ? '收起排序' : '调整上场顺序'}
        </button>
      </div>
      {editing && (
        <div style={{ marginTop: 6 }}>
          <div className="tg-muted" style={{ fontSize: 10, marginBottom: 6 }}>
            拖拽角色到槽位，或「左键点击」角色弹出左/中/右部署位
          </div>
          {/* 位置槽位（拖放目标） */}
          <div className="tg-team-row">
            {[0, 1, 2].map(pos => {
              const id = save.order[pos];
              const def = id ? charById(id) : null;
              return (
                <div key={pos}
                  className={`tg-slot ${dragOver === pos ? 'drop' : ''}`}
                  style={{ minHeight: 108 }}
                  onDragOver={e => { e.preventDefault(); setDragOver(pos); }}
                  onDragLeave={() => setDragOver(prev => (prev === pos ? null : prev))}
                  onDrop={e => { e.preventDefault(); if (dragChar) assign(dragChar, pos); setDragChar(null); setDragOver(null); }}>
                  <span className="tg-slot-pos">{['左', '中', '右'][pos]}</span>
                  {def ? (
                    <>
                      <Portrait name={def.name} rarity={def.rarity} size={60} hint="" />
                      <div className="tg-slot-name">{def.name}</div>
                    </>
                  ) : (
                    <div className="tg-muted" style={{ fontSize: 10, padding: '26px 0' }}>拖到这里</div>
                  )}
                </div>
              );
            })}
          </div>
          {/* 稀有度筛选 */}
          <div className="tg-slot-filter" style={{ marginTop: 8 }}>
            {(['all', 'SSR', 'SR', 'R'] as const).map(r => (
              <button key={r} className={`tg-pool-btn ${rarityFilter === r ? 'on' : ''}`} onClick={() => setRarityFilter(r)}>
                {r === 'all' ? '全部' : r}
              </button>
            ))}
          </div>
          {/* 角色卡片（可拖拽 + 左键点击部署） */}
          <div className="tg-roster" style={{ marginTop: 6 }}>
            {save.chars.filter(c => rarityFilter === 'all' || charById(c.charId).rarity === rarityFilter).map(c => {
              const def = charById(c.charId);
              const pos = save.order.indexOf(c.charId);
              return (
                <div key={c.charId}
                  className={`tg-char-row ${dragChar === c.charId ? 'dragging' : ''}`}
                  style={{ padding: '6px 8px', cursor: 'grab', position: 'relative' }}
                  draggable
                  onDragStart={() => setDragChar(c.charId)}
                  onDragEnd={() => { setDragChar(null); setDragOver(null); }}
                  onClick={() => setDeployMenu(deployMenu === c.charId ? null : c.charId)}>
                  <Portrait name={def.name} rarity={def.rarity} size={50} hint="" />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700 }}>{def.name}</div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <RarityChip rarity={def.rarity} />
                    {pos >= 0 ? <span className="tg-chip SSR">{['左', '中', '右'][pos]}</span> : <span className="tg-chip R">未上场</span>}
                  </div>
                  {deployMenu === c.charId && (
                    <div className="tg-deploy-pop" style={{ position: 'absolute', right: 6, top: 58, zIndex: 1200 }}
                      onClick={e => e.stopPropagation()}>
                      {[0, 1, 2].map(p => (
                        <button key={p} className={pos === p ? 'cur' : ''}
                          onClick={() => { assign(c.charId, p); setDeployMenu(null); }}>
                          {['左', '中', '右'][p]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ minHeight: 92, textAlign: 'center', paddingTop: 8 }}>
        {anim ? (
          <>
            <div className="tg-dmg-big">{fmt(rolling)}</div>
            <div className="tg-step-label">{done ? `-${fmt(anim.result.dealt)} 伤害` : curStep?.label ?? '…'}</div>
            {done && (
              <div className="tg-muted" style={{ fontSize: 11, marginTop: 2 }}>
                +{fmt(anim.rewards.coins)} 代币 · +{Math.floor(anim.rewards.exp)} 经验
                {anim.rewards.levels > 0 && <b> · 升级 ×{anim.rewards.levels}！</b>}
                {anim.rewards.artifact && <span className="tg-rarity-SSR"> · 掉落圣遗物！</span>}
                {anim.result.defeated && <span className="tg-rarity-SSR"> · 血已打空</span>}
              </div>
            )}
          </>
        ) : (
          <div className="tg-muted" style={{ fontSize: 11, paddingTop: 26 }}>
            点击「攻击」每回合打一次 · 角色从左到右依次点亮
          </div>
        )}
      </div>

      <button className="tg-btn primary" onClick={onAttack} disabled={busy || liveHp <= 0}>
        {busy ? <span className="tg-spin" /> : <><IconSword size={14} /> {liveHp <= 0 ? '等待补血' : '攻击'}</>}
      </button>
      {liveHp <= 0 && <div className="tg-muted" style={{ fontSize: 10.5, marginTop: 6 }}>怪物血已空——继续使用 DSH（消耗 token）自动补血</div>}
      <div className="tg-muted" style={{ fontSize: 10, marginTop: 8 }}>
        加攻击的放前面，×总伤的放后面伤害更高 · 单回合上限 {fmt(computed.damageCap)}
      </div>
    </div>
  );
}

// ================= 抽卡 =================
export function GachaTab({ save, computed, refresh, toast }: TabProps) {
  const [pool, setPool] = useState<PoolId>('basic');
  const [results, setResults] = useState<any[] | null>(null);
  const [tenResult, setTenResult] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const up = save.gacha.dailyUp;
  const upChar = up ? charById(up.character) : null;
  const [now, setNow] = useState(Date.now());
  void computed;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const countdown = useMemo(() => {
    const diff = up?.resetsAt ? new Date(up.resetsAt).getTime() - now : 0;
    if (diff <= 0) return '轮换中';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [up, now]);

  const poolDef = POOLS.find(p => p.id === pool);

  async function doPull(count: 1 | 10) {
    setBusy(true);
    try {
      const r = await api('/pull', { method: 'POST', body: { pool, count } });
      if (!r.ok) { toast(r.error ?? '抽卡失败'); return; }
      setResults(r.results);
      // 只有十连出 SSR 才弹分享（附带 SSR 角色立绘）
      if (count === 10 && r.results.some((x: any) => x.rarity === 'SSR')) setTenResult(r.results);
      toast(r.quote ?? (count === 10 ? '十连' : '单抽'));
      await refresh();
    } finally { setBusy(false); }
  }

  const pity = save.gacha.characterPity[pool];
  const canPull = save.economy.coins >= 160 || save.tickets.single > 0 || save.tickets.ten > 0;

  return (
    <>
      <div className="tg-pool-tabs">
        {POOLS.map(p => {
          const ok = save.level >= p.unlockLevel;
          return (
            <button key={p.id} className={`tg-pool-btn ${pool === p.id ? 'on' : ''} ${ok ? '' : 'locked'}`}
              onClick={() => ok && setPool(p.id)}>
              {ok ? '' : <IconLock size={10} />} {p.name}
            </button>
          );
        })}
        <button className={`tg-pool-btn ${pool === 'weapon' ? 'on' : ''}`} onClick={() => setPool('weapon')}>武器池</button>
        <button className={`tg-pool-btn ${pool === 'newbie' ? 'on' : ''}`} onClick={() => setPool('newbie')}>新手池</button>
      </div>

      {pool === 'weapon' && up && upChar?.weaponId && (
        <div className="tg-card">
          <div className="tg-card-title">本期 UP 专武 · {countdown}</div>
          <div className="tg-up-row" style={{ gap: 14 }}>
            <Portrait name={upChar.name} rarity={upChar.rarity} size={72} />
            <div className="tg-up-info">
              <div className="tg-up-name">{weaponById(upChar.weaponId)?.name}</div>
              <div className="tg-up-desc">专属武器 · 持有者 {upChar.name}</div>
              <div className="tg-up-rate">武器池 SSR {Math.round(GACHA.WEAPON_SSR * 1000) / 10}% · {GACHA.WEAPON_PITY} 抽保底</div>
            </div>
          </div>
          <div className="tg-pity">
            距保底 <b className="tg-num">{Math.max(0, GACHA.WEAPON_PITY - save.gacha.weaponPity)}</b> 抽
            {save.gacha.weaponGuaranteed && <span className="tg-rarity-SSR"> · 大保底已激活</span>}
          </div>
        </div>
      )}

      {pool !== 'weapon' && pool !== 'newbie' && upChar && (
        <div className="tg-card">
          <div className="tg-card-title">本期 UP · {countdown}</div>
          {charPosters[upChar.name] ? (
            <img className="tg-poster" src={charPosters[upChar.name]} alt={`${upChar.name} 卡池海报`} />
          ) : (
            <div className="tg-up-row">
              <Portrait name={upChar.name} rarity={upChar.rarity} size={72} />
            </div>
          )}
          <div className="tg-up-info" style={{ marginTop: 8 }}>
            <div className="tg-up-name">{upChar.name}</div>
            <div className="tg-up-desc">{upChar.skill?.label ?? upChar.special ?? '被动'}</div>
            <div className="tg-up-rate">{poolDef?.desc ?? ''}</div>
          </div>
          <div className="tg-pity">
            距保底 <b className="tg-num">{Math.max(0, (poolDef?.pity ?? 90) - pity)}</b> 抽
            {save.gacha.characterGuaranteed[pool] && <span className="tg-rarity-SSR"> · 大保底已激活</span>}
          </div>
        </div>
      )}

      <div className="tg-card">
        <div className="tg-row" style={{ justifyContent: 'space-between' }}>
          <span className="tg-row"><IconCoin size={15} className="tg-rarity-SSR" /> <b className="tg-num">{fmt(save.economy.coins)}</b></span>
          <span className="tg-row"><IconTicket size={15} className="tg-muted" /> 券 ×{save.tickets.single + save.tickets.ten}</span>
        </div>
        <div className="tg-pull-actions">
          <button className="tg-btn" disabled={busy || !canPull} onClick={() => doPull(1)}>单抽 160</button>
          <button className="tg-btn primary" disabled={busy || !canPull} onClick={() => doPull(10)}>十连 1600</button>
        </div>
      </div>

      {results && (
        <div>
          <div className="tg-card-title" style={{ margin: '6px 0' }}>抽卡结果（{results.length} 抽）</div>
          {results.map((r, i) => (
            <div key={i} className={`tg-result ${r.rarity === 'SSR' ? 'SSR' : ''}`}>
              {r.kind === 'character' && r.charId && <Portrait name={charById(r.charId).name} rarity={r.rarity} size={50} hint="" />}
              <div className="tg-result-info">
                <div className="tg-result-name">{resultName(r)}</div>
                <div className="tg-result-sub">
                  {r.kind === 'character' && r.charId && (r.dupe ? `命座 +1（${save.chars.find(c => c.charId === r.charId)?.constellation ?? ''} 命）` : '新角色！')}
                  {r.kind === 'weapon' && r.weaponId && (r.dupe ? '精炼 +1' : '新武器！')}
                  {r.kind === 'artifact' && r.artifact && `${ARTIFACT_SLOT_NAME[r.artifact.slot as keyof typeof ARTIFACT_SLOT_NAME]} · ${STAT_NAME[r.artifact.mainKey as keyof typeof STAT_NAME]}`}
                  {r.kind === 'fodder' && '圣遗物材料'}
                </div>
              </div>
              <RarityChip rarity={r.rarity} />
            </div>
          ))}
        </div>
      )}

      {tenResult && (
        <div className="tg-popup" onClick={() => setTenResult(null)}>
          <div className="tg-popup-card" onClick={e => e.stopPropagation()}>
            <div className="tg-popup-hero">
              <IconSpark size={40} className="tg-rarity-SSR" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>十连完成</div>
                <div className="tg-muted" style={{ fontSize: 11 }}>出 SSR {tenResult.filter(r => r.rarity === 'SSR').length} 个</div>
              </div>
            </div>
            <div className="tg-popup-body">
              <button className="tg-btn primary" onClick={() => downloadShareCard(save, tenResult)}>
                <IconShare size={14} /> 生成分享卡（晒出你的十连）
              </button>
              <button className="tg-btn" onClick={() => setTenResult(null)}>收下</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function resultName(r: any): string {
  if (r.kind === 'character' && r.charId) return charById(r.charId).name;
  if (r.kind === 'weapon' && r.weaponId) return weaponById(r.weaponId)?.name ?? '专武';
  if (r.kind === 'artifact') return '圣遗物';
  return '材料';
}

function downloadShareCard(save: SaveData, results: any[]) {
  const ssr = results.filter(r => r.rarity === 'SSR');
  const title = ssr.length ? `十连出金：${ssr.map((r: any) => r.charId ? charById(r.charId).name : weaponById(r.weaponId)?.name).join('、')}` : '十连无 SSR';
  const detail = results.map((r: any) => r.rarity).join(' · ');
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 900, 1200);
  ctx.fillStyle = '#a3a3b0';
  ctx.font = '600 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Token姬 · 抽卡计划', 450, 120);
  ctx.fillStyle = '#17171f';
  ctx.font = '700 44px sans-serif';
  ctx.fillText(title, 450, 260);

  // SSR 角色立绘（当前为白色占位 + 名字 + SSR 徽章）
  const ssrChars = ssr.filter((r: any) => r.kind === 'character' && r.charId);
  const boxW = 240;
  const boxH = 300;
  const gap = 30;
  const total = ssrChars.length * boxW + (ssrChars.length - 1) * gap;
  const startX = 450 - total / 2;
  const boxY = 330;
  ssrChars.forEach((r: any, i: number) => {
    const x = startX + i * (boxW + gap);
    // 白色立绘占位框
    ctx.strokeStyle = '#17171f';
    ctx.lineWidth = 6;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, boxY, boxW, boxH);
    ctx.strokeRect(x, boxY, boxW, boxH);
    // SSR 徽章
    ctx.fillStyle = '#e8a400';
    ctx.fillRect(x + boxW - 74, boxY + 16, 58, 30);
    ctx.fillStyle = '#17171f';
    ctx.font = '800 20px sans-serif';
    ctx.fillText('SSR', x + boxW - 45, boxY + 37);
    // 角色名
    ctx.fillStyle = '#a29a89';
    ctx.font = '700 30px sans-serif';
    ctx.fillText(charById(r.charId).name, x + boxW / 2, boxY + boxH - 34);
    ctx.fillStyle = '#cfc9bc';
    ctx.font = '400 18px sans-serif';
    ctx.fillText('立绘制作中', x + boxW / 2, boxY + boxH - 10);
  });

  const footY = ssrChars.length ? boxY + boxH + 60 : 420;
  ctx.fillStyle = '#17171f';
  ctx.font = '700 34px sans-serif';
  ctx.fillText(`Lv.${save.level} · 打脸 ${save.meta.slaps} 次`, 450, footY);
  ctx.fillStyle = '#6c5ce7';
  ctx.font = '600 28px sans-serif';
  ctx.fillText('「自称准确率 100%」', 450, footY + 100);
  ctx.fillStyle = '#a3a3b0';
  ctx.font = '400 24px sans-serif';
  ctx.fillText(new Date().toLocaleString(), 450, 1120);
  ctx.fillText('仅供娱乐 · 概率为虚拟模拟', 450, 1160);
  const a = document.createElement('a');
  a.download = 'token-gacha-share.png';
  a.href = canvas.toDataURL('image/png');
  a.click();
}

// ================= 背包 · 共享装备 + 强化 + 合成 =================
export function InventoryTab({ save, computed, refresh, toast }: TabProps) {
  void computed;
  const [openSlot, setOpenSlot] = useState<ArtifactSlot | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [fodder, setFodder] = useState<string[]>([]);
  const [synA, setSynA] = useState<string | null>(null);
  const [synB, setSynB] = useState<string | null>(null);
  const [filter, setFilter] = useState<ArtifactSlot | 'all'>('all');
  const [busy, setBusy] = useState(false);

  const equippedUids = new Set(Object.values(save.equipped).filter(Boolean));
  const realArts = save.artifacts.filter(a => !a.fodder && (filter === 'all' || a.slot === filter));
  const realArtsAll = save.artifacts.filter(a => !a.fodder);
  const fodderArts = save.artifacts.filter(a => a.fodder);

  async function equip(uid: string | null, slot: ArtifactSlot) {
    const r = await api('/equip', { method: 'POST', body: { slot, artifactUid: uid } });
    if (!r.ok) { toast(r.error ?? '装备失败'); return; }
    setOpenSlot(null);
    await refresh();
  }

  async function enhance(mode: 'fodder' | 'coins') {
    if (!target) { toast('请先点选目标圣遗物'); return; }
    setBusy(true);
    try {
      const r = await api('/enhance', {
        method: 'POST',
        body: mode === 'fodder' ? { targetUid: target, fodderUids: fodder } : { targetUid: target, coinLevels: 1 },
      });
      if (!r.ok) { toast(r.error ?? '强化失败'); return; }
      toast(`${r.quote ?? ''}${r.changed === 'new_substat' ? ' 新增词条！' : r.changed === 'stat_up' ? ` ${r.statKey} 升级${r.crit ? '（双倍）' : ''}` : ` +${r.levelsGained} 级`}`);
      setFodder([]);
      setTarget(null);
      await refresh();
    } finally { setBusy(false); }
  }

  async function syn() {
    if (!synA || !synB) { toast('请选择两件圣遗物'); return; }
    setBusy(true);
    try {
      const r = await api('/synthesize', { method: 'POST', body: { uidA: synA, uidB: synB } });
      if (!r.ok) { toast(r.error ?? '合成失败'); return; }
      toast(r.success ? '合成成功！获得双词条圣遗物' : '合成失败，两件圣遗物消失了…');
      setSynA(null); setSynB(null);
      await refresh();
    } finally { setBusy(false); }
  }

  return (
    <>
      {/* 共享装备（全员一套） */}
      <div className="tg-card">
        <div className="tg-card-title">全员共享圣遗物（一套装备全员生效）</div>
        {(['flower', 'plume', 'sands', 'goblet', 'circlet'] as ArtifactSlot[]).map(slot => {
          const uid = save.equipped[slot];
          const art = uid ? save.artifacts.find(a => a.uid === uid) : null;
          return (
            <div key={slot} style={{ marginBottom: 6 }}>
              <div className="tg-slot-row" onClick={() => setOpenSlot(openSlot === slot ? null : slot)}>
                <span className="tg-slot-tag">{ARTIFACT_SLOT_NAME[slot]}</span>
                {art ? (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700 }}>{STAT_NAME[art.mainKey]}</span>
                    <span className="tg-muted"> Lv.{art.level}</span>
                    <div className="tg-art-sub" style={{ fontSize: 9.5 }}>
                      {art.substats.map((s, i) => `${STAT_NAME[s.key]}+${(s.value * 100).toFixed(1)}%`).join(' · ')}
                    </div>
                  </div>
                ) : (
                  <div className="tg-muted" style={{ flex: 1 }}>未装备</div>
                )}
              </div>
              {openSlot === slot && (
                <div className="tg-slot-picker">
                  {art && <button className="tg-btn sm ghost" onClick={() => equip(null, slot)}>卸下</button>}
                  {realArts.filter(a => a.slot === slot && !(equippedUids.has(a.uid) && a.uid !== uid)).map(a => (
                    <div key={a.uid} className={`tg-art ${a.uid === uid ? 'sel' : ''}`} onClick={() => equip(a.uid, slot)}>
                      <div className="tg-art-main">{STAT_NAME[a.mainKey]} · Lv.{a.level}</div>
                      <div className="tg-art-sub">{a.substats.map((s, i) => <div key={i}>{STAT_NAME[s.key]} +{(s.value * 100).toFixed(1)}%</div>)}</div>
                    </div>
                  ))}
                  {realArts.filter(a => a.slot === slot).length === 0 && <div className="tg-empty">该部位暂无圣遗物</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 强化 */}
      <div className="tg-card">
        <div className="tg-card-title">
          强化
          <span className="tg-muted">目标 {target ? '1 件' : '未选'} · 狗粮 {fodder.length} 件</span>
        </div>
        <SlotFilter value={filter} onChange={setFilter} />
        <div className="tg-muted" style={{ fontSize: 10, margin: '6px 0' }}>
          点第一件=目标，再点其它=狗粮（已装备的也能用，消耗后自动卸下）
        </div>
        <div className="tg-art-grid">
          {realArts.map(a => {
            const equipped = equippedUids.has(a.uid);
            return (
              <div key={a.uid}
                className={`tg-art ${target === a.uid ? 'sel' : ''} ${fodder.includes(a.uid) ? 'sel' : ''}`}
                onClick={() => {
                  if (target === a.uid) { setTarget(null); return; }
                  if (!target) { setTarget(a.uid); setFodder([]); return; }
                  setFodder(f => f.includes(a.uid) ? f.filter(x => x !== a.uid) : [...f, a.uid]);
                }}>
                <div className="tg-art-main">{ARTIFACT_SLOT_NAME[a.slot]} · {STAT_NAME[a.mainKey]} · Lv.{a.level}</div>
                <div className="tg-art-sub">{a.substats.map((s, i) => <div key={i}>{STAT_NAME[s.key]} +{(s.value * 100).toFixed(1)}%</div>)}</div>
                <div className="tg-art-lv">{equipped ? '已装备' : fodder.includes(a.uid) ? '狗粮' : target === a.uid ? '目标' : ''}</div>
              </div>
            );
          })}
          {realArtsAll.length === 0 && <div className="tg-empty" style={{ gridColumn: '1/-1' }}>还没有真圣遗物——抽卡 SR/SSR 或合成获得</div>}
          {realArtsAll.length > 0 && realArts.length === 0 && <div className="tg-empty" style={{ gridColumn: '1/-1' }}>该部位暂无圣遗物</div>}
        </div>
        {fodderArts.length > 0 && (
          <>
            <div className="tg-muted" style={{ fontSize: 10, margin: '8px 0 4px' }}>无属性狗粮（点选进狗粮栏）：</div>
            <div className="tg-art-grid">
              {fodderArts.map(a => (
                <div key={a.uid} className={`tg-art ${fodder.includes(a.uid) ? 'sel' : ''}`} onClick={() => setFodder(f => f.includes(a.uid) ? f.filter(x => x !== a.uid) : [...f, a.uid])}>
                  <div className="tg-art-main">狗粮 +{a.exp} 经验</div>
                  <div className="tg-art-sub">{fodder.includes(a.uid) ? '已选' : '点选'}</div>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="tg-grid2" style={{ marginTop: 8 }}>
          <button className="tg-btn" disabled={busy || !target || fodder.length === 0} onClick={() => enhance('fodder')}>
            {busy ? <span className="tg-spin" /> : <><IconUp size={14} /> 吃狗粮强化</>}
          </button>
          <button className="tg-btn primary" disabled={busy || !target} onClick={() => enhance('coins')}>
            <IconCoin size={14} /> 代币升级 +1
          </button>
        </div>
      </div>

      {/* 合成 */}
      <div className="tg-card">
        <div className="tg-card-title">合成 · 80% 双词条 / 20% 失败两件消失</div>
        <SlotFilter value={filter} onChange={setFilter} />
        <div className="tg-muted" style={{ fontSize: 10, margin: '6px 0' }}>点两件圣遗物（A 再 B）后合成（已装备的也能用，消耗后自动卸下）</div>
        <div className="tg-art-grid">
          {realArts.map(a => (
            <div key={a.uid}
              className={`tg-art ${synA === a.uid || synB === a.uid ? 'sel' : ''}`}
              onClick={() => {
                if (!synA) setSynA(a.uid);
                else if (a.uid === synA) setSynA(null);
                else if (!synB) setSynB(a.uid);
                else if (a.uid === synB) setSynB(null);
                else { setSynA(a.uid); setSynB(null); }
              }}>
              <div className="tg-art-main">{ARTIFACT_SLOT_NAME[a.slot]} · {STAT_NAME[a.mainKey]} · Lv.{a.level}</div>
              <div className="tg-art-sub">{a.substats.map((s, i) => <div key={i}>{STAT_NAME[s.key]} +{(s.value * 100).toFixed(1)}%</div>)}</div>
              <div className="tg-art-lv">{equippedUids.has(a.uid) ? '已装备' : synA === a.uid ? 'A' : synB === a.uid ? 'B' : ''}</div>
            </div>
          ))}
          {realArtsAll.length === 0 && <div className="tg-empty" style={{ gridColumn: '1/-1' }}>没有可合成的圣遗物</div>}
          {realArtsAll.length > 0 && realArts.length === 0 && <div className="tg-empty" style={{ gridColumn: '1/-1' }}>该部位暂无圣遗物</div>}
        </div>
        <button className="tg-btn primary" style={{ marginTop: 8 }} disabled={busy || !synA || !synB} onClick={syn}>
          {busy ? <span className="tg-spin" /> : <><IconSynth size={14} /> 合成{synA && synB ? '（已选 2 件）' : synA ? '（再选 1 件）' : '（选 2 件）'}</>}
        </button>
      </div>
    </>
  );
}

/** 部件筛选条 */
function SlotFilter({ value, onChange }: { value: ArtifactSlot | 'all'; onChange: (v: ArtifactSlot | 'all') => void }) {
  return (
    <div className="tg-slot-filter" style={{ marginTop: 4 }}>
      {(['all', 'flower', 'plume', 'sands', 'goblet', 'circlet'] as const).map(s => (
        <button key={s} className={`tg-pool-btn ${value === s ? 'on' : ''}`} onClick={() => onChange(s)}>
          {s === 'all' ? '全部' : ARTIFACT_SLOT_NAME[s]}
        </button>
      ))}
    </div>
  );
}

// ================= 图鉴（简洁版）=================
export function RosterTab({ save, computed, refresh, toast }: TabProps) {
  void computed; void refresh; void toast;
  return (
    <>
      <div className="tg-roster">
        {save.chars.map(c => {
          const def = charById(c.charId);
          const weapon = c.weaponId ? save.weapons.find(w => w.weaponId === c.weaponId) : null;
          const pos = save.order.indexOf(c.charId);
          return (
            <div className="tg-char-row" key={c.charId}>
              <Portrait name={def.name} rarity={def.rarity} size={56} hint="" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 12.5 }}>{def.name} <RarityChip rarity={def.rarity} /></div>
                <div className="tg-char-meta">
                  {def.skill?.label ?? (def.aura ? '光环' : def.special ?? '被动')} · 命座 {c.constellation}/6
                </div>
                <div className="tg-char-meta" style={{ marginTop: 2 }}>
                  {weapon
                    ? <span className="tg-chip SSR">已装备 · {weaponById(c.weaponId!)?.name} 精{weapon.refinement}</span>
                    : <span className="tg-chip R">未装备专武</span>}
                </div>
              </div>
              {pos >= 0 ? <span className="tg-chip SSR">{['左', '中', '右'][pos]}位</span> : <span className="tg-chip R">未上场</span>}
            </div>
          );
        })}
      </div>
      <div className="tg-card">
        <div className="tg-card-title">百分百先生</div>
        <div className="tg-muted" style={{ fontSize: 11 }}>
          自称准确率 100% · 已被打脸 {save.meta.slaps} 次 · 道歉券 ×{save.meta.apologyCoupons}
        </div>
      </div>
    </>
  );
}

// ================= API =================
export async function api(path: string, opts: { method?: string; body?: any } = {}): Promise<any> {
  try {
    const res = await fetch(`/token-gacha${path}`, {
      method: opts.method ?? 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
    return await res.json();
  } catch (e) {
    return { ok: false, error: '无法连接插件服务（host 未加载？）' };
  }
}
