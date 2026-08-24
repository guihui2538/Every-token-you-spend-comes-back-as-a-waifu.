/**
 * 通用组件：角色立绘（有立绘用图片，否则白色占位）、稀有度标签、弹窗按钮、3D 悬浮卡牌等
 */
import React from 'react';
import type { Rarity } from '../game/types';
import { charImages } from './portraits';

/** 角色立绘：优先显示已裁剪的 Q 版立绘，否则白色占位 */
export function Portrait({ name, rarity, size = 64, hint = '立绘制作中', face = true }: {
  name: string; rarity?: Rarity; size?: number; hint?: string; face?: boolean;
}) {
  const img = charImages[name];
  if (img) {
    return (
      <img className="tg-portrait-img" src={img} alt={name}
        style={{ width: size, height: size, objectFit: 'cover', objectPosition: face ? '50% 18%' : '50% 50%' }} />
    );
  }
  return (
    <div className="tg-portrait" style={{ width: size, height: size }} aria-label={`${name} 立绘占位`}>
      <span className="tg-p-name">{name}</span>
      <span className="tg-p-hint">{hint}</span>
      {rarity && <span className={`tg-p-rarity tg-chip ${rarity}`}>{rarity}</span>}
    </div>
  );
}

export function RarityChip({ rarity }: { rarity: Rarity }) {
  return <span className={`tg-chip ${rarity}`}>{rarity}</span>;
}

export function Stat({ label, value, sub, children }: {
  label: string; value?: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <div className="tg-stat">
      <div className="tg-stat-label">{label}</div>
      <div className="tg-stat-value">{value}{sub && <small> {sub}</small>}</div>
      {children}
    </div>
  );
}

export function Bar({ pct, accent }: { pct: number; accent?: boolean }) {
  return (
    <div className={accent ? 'tg-bar' : 'tg-xp-bar'}>
      <i style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/** 稀有度→概率文案 */
export function rateOf(ssrRate: number): string {
  return `SSR ${(ssrRate * 100).toFixed(1)}%`;
}

/** 3D 悬浮卡牌：鼠标跟随倾斜 + 悬浮 */
/** 悬浮卡牌（去旋转，避免向右出框；hover 上浮由 CSS 实现） */
export function TiltCard({ children, className, style }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <div className={`tg-tilt ${className ?? ''}`} style={style}>
      {children}
    </div>
  );
}
