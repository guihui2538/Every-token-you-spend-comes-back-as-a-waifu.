/**
 * 客户端冒烟测试：在 vm 沙箱里模拟 ModuleLoader 加载 lib/client.js，
 * 验证：包装格式、exports（apply/inject）、slot 注入注册不抛错。
 * 运行：node test/client-smoke.mjs
 */
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

let pass = 0;
let fail = 0;
const assert = (cond, msg) => {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.error(`  ✗ ${msg}`); }
};

const code = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

let captured = null;
const sandbox = {
  window: { __ModuleLoader__: { load: (def) => { captured = def; } } },
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  document: undefined, // 浏览器外无 DOM，样式注入应被 guard 跳过
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

assert(captured !== null, 'bundle 调用了 window.__ModuleLoader__.load');
assert(captured?.id === 'dsh-plugin-token-gacha', `load id 正确（${captured?.id}）`);
assert(typeof captured?.factory === 'function', 'factory 是函数');

// 模拟 loader 的 require：react / react-dom 由注册表提供
const reactStub = {
  createElement: () => ({}),
  Fragment: Symbol('frag'),
  useState: () => [undefined, () => {}],
  useEffect: () => {},
  useRef: () => ({ current: undefined }),
  useCallback: (f) => f,
  useMemo: (f) => f(),
  default: {},
};
const requireStub = (id) => {
  // 只允许 react / react-dom（与注册表一致）；react/jsx-runtime 出现即视为回归
  if (id === 'react' || id === 'react-dom') return reactStub;
  throw new Error('unexpected require: ' + id);
};

let mod;
try {
  mod = captured.factory(requireStub);
  assert(true, 'factory 执行无异常（module/exports 垫片正常）');
} catch (e) {
  assert(false, `factory 抛错：${e.message}`);
  process.exit(1);
}

assert(mod && typeof mod.apply === 'function', 'exports.apply 存在');
assert(Array.isArray(mod.inject) && mod.inject.includes('slots'), 'exports.inject 含 slots');

// apply：注入侧边栏底部入口（sidebar.footer.action）
const injected = [];
let regCfg = null;
let regComp = null;
const ctx = {
  slots: {
    inject: (key, factory) => { injected.push({ key, factory }); return () => {}; },
    register: (cfg, comp) => { regCfg = cfg; regComp = comp; return () => {}; },
  },
  effect: (fn) => fn(),
};
mod.apply(ctx);
assert(injected.length === 1, `注入 1 个入口（实际 ${injected.length}）`);
assert(injected[0].key === 'sidebar.footer.action', '入口：sidebar.footer.action');

// 执行注入工厂 → 内部调用 ctx.slots.register（必须携带唯一 id）
regCfg = null; regComp = null;
injected[0].factory();
assert(regCfg?.name === 'sidebar.footer.action', '注册 name 正确');
assert(regCfg?.id === 'token-gacha', '注册 id 唯一（token-gacha）');
assert(typeof regComp === 'function', '注册组件为函数');

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
