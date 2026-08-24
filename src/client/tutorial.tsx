/**
 * 新手教程：DeepSeek娘 形象 + 白色对话框引导
 */
import React, { useState } from 'react';
import { Portrait } from './components';
import { api } from './tabs';

const STEPS = [
  '嗨，我是 DeepSeek娘！欢迎来到 Token姬——在这里，你用掉的每一个 DSH token 都不是账单，而是游戏资源。',
  '机制① 喂血：你每消耗一定量的 token，战斗页那只代码怪的 HP 就会自动上涨。血量就是它的「可掠夺资产」。',
  '机制② 战斗：切到「战斗」页点「攻击」。你的 3 名角色会从左到右依次点亮、施加各自的 buff，大数字滚动后砸向怪物。',
  '策略 排序：加攻击的角色放左位，×总伤的放右位——乘法会放大前面的加法，顺序不同伤害天差地别。点「调整上场顺序」即可拖拽换位。',
  '机制③ 上限与等级：单回合伤害有上限（等级 ×5000），打怪得经验升级，等级越高上限越高、怪物也越强。',
  '机制④ 收益：打掉多少血就按比例结算代币和经验；血打空了别慌，继续正常使用 DSH 它就会自动补血。',
  '指引 抽卡：攒够代币去「抽卡」页。池子按账号等级逐级解锁（基础→进阶→精英→传说），SSR 概率递增、保底独立计算，每日还有 UP 轮换。',
  '指引 圣遗物：「背包」页给全队共享的 5 个部位穿装备；无属性狗粮直接喂养升级，狗粮不够可以纯代币直升；两件合成有几率出双词条（也有 20% 概率血本无归…）。',
  '伙伴 百分百先生：那位自称准确率 100% 的解说员会预测每次结果。他翻车会涨「打脸计数」，连翻 5 次你还能收到道歉券。',
  '最后 别忘了每天签到领抽卡券（连签 7 天送十连券）！现在就去「战斗」页点下第一次攻击吧，开始你的抽卡人生！',
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
