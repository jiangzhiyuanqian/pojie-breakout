'use strict';

/* =========================================================================
   破界 · 打砖块 —— Electron 主进程
   ------------------------------------------------------------------------
   · 只加载本地 src/index.html，不连任何远程页面
   · contextIsolation 开启、nodeIntegration 关闭，渲染进程只拿到 preload 暴露的
     极少量只读信息（见 preload.js）
   · 不引入任何第三方依赖
   ========================================================================= */

/* electron / electron-builder 的二进制下载走 npmmirror 镜像。
   这里设置的是“本进程”的环境变量：Electron 自己下载时用得上；如果从本文件
   里 spawn 子进程，也会继承。构建期请以项目根目录的 .npmrc
   （npm_config_electron_mirror / npm_config_electron_builder_binaries_mirror）
   或显式导出的同名环境变量为准。 */
process.env.ELECTRON_MIRROR =
  process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/';
process.env.ELECTRON_BUILDER_BINARIES_MIRROR =
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||
  'https://npmmirror.com/mirrors/electron-builder-binaries/';

const path = require('path');
const { pathToFileURL } = require('url');
const { app, BrowserWindow, Menu } = require('electron');

const APP_VERSION = require('../package.json').version;
const INDEX_FILE = path.join(__dirname, '..', 'src', 'index.html');
const INDEX_URL = pathToFileURL(INDEX_FILE).href;

let mainWindow = null;

/**
 * 创建主窗口。
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 820,
    minHeight: 600,
    backgroundColor: '#05070f',
    title: '破界打砖块',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // 版本号从主进程传给 preload，避免 preload 去读磁盘（沙箱预加载脚本不允许）
      additionalArguments: ['--pojie-app-version=' + APP_VERSION]
    }
  });

  // 等首帧画好再显示，避免白屏闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile(INDEX_FILE);

  // 菜单栏设为 null（游戏不需要菜单），但保留 F5 刷新 / F12 开发者工具
  Menu.setApplicationMenu(null);

  // 没有菜单栏就没有默认快捷键，这里手动补回来
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F5') {
      event.preventDefault();
      mainWindow.webContents.reload();
    } else if (input.key === 'F12') {
      event.preventDefault();
      mainWindow.webContents.toggleDevTools();
    }
  });

  // 渲染进程的 console 原样打到主进程 stdout，不吞掉游戏内部报错
  mainWindow.webContents.on('console-message', (...args) => {
    // Electron <= 34: (event, level, message, line, sourceId)
    // Electron >= 35: (event, { level, message, sourceId, lineNumber })
    const detail = args[1];
    let level;
    let message;
    let source = '';
    if (detail && typeof detail === 'object') {
      level = detail.level || 'info';
      message = detail.message || '';
      if (detail.sourceId) source = ` (${detail.sourceId}:${detail.lineNumber})`;
    } else {
      level = args[1] === undefined ? 'info' : String(args[1]);
      message = args[2] === undefined ? '' : String(args[2]);
      if (args[4]) source = ` (${args[4]}:${args[3]})`;
    }
    console.log(`[renderer:${level}] ${message}${source}`);
  });

  // 渲染进程崩溃 / 被杀：打出来，但不静默吞掉
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(
      '[renderer-gone] reason=%s exitCode=%s',
      details && details.reason,
      details && details.exitCode
    );
  });

  mainWindow.webContents.on('child-process-gone', (_event, details) => {
    console.error(
      '[child-process-gone] type=%s reason=%s exitCode=%s',
      details && details.type,
      details && details.reason,
      details && details.exitCode
    );
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.error('[renderer] 渲染进程无响应（卡住了）');
  });

  // 加载失败也要看得见
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[did-fail-load] %s %s (%s)', errorCode, errorDescription, validatedURL);
  });

  // 游戏内不允许打开外部链接 / 新窗口
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // 也不允许导航到别的地址（只放行本页自己的 index.html，避免误伤初始 loadFile）
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== INDEX_URL) {
      event.preventDefault();
      console.log(`[will-navigate] 已阻止外部导航：${url}`);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Windows / Linux：关掉窗口就退出；macOS 由 activate 事件负责重新开窗
    if (process.platform !== 'darwin') app.quit();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // macOS：点 Dock 图标而窗口已关时，重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
