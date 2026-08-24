/**
 * 新手教程：DeepSeek娘 形象 + 白色对话框引导
 */
import React, { useState } from 'react';
import { Portrait } from './components';
import { api } from './tabs';

const STEPS = [
  '嗨，我是 DeepSeek娘！欢迎来到 Token姬——把 DSH 的使用量变成抽卡乐园。',
  '你每用 1 个 token，代码怪就会多一点血；血能换成代币和经验。',
  '在「战斗」页点「攻击」，角色从左到右依次点亮、数字滚动，打掉的血换成奖励。',
  '代币去「抽卡」：抽到 SSR 就能组队上场，还能解锁更高级的卡池。',
  '把角色拖到左/中/右，或左键点击角色选位——顺序决定 buff 加成，加攻在前、×总伤在后更疼。',
  '别忘每天签到领抽卡券。去「战斗」里试一次吧，开始！',
];

export function Tutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i === STEPS.length - 1;

  function finish() {
    api('/tutorial-done', { method: 'POST' });
    onDone();
  }

  return (
    <div className="tg-root">
      <div className="tg-tutorial">
        <div className="tg-tutorial-card">
          <div className="tg-tutorial-hero">
            <Portrait name="DeepSeek娘" size={132} />
          </div>
          <div className="tg-tutorial-dialog">
            <div className="tg-tutorial-name">DeepSeek娘</div>
            <div className="tg-tutorial-text">{STEPS[i]}</div>
          </div>
          <div className="tg-tutorial-actions">
            <span className="tg-tutorial-step">{i + 1} / {STEPS.length}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="tg-btn sm" disabled={i === 0} onClick={() => setI(x => x - 1)}>上一页</button>
              {last ? (
                <button className="tg-btn sm primary" style={{ width: 'auto' }} onClick={finish}>开始！</button>
              ) : (
                <button className="tg-btn sm primary" style={{ width: 'auto' }} onClick={() => setI(x => x + 1)}>下一页</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
