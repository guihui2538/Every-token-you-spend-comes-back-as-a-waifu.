<div align="center">

# 🎴 TokenHime

## *Every token you spend comes back as a waifu.*

**基于 token 消耗的二次元抽卡小游戏 · DeepSeek Harness 侧边栏插件**

[![version](https://img.shields.io/badge/version-0.1.0-d93a2b.svg)](./package.json)
[![platform](https://img.shields.io/badge/platform-DSH%20Web-2e5bd6.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![license](https://img.shields.io/badge/license-MIT-e8a400.svg)](./LICENSE)
[![price](https://img.shields.io/badge/%E5%A8%B1%E4%B9%90-%E5%85%8D%E8%B4%B9-1f7a4d.svg)](#-合规红线)

*包豪斯构成 × 复古未来主义 × 小丑牌式数值爆炸*

</div>

---

## 🎴 这是什么？

**你用的每一个 token，都会变成一只怪；你的队伍越强，每只怪掉的钱越多；钱全部扔进卡池，抽 AI 娘。**

Token姬 把你在 DSH 里真实消耗的 token 变成一场持续运转的二次元抽卡游戏——
对话在喂养代码怪，打怪掉落代币与经验，代币拿去抽 AI 娘、强化圣遗物，
队伍变强又反过来提升收益……一个随你的日常使用自然生长的游戏闭环。

> 自称「准确率 100%」的解说员 **百分百先生** 全程陪伴：
> 每次抽卡前他都笃定「这波必出金」，每次歪了他都嘴硬「我的模型不可能错」。
> 打脸计数器，永不缺席。

## 🔄 核心循环

```text
 使用 DSH（消耗 token）
        │ 每 token 按等级比例喂血
        ▼
   ⚔️ 攻击代码怪 ──→ 打掉的血 = 代币 + 经验
        │                 │
        ▼                 ▼
   💥 连击越叠越痛    🎴 代币抽卡（分级卡池）
                          │
                          ▼
   👗 圣遗物强化 ◄── 角色 AI 娘 / 专武 / 狗粮
        │
        ▼
   队伍变强 → 更高伤害上限 → 更高级卡池 ……
```

## ✨ 特性

| | 系统 | 说明 |
|---|---|---|
| ⚡ | **真实 token 经济** | 订阅 DSH tokenUsage 投影，消耗即资源；服务端权威结算 |
| 🃏 | **小丑牌式战斗** | 3 名角色=小丑卡，从左到右依次加 buff；加攻在前、×总伤在后，顺序决定数值；赌场式滚动数字动画 |
| 🐲 | **单只世界怪** | token 按等级比例喂血，打多少得多少；血空了继续用 DSH 补 |
| 🔒 | **等级锁** | 单回合伤害上限 = 等级×5000，升级才解锁更多产出与更高卡池 |
| 🎴 | **分级卡池** | 基础 0.6% → 进阶 1.2% → 精英 2.5% → 传说 5%（封顶），独立保底，每日 UP 轮换 |
| 👧 | **12 名 AI 娘** | DeepSeek娘/GPT娘/Claude娘/o3娘/Kimi娘……技能梗拉满，命座×6、专武精炼 |
| 💎 | **圣遗物** | 全员共享一套 5 部位；无属性狗粮直接吃、代币直升、双件合成（80% 双词条 / 20% 血本无归）、最多 4 词条随机倍率 |
| 📅 | **每日签到弹窗** | 每天 1 抽，连签 7 天送十连券；附带卡池广告位与今日预言 |
| 🎙 | **百分百先生** | 语录库 + 打脸计数器 + 道歉券（连续翻车 5 次发放） |
| 🖼 | **分享卡** | 十连出金一键生成 PNG 分享图（3:4，社区友好） |
| 🧭 | **新手教程** | DeepSeek娘 白色对话框分步引导 |

## 🎨 角色立绘

首批已完成 **Claude娘 / GPT娘 / DeepSeek娘** 三张 Q 版立绘与卡池海报；
其余角色当前为白色占位框（立绘绘制中），不影响任何玩法。

## 📦 安装

> 需要 DSH Web（`dsh web`）0.1.0-rc.6 或更新版本。

**方式一：插件市场（推荐）**
打开 DSH 设置 → **插件市场** → 搜索 「Token姬」 → 一键安装

**方式二：命令行**
```sh
git clone <your-repo-url> dsh-plugin-token-gacha
cd dsh-plugin-token-gacha && pnpm install && node scripts/build.mjs
dsh plugin --profile web add .
```

安装后重启 `dsh web`，刷新页面——侧边栏底部出现 **Token姬** 入口。

存档位置：`~/.dsh-token-gacha/save.json`（删除即重置开荒）。

## 🛠️ 本地开发

```bash
pnpm install               # 安装依赖（esbuild / typescript）
node scripts/build.mjs     # 构建 lib/index.js + lib/client.js
node scripts/build.mjs --watch
npx tsc --noEmit           # 类型检查
node test/smoke.mjs        # host 冒烟测试（34 项）
node test/client-smoke.mjs # client 冒烟测试（11 项）
```

> 测试会临时读写 `~/.dsh-token-gacha/save.json`，建议在 GUI 关闭时运行。

## ⚖️ 合规红线

- 只用**虚拟代币**：零真实货币、零彩票、零充值入口
- 界面明示「仅供娱乐 · 概率为虚拟模拟」
- 彩蛋反赌：累计失败 100 次，百分百先生会说「别赌了，去写代码吧」
- 角色为原创 Q 版拟人化戏仿，不含真实商标形象

## 📄 License

[MIT](./LICENSE)

---

<div align="center">
<sub>Made with 💜 by Token姬 · Powered by DeepSeek Harness Plugin System</sub>
</div>
