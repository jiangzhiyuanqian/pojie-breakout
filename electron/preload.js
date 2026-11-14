'use strict';

/* =========================================================================
   破界 · 打砖块 —— preload 脚本
   ------------------------------------------------------------------------
   只把一小组只读信息通过 contextBridge 暴露给页面（window.pojie）。
   刻意不暴露 fs / child_process / ipcRenderer 等能力：
   渲染进程拿到 Node 能力就等于给了页面任意读写本机的权限。
   ========================================================================= */

const { contextBridge } = require('electron');

/** 版本号由主进程通过 additionalArguments 传入（沙箱预加载脚本读不到磁盘）。 */
function readAppVersion() {
  const prefix = '--pojie-app-version=';
  const hit = process.argv.find((arg) => arg.indexOf(prefix) === 0);
  return hit ? hit.slice(prefix.length) : '1.0.0';
}

contextBridge.exposeInMainWorld('pojie', {
  version: readAppVersion(),
  platform: process.platform,
  isElectron: true
});
