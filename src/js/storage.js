/* =========================================================================
   破界 · 打砖块  ——  存档与设置（localStorage，容错降级）
   ========================================================================= */
(function (P) {
  'use strict';

  const KEY = 'pojie.save.v1';

  const DEFAULTS = {
    settings: {
      volume: 0.55,
      muted: false,
      difficulty: 'normal',
      particles: true,
      shake: true,
      showHints: true
    },
    progress: {
      unlocked: 1,          // 已解锁到第几关（1 起）
      best: 0,              // 历史最高总分
      levelBest: {},        // 每关最高分 { "1": 1234 }
      levelClear: {},       // 每关是否通关 { "1": true }
      totalGames: 0,
      totalBricks: 0,
      maxCombo: 0,
      totalTime: 0         // 累计游戏毫秒
    }
  };

  let state = clone(DEFAULTS);

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = {
          settings: Object.assign({}, DEFAULTS.settings, parsed.settings || {}),
          progress: Object.assign({}, DEFAULTS.progress, parsed.progress || {})
        };
        // 老版本只有 best 的存档也兼容
        if (!parsed.progress && parsed.best) state.progress.best = parsed.best;
      }
    } catch (e) {
      state = clone(DEFAULTS);
    }
    // 旧 key 兜底
    try {
      const legacy = parseInt(localStorage.getItem('pojie.best') || '0', 10);
      if (legacy > state.progress.best) state.progress.best = legacy;
    } catch (e) { /* 忽略 */ }
    return state;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { /* 隐私模式下写不进去，忽略 */ }
  }

  function get() { return state; }
  function settings() { return state.settings; }
  function progress() { return state.progress; }

  function setSetting(key, value) {
    state.settings[key] = value;
    save();
  }

  function recordLevelResult(levelIdx, score, cleared, timeMs) {
    const pr = state.progress;
    const key = String(levelIdx + 1);
    pr.levelBest[key] = Math.max(pr.levelBest[key] || 0, score);
    if (cleared) pr.levelClear[key] = true;
    if (cleared && levelIdx + 2 > pr.unlocked) {
      pr.unlocked = Math.min(levelIdx + 2, P.levels.LEVELS.length);
      return true; // 返回 true 表示有新的关卡解锁
    }
    return false;
  }

  function recordGameOver(score) {
    const pr = state.progress;
    pr.totalGames++;
    if (score > pr.best) pr.best = score;
    save();
  }

  function recordStats(bricks, combo, timeMs) {
    const pr = state.progress;
    pr.totalBricks += bricks;
    pr.totalTime += timeMs;
    if (combo > pr.maxCombo) pr.maxCombo = combo;
    save();
  }

  function resetProgress() {
    state.progress = clone(DEFAULTS.progress);
    save();
  }

  load();

  P.storage = {
    get, settings, progress, setSetting,
    recordLevelResult, recordGameOver, recordStats, resetProgress,
    save
  };
})(window.POJIE = window.POJIE || {});
