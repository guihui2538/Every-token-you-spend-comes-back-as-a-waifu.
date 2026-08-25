// 创建市场收录 PR
import { readFileSync } from 'node:fs';

const token = readFileSync(new URL('../.gh-token', import.meta.url), 'utf8').trim();
const H = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'tokenhime-publisher',
  'X-GitHub-Api-Version': '2022-11-28',
};

const body = {
  title: 'Add Token姬 (token gacha game) plugin to fun category',
  head: 'guihui2538:add-tokenhime',
  base: 'main',
  body: [
    '## What',
    'Add [Token姬 · 抽卡计划](https://github.com/guihui2538/Every-token-you-spend-comes-back-as-a-waifu.) to the `fun` category — a DSH sidebar gacha game that turns real token usage into monsters, coins and AI waifu pulls.',
    '',
    '## Checklist',
    '- [x] One YAML file per plugin: `data/plugins/guihui2538__Every-token-you-spend-comes-back-as-a-waifu..yml`',
    '- [x] Regenerated both READMEs via `node scripts/generate-readme.mjs`',
    '- [x] `description.en` present; `zh` provided',
    '- [x] npm package published: [`dsh-plugin-token-gacha`](https://www.npmjs.com/package/dsh-plugin-token-gacha)',
    '',
    '> Note: the repo name intentionally ends with a period (matches the slogan "Every token you spend comes back as a waifu."); the plugin is also on npm as `dsh-plugin-token-gacha` which the market will use for installs.',
  ].join('\n'),
};

const r = await fetch('https://api.github.com/repos/awesome-dsh-plugin/awesome-dsh-plugin/pulls', {
  method: 'POST', headers: H, body: JSON.stringify(body),
});
const j = await r.json();
if (r.status >= 200 && r.status < 300 && j.html_url) {
  console.log('PR 已创建:', j.html_url);
  console.log('PR 编号:', j.number);
} else {
  console.error('PR 失败:', r.status, j.message ?? JSON.stringify(j));
  process.exit(1);
}
