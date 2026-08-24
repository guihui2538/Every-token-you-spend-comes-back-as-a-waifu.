/**
 * 内联 SVG 图标（无 emoji，遵循设计规范）
 */
import React from 'react';

type P = { size?: number; className?: string };

function base(size: number, children: React.ReactNode, filled = false) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'} strokeWidth={2.4} strokeLinecap="square" strokeLinejoin="miter"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** 合成（两件圣遗物合一） */
export const IconSynth = ({ size = 16, className }: P) => base(size, (
  <>
    <path d="M5 4h7v7H5zM12 13h7v7h-7z" />
    <path d="M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5" />
  </>
), true);

/** 升级（向上箭头 + 方块） */
export const IconUp = ({ size = 16, className }: P) => base(size, (
  <>
    <path d="M12 20V6" />
    <path d="m6 12 6-7 6 7" />
    <rect x="10" y="2" width="4" height="3" />
  </>
));

export const IconCoin = ({ size = 16, className }: P) => base(size, (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9 9.5h4.2a1.8 1.8 0 0 1 0 3.6H9m0-3.6v6.8m0-6.8h2.1" />
  </>
), true);

export const IconSword = ({ size = 16, className }: P) => base(size, (
  <>
    <path d="M14.5 3.5 20.5 9.5" />
    <path d="M4 20c2.5-1 5-2 8-5l-3-3c-3 3-4 5.5-5 8Z" />
    <path d="m11 12 6-6" />
  </>
));

export const IconGacha = ({ size = 16, className }: P) => base(size, (
  <>
    <rect x="4.5" y="2.5" width="15" height="19" rx="7.5" />
    <path d="M9 9h6M9 13h6" />
  </>
));

export const IconBag = ({ size = 16, className }: P) => base(size, (
  <>
    <path d="M4.5 8.5h15v11h-15z" />
    <path d="M8.5 8.5V7a3.5 3.5 0 0 1 7 0v1.5" />
  </>
));

export const IconBook = ({ size = 16, className }: P) => base(size, (
  <>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21Z" />
    <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" />
  </>
));

export const IconShare = ({ size = 16, className }: P) => base(size, (
  <>
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="17.5" cy="5.5" r="2.5" />
    <circle cx="17.5" cy="18.5" r="2.5" />
    <path d="m8.3 10.8 7-4m-7 6.4 7 4" />
  </>
));

export const IconX = ({ size = 16, className }: P) => base(size, (
  <><path d="m6 6 12 12M18 6 6 18" /></>
));

export const IconSpark = ({ size = 16, className }: P) => base(size, (
  <>
    <path d="M12 3c.6 3.8 2.4 6.6 6 8-3.6 1.4-5.4 4.2-6 8-.6-3.8-2.4-6.6-6-8 3.6-1.4 5.4-4.2 6-8Z" />
  </>
), true);

export const IconTicket = ({ size = 16, className }: P) => base(size, (
  <>
    <path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h13a2 2 0 0 1 2 2 2.5 2.5 0 0 0 0 5 2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2 2.5 2.5 0 0 0 0-5Z" />
    <path d="M14 6.5v11" />
  </>
));

export const IconLock = ({ size = 16, className }: P) => base(size, (
  <>
    <rect x="5.5" y="10.5" width="13" height="9.5" rx="2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </>
));

export const IconCheck = ({ size = 16, className }: P) => base(size, (
  <path d="m5 12.5 4.5 4.5L19 7.5" />
));

export const IconChevron = ({ size = 16, className }: P) => base(size, (
  <path d="m9 6 6 6-6 6" />
));

export const IconLevel = ({ size = 16, className }: P) => base(size, (
  <>
    <path d="M4 20V9l8-5 8 5v11" />
    <path d="M4 20h16M9 20v-6h6v6" />
  </>
), true);
