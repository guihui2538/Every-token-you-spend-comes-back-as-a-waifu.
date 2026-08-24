/**
 * 每日弹窗：每日首次打开 DSH 时弹出（签到 + 本期卡池广告 + 百分百先生预言）
 * 独立于面板渲染；关闭或签到后调用 POST /popup-shown 消费当日标记。
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { charById, POOLS } from '../game/config';
import type { SaveData } from '../game/types';
import { Portrait } from './components';
import { IconTicket, IconX } from './icons';
import { api } from './tabs';

// 模块级开关（页面加载时由入口组件触发）
const popupStore = { open: false, listeners: new Set<() => void>() };
export function setPopupOpen(v: boolean) {
  popupStore.open = v;
  popupStore.listeners.forEach(l => l());
}
function usePopupOpen() {
  const [open, setO] = React.useState(popupStore.open);
  useEffect(() => {
    const l = () => setO(popupStore.open);
    popupStore.listeners.add(l);
    return () => { popupStore.listeners.delete(l); };
  }, []);
  return open;
}

export function DailyPopup() {
  const open = usePopupOpen();
  const [save, setSave] = useState<SaveData | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [quote, setQuote] = useState('今天的运势？100% 大吉');

  useEffect(() => {
    if (!open) return;
    api('/state').then(r => {
      if (r?.ok) { setSave(r.save); setSignedIn(r.computed.signedInToday); }
    });
    api('/quote').then(r => { if (r?.ok) setQuote(r.quote); });
  }, [open]);

  if (!open) return null;

  const up = save?.gacha.dailyUp;
  const upChar = up ? charById(up.character) : null;
  const best = [...POOLS].reverse().find(p => (save?.level ?? 1) >= p.unlockLevel) ?? POOLS[0];

  const close = () => {
    api('/popup-shown', { method: 'POST' });
    setPopupOpen(false);
  };

  const signin = async () => {
    const r = await api('/signin', { method: 'POST' });
    if (!r.ok) return;
    setSignedIn(true);
    setTimeout(close, 700); // 展示签到结果后关闭
  };

  return createPortal(
    <div className="tg-root">
      <div className="tg-popup" onClick={close}>
        <div className="tg-popup-card" onClick={e => e.stopPropagation()}>
          <div className="tg-popup-hero">
            {upChar && <Portrait name={upChar.name} rarity={upChar.rarity} size={72} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tg-muted" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>今日卡池 · {best.name}</div>
              {upChar && (
                <>
                  <div style={{ fontWeight: 800, fontSize: 15, marginTop: 2 }}>{upChar.name}</div>
                  <div className="tg-muted" style={{ fontSize: 10.5 }}>SSR {(best.ssrRate * 100).toFixed(1)}% · up 占 50%</div>
                </>
              )}
            </div>
            <button className="tg-btn ghost sm" onClick={close} aria-label="关闭弹窗"><IconX size={14} /></button>
          </div>
          <div className="tg-popup-body">
            <div className="tg-quote">「{quote}」 —— 百分百先生</div>
            {signedIn ? (
              <div className="tg-muted" style={{ fontSize: 11.5, textAlign: 'center', padding: 6 }}>
                今日已签到 · 连续 {save?.signIn.streak ?? 0} 天
              </div>
            ) : (
              <button className="tg-btn primary" onClick={signin}>
                <IconTicket size={14} /> 每日签到 · 领 1 抽
              </button>
            )}
            <button className="tg-btn" onClick={close}>先去抽卡看看</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
