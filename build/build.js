#!/usr/bin/env node
'use strict';

/* =========================================================================
   破界 · 打砖块 —— 单文件 HTML 构建脚本
   ------------------------------------------------------------------------
   作用：把 src/ 下的页面、样式、脚本全部“内联”进一个自包含的 HTML 文件，
         输出到 dist/破界打砖块.html，普通用户双击就能在浏览器里玩，
         也方便放进 GitHub Release 里分发。

   约束：只用 Node 内置模块（fs / path），不引入任何第三方依赖；
         不修改 src/ 下的任何文件（只读）。

   用法：node build/build.js
   ========================================================================= */

/* electron / electron-builder 的二进制下载走 npmmirror 镜像（国内网络必需）。
   与 .npmrc 里的配置双保险；构建期以 .npmrc / 显式导出的环境变量为准。 */
process.env.ELECTRON_MIRROR =
  process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/';
process.env.ELECTRON_BUILDER_BINARIES_MIRROR =
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||
  'https://npmmirror.com/mirrors/electron-builder-binaries/';

const fs = require('fs');
const path = require('path');

/* -------------------------------------------------------------------------
   路径：全部用 path.join 拼接，绝不手写反斜杠（中文路径 + Windows 最容易翻车）
   ------------------------------------------------------------------------- */
const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const OUTPUT_FILE = path.join(DIST_DIR, '破界打砖块.html');

/* 版本号从 package.json 读，单一数据源 */
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));

const BUILD_INFO = {
  name: pkg.name,
  version: pkg.version,
  productName: pkg.productName || '破界打砖块',
  builtAt: new Date().toISOString()
};

/* 收集过程中的告警，最后统一打印 */
const warnings = [];
const inlined = [];

/* -------------------------------------------------------------------------
   小工具
   ------------------------------------------------------------------------- */

/** 读文本文件；不存在返回 null（不抛异常，方便处理“源码还没写好”的情况）。 */
function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

/** 常见图片/音视频的 MIME 表，用于把本地资源转成 data URI。 */
const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

/* 单个资源超过这个大小就不内联了，避免单文件体积失控 */
const MAX_INLINE_BYTES = 2 * 1024 * 1024;

/**
 * 把相对引用解析成本地文件：
 * 先按引用所在目录找，再退到项目根（含 assets/），最后试 assets/ 同名文件。
 * 找不到返回 null（保持原引用不动）。
 */
function resolveAsset(ref, baseDir) {
  if (!ref) return null;
  const trimmed = ref.trim();
  if (!trimmed) return null;
  if (/^(data:|https?:|\/\/|#|\/)/i.test(trimmed)) return null;

  const clean = trimmed.split(/[?#]/)[0];
  if (!clean) return null;

  const candidates = [
    path.resolve(baseDir, clean),
    path.resolve(ROOT_DIR, clean),
    path.resolve(ASSETS_DIR, path.basename(clean))
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    } catch (err) {
      /* 忽略：当作不存在 */
    }
  }
  return null;
}

/** 本地文件 -> data URI；类型不支持或太大返回 null。 */
function toDataUri(file) {
  const mime = MIME_TYPES[path.extname(file).toLowerCase()];
  if (!mime) return null;
  let stat;
  try {
    stat = fs.statSync(file);
  } catch (err) {
    return null;
  }
  if (stat.size > MAX_INLINE_BYTES) {
    warnings.push(`资源过大未内联（>${MAX_INLINE_BYTES} 字节）：${path.relative(ROOT_DIR, file)}`);
    return null;
  }
  const buffer = fs.readFileSync(file);
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

/* -------------------------------------------------------------------------
   步骤 1：把 CSS 里的 url(...) 资源内联成 data URI
   ------------------------------------------------------------------------- */
function inlineCssAssets(css) {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, ref) => {
    const file = resolveAsset(ref, SRC_DIR);
    if (!file) return match;
    const uri = toDataUri(file);
    if (!uri) return match;
    inlined.push(path.relative(ROOT_DIR, file));
    return `url("${uri}")`;
  });
}

/* -------------------------------------------------------------------------
   步骤 2：把 HTML 里 <img>/<audio>/<video>/<source> 的 src 内联成 data URI
   ------------------------------------------------------------------------- */
function inlineHtmlAssets(html) {
  return html.replace(
    /(<(?:img|audio|video|source)\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi,
    (match, head, quote, ref) => {
      const file = resolveAsset(ref, SRC_DIR);
      if (!file) return match;
      const uri = toDataUri(file);
      if (!uri) return match;
      inlined.push(path.relative(ROOT_DIR, file));
      return `${head}${quote}${uri}${quote}`;
    }
  );
}

/* -------------------------------------------------------------------------
   步骤 3：<link rel="stylesheet" href="styles.css">  ->  <style>…</style>
   ------------------------------------------------------------------------- */
function inlineStylesheet(html) {
  let count = 0;
  const out = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const href = /\bhref\s*=\s*(["'])([^"']+)\1/i.exec(tag);
    if (!href) return tag;
    const rel = /\brel\s*=\s*(["'])([^"']+)\1/i.exec(tag);
    if (rel && !/stylesheet/i.test(rel[2])) return tag;

    const file = path.resolve(SRC_DIR, href[2]);
    const css = readText(file);
    if (css === null) {
      warnings.push(`找不到样式文件（已保留原 <link>）：${href[2]}`);
      return tag;
    }
    count += 1;
    return `<style>\n/* ${href[2]} */\n${inlineCssAssets(css)}\n</style>`;
  });
  return { html: out, count };
}

/* -------------------------------------------------------------------------
   步骤 4：<script src="js/xxx.js"></script>  ->  <script>…</script>
   ------------------------------------------------------------------------- */
function inlineScripts(html) {
  let count = 0;
  const out = html.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (full, attrs, body) => {
      const src = /\bsrc\s*=\s*(["'])([^"']+)\1/i.exec(attrs);
      if (!src) return full; // 本来就是内联脚本，原样保留

      const rel = src[2];
      const file = path.resolve(SRC_DIR, rel);
      const code = readText(file);
      if (code === null) {
        warnings.push(`找不到脚本文件（已注入空占位）：${rel}`);
        return `<script>\n/* [pojie-build] 缺少源文件：${rel} */\n</script>`;
      }

      // 内联到 <script> 里时，源码里出现 </script> 会提前闭合标签，必须转义
      const safe = code.replace(/<\/script/gi, '<\\/script');
      const typeAttr = /\btype\s*=\s*(["'])([^"']+)\1/i.exec(attrs);
      const typePart = typeAttr ? ` type="${typeAttr[2]}"` : '';

      count += 1;
      return `<script${typePart}>\n/* ${rel} */\n${safe}\n</script>`;
    }
  );
  return { html: out, count };
}

/* -------------------------------------------------------------------------
   步骤 5：在 </head> 前注入 generator meta
   ------------------------------------------------------------------------- */
function injectMeta(html) {
  const meta = `<meta name="generator" content="${BUILD_INFO.productName} v${BUILD_INFO.version}">`;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${meta}\n</head>`);
  }
  return `${meta}\n${html}`;
}

/* -------------------------------------------------------------------------
   步骤 6：在 </body> 前注入网页版提示脚本
   ------------------------------------------------------------------------- */
const RUNTIME_SNIPPET = [
  '<script>',
  '/* 网页版提示（由 build/build.js 注入） */',
  '(function () {',
  "  'use strict';",
  '  try {',
  '    if (window.pojie) return; /* 跑在 Electron 里：什么都不做 */',
  "    try { window.localStorage.setItem('pojie.web', '1'); } catch (e) { /* 隐私模式忽略 */ }",
  "    var el = document.createElement('div');",
  "    el.id = 'pojie-web-tip';",
  "    el.textContent = '网页版：按 R 键重开、点击画面开始';",
  "    el.setAttribute('style', [",
  "      'position:fixed', 'left:50%', 'bottom:26px', 'transform:translateX(-50%)',",
  "      'z-index:9999', 'pointer-events:none', 'white-space:nowrap',",
  "      'padding:6px 14px', 'border-radius:999px',",
  "      'background:rgba(8,12,24,.72)', 'border:1px solid rgba(56,189,248,.28)',",
  "      'color:#dbe7ff', 'opacity:.92',",
  "      'font:12px/1.6 \"Segoe UI\",\"Microsoft YaHei\",system-ui,sans-serif',",
  "      'letter-spacing:.5px'",
  "    ].join(';') );",
  '    if (document.body) document.body.appendChild(el);',
  '  } catch (e) { /* 提示失败也绝不能影响游戏 */ }',
  '})();',
  '</script>'
].join('\n');

function injectRuntime(html) {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${RUNTIME_SNIPPET}\n</body>`);
  }
  return `${html}\n${RUNTIME_SNIPPET}`;
}

/* -------------------------------------------------------------------------
   主流程
   ------------------------------------------------------------------------- */
function main() {
  const indexFile = path.join(SRC_DIR, 'index.html');
  let html = readText(indexFile);
  if (html === null) {
    console.error(`[pojie-build] 找不到入口文件：${indexFile}`);
    process.exitCode = 1;
    return;
  }

  html = inlineHtmlAssets(html);

  const css = inlineStylesheet(html);
  html = css.html;

  const scripts = inlineScripts(html);
  html = scripts.html;

  html = injectMeta(html);
  html = injectRuntime(html);

  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, html, 'utf8');

  const bytes = fs.statSync(OUTPUT_FILE).size;
  const kb = (bytes / 1024).toFixed(1);

  console.log(`[pojie-build] ${BUILD_INFO.productName} v${BUILD_INFO.version} 单文件构建完成`);
  console.log(`[pojie-build] 样式内联 ${css.count} 个，脚本内联 ${scripts.count} 个`);
  if (inlined.length) {
    const list = Array.from(new Set(inlined));
    console.log(`[pojie-build] 资源内联 ${list.length} 个：${list.join('、')}`);
  }
  console.log(`[pojie-build] 输出：${OUTPUT_FILE}`);
  console.log(`[pojie-build] 大小：${kb} KB（${bytes} 字节）`);

  if (warnings.length) {
    console.log('[pojie-build] 警告：');
    warnings.forEach((w) => console.log(`  - ${w}`));
  }
}

main();
