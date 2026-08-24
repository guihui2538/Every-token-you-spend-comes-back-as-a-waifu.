/**
 * 面板外壳：仪表盘 + 五个 Tab + 每日弹窗 + Toast
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { StateResponse } from '../game/types';
import { Bar, fmt, Stat } from './components';
import { IconBag, IconBook, IconCoin, IconGacha, IconLevel, IconSword, IconTicket, IconX } from './icons';
import { api, GachaTab, HomeTab, InventoryTab, RosterTab } from './tabs';
import { Tutorial } from './tutorial';

type TabId = 'home' | 'gacha' | 'bag' | 'roster';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: '战斗', icon: <IconSword size={15} /> },
  { id: 'gacha', label: '抽卡', icon: <IconGacha size={15} /> },
  { id: 'bag', label: '背包', icon: <IconBag size={15} /> },
  { id: 'roster', label: '图鉴', icon: <IconBook size={15} /> },
];

export function Panel({ onClose }: { onClose?: () => void }) {
  const [state, setState] = useState<StateResponse | null>(null);
  const [tab, setTab] = useState<TabId>('home');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const toastTimer = useRef<any>(null);

  const refresh = useCallback(async () => {
    const r = await api('/state');
    if (r.ok) { setState(r); }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [refresh]);

  // 首次打开且未看过教程 → 显示新手教程
  useEffect(() => {
    if (state?.ok && !state.save.meta.tutorialSeen && !showTutorial) {
      setShowTutorial(true);
    }
  }, [state, showTutorial]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3200);
  }, []);

  if (!state) {
    return (
      <div className="tg-root tg-panel" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <span className="tg-spin" /> <span className="tg-muted" style={{ marginLeft: 8 }}>Token姬 加载中…</span>
      </div>
    );
  }

  const { save, computed } = state;

  async function signin() {
    const r = await api('/signin', { method: 'POST' });
    if (!r.ok) { toast(r.error ?? '签到失败'); return; }
    toast(`签到成功${r.streak % 7 === 0 ? '，连续 7 天获得十连券！' : ''}（连续 ${r.streak} 天）`);
    await refresh();
  }

  const tabProps = { save, computed, refresh, toast };

  return (
    <div className="tg-root">
      <div className="tg-panel">
        {/* 头部 */}
        <div className="tg-header">
          <IconGacha size={18} className="tg-rarity-SSR" />
          <div className="tg-header-title">
            Token姬
            <div className="tg-header-sub">每一次对话，都在喂养你的乐园</div>
          </div>
          {!computed.signedInToday && (
            <button className="tg-btn sm" style={{ minHeight: 28 }} onClick={signin}>
              <IconTicket size={13} /> 签到
            </button>
          )}
          {onClose && (
            <button className="tg-btn ghost sm" onClick={onClose} aria-label="关闭">
              <IconX size={14} />
            </button>
          )}
        </div>

        <div className="tg-body">
          {/* 仪表盘 */}
          <div className="tg-dash">
            <div className="tg-stat" style={{ gridColumn: '1 / -1' }}>
              <div className="tg-stat-label"><IconLevel size={12} /> 账号等级 Lv.{save.level} · 经验 {fmt(Math.floor(save.exp))}/{fmt(save.level * 500)}</div>
              <Bar pct={(save.exp / (save.level * 500)) * 100} />
              <div className="tg-muted" style={{ fontSize: 10, marginTop: 4 }}>
                单回合伤害上限 {fmt(computed.damageCap)} · 怪物 HP {fmt(save.monster.hp)}
              </div>
            </div>
            <Stat label="代币" value={fmt(save.economy.coins)} sub={<IconCoin size={11} />} />
            <Stat label="队伍 DPS" value={fmt(computed.dps)} />
            <Stat label="喂血比例" value={computed.hpPerToken.toFixed(3)} sub="HP/每 token" />
            <Stat label="奖励" value={computed.coinPerHp.toFixed(1)} sub="代币/每 HP" />
          </div>

          {/* Tab 栏 */}
          <div className="tg-tabs" role="tablist">
            {TABS.map(t => (
              <button key={t.id} role="tab" aria-selected={tab === t.id}
                className={`tg-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'home' && <HomeTab {...tabProps} />}
          {tab === 'gacha' && <GachaTab {...tabProps} />}
          {tab === 'bag' && <InventoryTab {...tabProps} />}
          {tab === 'roster' && <RosterTab {...tabProps} />}

          <div className="tg-muted" style={{ fontSize: 9.5, textAlign: 'center', padding: '4px 0 8px', letterSpacing: '1.2px' }}>
            仅供娱乐 · 概率为虚拟模拟 · 每一次消耗，都在喂养代码怪
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastMsg && <div className="tg-toast">{toastMsg}</div>}
      {/* 新手教程 */}
      {showTutorial && (
        <Tutorial onDone={() => { setShowTutorial(false); refresh(); }} />
      )}
    </div>
  );
}

