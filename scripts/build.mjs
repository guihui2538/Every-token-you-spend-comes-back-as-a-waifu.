// 打包脚本：产出 host 端（lib/index.js）与浏览器端（lib/client.js）。
// 浏览器端产物形态参照 dsh-plugin-wallpaper-engine：
//   window.__ModuleLoader__.load({ id, factory: (require) => { <CJS bundle> } })
// 其中 react / react-dom 保持 external，运行时由 DSH client 模块注册表解析。

import { build, context } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_ID = 'dsh-plugin-token-gacha';
const watch = process.argv.includes('--watch');

async function buildHost() {
  const options = {
    entryPoints: [join(root, 'src/host/index.ts')],
    outfile: join(root, 'lib/index.js'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    packages: 'external', // cordis / dsh-* 由 profile 的 node_modules 解析
    sourcemap: false,
  };
  if (watch) {
    const ctx = await context(options);
    await ctx.watch();
    return ctx;
  }
  await build(options);
}

async function buildClient() {
  const options = {
    entryPoints: [join(root, 'src/client/index.tsx')],
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    jsx: 'transform',                 // classic：JSX → React.createElement，避免依赖 react/jsx-runtime 注册
    external: ['react', 'react-dom'], // 运行时由 DSH client 模块注册表提供
    loader: { '.css': 'text', '.png': 'dataurl' }, // 样式内联 + 立绘转 base64 内联
    write: false,
  };
  const buildFn = watch ? (async () => {
    const ctx = await context(options);
    const r = await ctx.rebuild();
    await emit(r);
    await ctx.watch();
    return ctx;
  }) : (async () => { const r = await build(options); await emit(r); });

  async function emit(result) {
    const code = result.outputFiles[0].text;
    // ModuleLoader 的 factory 只提供 require，必须自带 module/exports 垫片
    // （esbuild cjs 输出依赖 module.exports，参照 wallpaper-engine 的包装方式）
    const wrapped = `window.__ModuleLoader__.load({\n  id: ${JSON.stringify(CLIENT_ID)},\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;\n${code}\n    return module.exports;\n  },\n});\n`;
    await mkdir(join(root, 'lib'), { recursive: true });
    await writeFile(join(root, 'lib/client.js'), wrapped);
    console.log('[token-gacha] lib/client.js written');
  }

  await buildFn();
}

await mkdir(join(root, 'lib'), { recursive: true });
const contexts = [await buildHost(), await buildClient()];
if (!watch) {
  console.log('[token-gacha] build done');
  process.exit(0);
}
console.log('[token-gacha] watching...');
