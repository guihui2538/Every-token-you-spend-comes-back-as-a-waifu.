/**
 * Token姬·抽卡计划 — 客户端入口
 * 构建脚本会把本文件包进 window.__ModuleLoader__.load({ id, factory })，
 * 通过 DSH client slot 系统注入侧边栏底部操作区（sidebar.footer.action）。
 * 页面加载时若为每日首次，自动弹出签到/卡池广告弹窗（DailyPopup）。
 * 注意：list 槽位注册必须携带唯一 id（参照 dsh-client-ui-cordis）。
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { Panel } from './App';
import { DailyPopup, setPopupOpen } from './popup';
import { IconGacha } from './icons';
import cssText from './styles.css';

// 注入样式（esbuild loader: css → text）
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = cssText;
  style.setAttribute('data-token-gacha', '');
  document.head.appendChild(style);
}

/** 客户端服务依赖（slot 系统） */
export const inject = ['slots'];

export function apply(ctx: any) {
  if (!ctx.slots) {
    console.warn('[token-gacha] slots 服务不可用，入口未注入');
    return;
  }
  ctx.effect(
    () => ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'token-gacha',
    }, EntryButton)),
    'token-gacha: sidebar entry',
  );
}

// ===== 面板开关（模块级共享）=====
const store = { open: false, listeners: new Set<() => void>() };
function setOpen(v: boolean) {
  store.open = v;
  store.listeners.forEach(l => l());
}
function useOpen() {
  const [open, setO] = React.useState(store.open);
  React.useEffect(() => {
    const l = () => setO(store.open);
    store.listeners.add(l);
    return () => { store.listeners.delete(l); };
  }, []);
  return open;
}

function EntryButton() {
  const open = useOpen();
  const [coins, setCoins] = React.useState<number | null>(null);
  const popupChecked = React.useRef(false);

  React.useEffect(() => {
    let alive = true;
    const load = async (first: boolean) => {
      try {
        const r = await fetch('/token-gacha/state', { cache: 'no-store' }).then(res => res.json());
        if (!alive || !r?.ok) return;
        setCoins(r.save.economy.coins);
        // 每日首次：页面加载时只检查一次弹窗标记（避免轮询重复触发）
        if (first && !popupChecked.current) {
          popupChecked.current = true;
          if (r.computed.showPopup) setPopupOpen(true);
        }
      } catch { /* host 未加载 */ }
    };
    load(true);
    const t = setInterval(() => load(false), 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <React.Fragment>
      <button
        className="tg-entry-btn"
        onClick={() => setOpen(!open)}
        aria-label="Token姬 抽卡计划"
        title={`Token姬 · 代币 ${coins ?? 0}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          border: '1px solid var(--tg-border, #17130e)', background: 'var(--tg-surface, #fbf7ec)',
          color: 'var(--tg-text, #17130e)', borderRadius: 2, padding: '8px 12px',
          cursor: 'pointer', fontSize: 12, fontWeight: 800, minHeight: 36,
        }}
      >
        <IconGacha size={15} />
        <span>Token姬</span>
      </button>
      {open && createPortal(
        <React.Fragment>
          <div className="tg-scrim" onClick={() => setOpen(false)} />
          <Panel onClose={() => setOpen(false)} />
        </React.Fragment>,
        document.body,
      )}
      <DailyPopup />
    </React.Fragment>
  );
}
