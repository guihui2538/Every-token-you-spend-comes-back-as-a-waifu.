// 市场收录：创建 awesome-dsh-plugin 的 fork（用本机 GitHub 凭据）
import { readFileSync } from 'node:fs';

const token = readFileSync(new URL('../.gh-token', import.meta.url), 'utf8').trim();
const H = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'tokenhime-publisher',
  'X-GitHub-Api-Version': '2022-11-28',
};

const api = async (url, opts = {}) => {
  const r = await fetch(url, { headers: H, ...opts });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const me = await api('https://api.github.com/user');
console.log('认证账号:', me.body.login ?? me.body.message);

if (me.body.login !== 'guihui2538') {
  console.error('凭据账号与预期不符，中止');
  process.exit(1);
}

const fork = await api('https://api.github.com/repos/awesome-dsh-plugin/awesome-dsh-plugin/forks', { method: 'POST' });
console.log('fork 请求:', fork.body.full_name ?? fork.body.message);

// 轮询等待 fork 就绪（fork 是异步的）
for (let i = 0; i < 24; i++) {
  await new Promise(r => setTimeout(r, 5000));
  const f = await api('https://api.github.com/repos/guihui2538/awesome-dsh-plugin');
  if (f.status === 200 && f.body.full_name) {
    console.log('fork 就绪:', f.body.full_name, '默认分支:', f.body.default_branch);
    process.exit(0);
  }
}
console.error('fork 超时未就绪');
process.exit(1);
