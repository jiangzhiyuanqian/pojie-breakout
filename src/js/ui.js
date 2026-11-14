/* =========================================================================
   破界 · 打砖块  ——  UI 层（DOM 覆盖层 + HUD）
   ========================================================================= */
(function (P) {
  'use strict';

  const U = P.util, L = P.levels, S = P.storage;
  const E = P.engine;

  const $ = id => document.getElementById(id);
  const el = {
    hud: $('hud'), hudScore: $('hudScore'), hudBest: $('hudBest'),
    hudLevel: $('hudLevel'), hudLevelName: $('hudLevelName'), hudLives: $('hudLives'),
    hudBuffs: $('hudBuffs'),
    menu: $('menu'), menuTitle: $('menuTitle'), menuSubtitle: $('menuSubtitle'),
    menuBody: $('menuBody'), menuActions: $('menuActions'),
    settings: $('settings'), settingsBody: $('settingsBody'),
    levels: $('levels'), levelGrid: $('levelGrid'),
    result: $('result'), resultTitle: $('resultTitle'), resultBody: $('resultBody'),
    resultActions: $('resultActions'),
    hint: $('hint'),
    btnMute: $('btnMute'), btnPause: $('btnPause'), btnSettings: $('btnSettings')
  };

  let toastEl = null, toastTimer = 0;

  // ---------------------------------------------------------------- 提示条
  function toast(msg, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms || 2200);
  }

  function hint(text) {
    el.hint.textContent = text || '';
    el.hint.style.opacity = text ? '0.55' : '0';
  }

  // ---------------------------------------------------------------- HUD
  let lastHud = '';
  function updateHud(G) {
    const pr = S.progress();
    const lv = L.LEVELS[G.level];
    const sig = G.score + '|' + G.lives + '|' + G.level + '|' + pr.best + '|' +
      (G.wideTimer > 0 ? 1 : 0) + (G.smallTimer > 0 ? 1 : 0) + (G.laserPower > 0 ? 1 : 0) + (G.slowTimer > 0 ? 1 : 0) + '|' +
      Math.ceil(G.wideTimer) + ',' + Math.ceil(G.smallTimer) + ',' + Math.ceil(G.laserPower) + ',' + Math.ceil(G.slowTimer);
    if (sig === lastHud) return;
    lastHud = sig;

    el.hudScore.textContent = U.pad(G.score, 6);
    el.hudBest.textContent = '最高 ' + pr.best;
    el.hudLevel.textContent = (G.level + 1) + ' / ' + L.LEVELS.length;
    el.hudLevelName.textContent = '关卡 ' + (lv ? lv.name : '');
    el.hudLives.innerHTML = '';
    for (let i = 0; i < Math.max(0, G.lives); i++) el.hudLives.appendChild(document.createElement('i'));

    const buffs = [];
    if (G.wideTimer > 0) buffs.push(['宽', G.wideTimer, '#34d399']);
    if (G.smallTimer > 0) buffs.push(['窄', G.smallTimer, '#f87171']);
    if (G.laserPower > 0) buffs.push(['激光', G.laserPower, '#facc15']);
    if (G.slowTimer > 0) buffs.push(['缓速', G.slowTimer, '#c084fc']);
    el.hudBuffs.innerHTML = '';
    for (const [label, t, color] of buffs) {
      const b = document.createElement('div');
      b.className = 'buff';
      b.style.borderColor = color;
      b.style.color = color;
      b.textContent = label + ' ' + Math.ceil(t) + 's';
      el.hudBuffs.appendChild(b);
    }
  }

  // ---------------------------------------------------------------- 暂停
  function showPause() {
    el.menuTitle.textContent = '暂 停';
    el.menuSubtitle.textContent = '按 Esc 继续';
    const G = E.G;
    el.menuBody.innerHTML =
      row('当前关卡', (G.level + 1) + ' / ' + L.LEVELS.length + ' · ' + (L.LEVELS[G.level] || {}).name) +
      row('本局得分', G.score) +
      row('剩余生命', Math.max(0, G.lives)) +
      row('连击', G.combo + ' 连');
    el.menuActions.innerHTML =
      btn('继续游戏', 'primary', 'resume') +
      btn('重新开始本关', '', 'restart') +
      btn('设置', 'ghost', 'settings') +
      btn('主菜单', 'ghost', 'title');
    show(el.menu);
  }

  // ---------------------------------------------------------------- 覆盖层开关
  function hideAll() {
    el.menu.classList.add('hidden');
    el.settings.classList.add('hidden');
    el.levels.classList.add('hidden');
    el.result.classList.add('hidden');
    document.body.classList.remove('modal');
  }
  function show(node) {
    hideAll();
    node.classList.remove('hidden');
    document.body.classList.add('modal');
  }

  // ---------------------------------------------------------------- 主菜单
  function showTitle() {
    const pr = S.progress();
    const st = S.settings();
    const d = L.DIFFICULTY[st.difficulty] || L.DIFFICULTY.normal;
    el.menuTitle.textContent = '破 界';
    el.menuSubtitle.textContent = '打砖块 · 十关 · 双 Boss';

    const cleared = Object.keys(pr.levelClear).length;
    el.menuBody.innerHTML =
      row('历史最高分', '<span style="color:#facc15;font-weight:800">' + pr.best + '</span>') +
      row('通关进度', cleared + ' / ' + L.LEVELS.length + ' 关') +
      row('累计击碎', pr.totalBricks + ' 块') +
      row('最高连击', pr.maxCombo + ' 连') +
      row('当前难度', d.label) +
      '<div class="hint-line">鼠标移动控制挡板 · 空格 / 点击发球<br>每关有不同布局，两场 Boss 战，越往后球速越快</div>';

    const hasProgress = pr.unlocked > 1;
    el.menuActions.innerHTML =
      btn(hasProgress ? '继续游戏' : '开始游戏', 'primary', 'play') +
      btn('选择关卡', '', 'levels') +
      btn('设置', 'ghost', 'settings');
    show(el.menu);
  }

  function row(k, v) {
    return '<div class="row"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>';
  }
  function btn(label, cls, act) {
    return '<button class="btn ' + (cls || '') + '" data-act="' + act + '">' + label + '</button>';
  }

  // ---------------------------------------------------------------- 设置
  function showSettings() {
    const st = S.settings();
    el.settingsBody.innerHTML =
      '<div class="row"><span class="k">音量</span>' +
      '<input type="range" id="setVolume" min="0" max="100" value="' + Math.round(st.volume * 100) + '"></div>' +
      '<div class="row"><span class="k">静音</span>' +
      '<button class="switch" role="switch" aria-checked="' + (st.muted ? 'true' : 'false') + '" data-act="toggle" data-key="muted"></button></div>' +
      '<div class="row"><span class="k">难度</span><div class="seg" id="segDiff">' +
      Object.keys(L.DIFFICULTY).map(k =>
        '<button data-act="difficulty" data-key="' + k + '" aria-pressed="' + (st.difficulty === k ? 'true' : 'false') + '">' +
        L.DIFFICULTY[k].label + '</button>').join('') +
      '</div></div>' +
      '<div class="row"><span class="k">粒子特效</span>' +
      '<button class="switch" role="switch" aria-checked="' + (st.particles ? 'true' : 'false') + '" data-act="toggle" data-key="particles"></button></div>' +
      '<div class="row"><span class="k">屏幕震动</span>' +
      '<button class="switch" role="switch" aria-checked="' + (st.shake ? 'true' : 'false') + '" data-act="toggle" data-key="shake"></button></div>' +
      '<div class="row"><span class="k">操作提示</span>' +
      '<button class="switch" role="switch" aria-checked="' + (st.showHints ? 'true' : 'false') + '" data-act="toggle" data-key="showHints"></button></div>' +
      '<div class="hint-line">难度设置在下一局开始时生效</div>';

    const v = $('setVolume');
    v.addEventListener('input', () => {
      const val = v.value / 100;
      S.setSetting('volume', val);
      P.audio.setVolume(val);
    });
    show(el.settings);
  }

  // ---------------------------------------------------------------- 关卡选择
  function showLevels() {
    const pr = S.progress();
    el.levelGrid.innerHTML = '';
    L.LEVELS.forEach((lv, i) => {
      const locked = i + 1 > pr.unlocked;
      const best = pr.levelBest[String(i + 1)] || 0;
      const cleared = !!pr.levelClear[String(i + 1)];
      const card = document.createElement('div');
      card.className = 'lvcard' + (locked ? ' locked' : '');
      card.innerHTML =
        (lv.boss ? '<span class="tag">BOSS</span>' : '') +
        '<div class="n">' + (i + 1) + '</div>' +
        '<div class="nm">' + lv.name + (locked ? ' · 未解锁' : '') + '</div>' +
        '<div class="sc">' + (cleared ? '已通关 · ' : '') + (best ? '最佳 ' + best : '') + '</div>';
      if (!locked) card.addEventListener('click', () => { P.audio.ui(); P.ui.playLevel(i); });
      el.levelGrid.appendChild(card);
    });
    show(el.levels);
  }

  // ---------------------------------------------------------------- 结算
  function showResult(kind, score, stat) {
    const pr = S.progress();
    const isWin = kind === 'win';
    el.resultTitle.textContent = isWin ? '通 关 ！' : '游 戏 结 束';
    el.resultBody.innerHTML =
      '<div class="big">' + score + '</div>' +
      '<div class="hint-line">本局得分</div>' +
      row('到达关卡', (E.G.level + 1) + ' / ' + L.LEVELS.length + ' · ' + (L.LEVELS[E.G.level] || {}).name) +
      row('击碎砖块', (stat && stat.bricks || 0) + ' 块') +
      row('最高连击', (stat && stat.maxCombo || 0) + ' 连') +
      row('用时', U.fmtTime((stat && stat.elapsed) || 0)) +
      row('历史最高', pr.best);
    el.resultActions.innerHTML =
      btn('再来一局', 'primary', 'retry') +
      btn('选择关卡', '', 'levels') +
      btn('主菜单', 'ghost', 'title');
    show(el.result);
  }

  // ---------------------------------------------------------------- 事件
  function onAct(act, node) {
    const A = P.audio;
    switch (act) {
      case 'play': A.ui(); P.ui.playLevel(S.progress().unlocked - 1); break;
      case 'retry': A.ui(); P.ui.retry(); break;
      case 'title': A.ui(); P.ui.toTitle(); break;
      case 'levels': A.ui(); P.ui.openLevels(); break;
      case 'settings': A.ui(); P.ui.openSettings(); break;
      case 'settings-close': A.ui(); P.ui.closeSettings(); break;
      case 'levels-close': A.ui(); P.ui.closeLevels(); break;
      case 'pause': A.ui(); P.ui.togglePause(); break;
      case 'resume': A.ui(); P.ui.resume(); break;
      case 'restart': A.ui(); P.ui.restart(); break;
      case 'levels-reset':
        if (confirm('确定要清空全部进度吗？此操作不可撤销。')) {
          S.resetProgress();
          A.ui();
          toast('进度已重置');
          P.ui.openLevels();
        }
        break;
      case 'toggle': {
        const key = node.getAttribute('data-key');
        const val = !S.settings()[key];
        S.setSetting(key, val);
        node.setAttribute('aria-checked', val ? 'true' : 'false');
        if (key === 'muted') { P.audio.setMuted(val); P.ui.syncMute(); }
        A.ui();
        break;
      }
      case 'difficulty': {
        const key = node.getAttribute('data-key');
        S.setSetting('difficulty', key);
        const seg = $('segDiff');
        if (seg) seg.querySelectorAll('button').forEach(b =>
          b.setAttribute('aria-pressed', b.getAttribute('data-key') === key ? 'true' : 'false'));
        A.ui();
        break;
      }
    }
  }

  function bind() {
    document.addEventListener('click', e => {
      const node = e.target.closest('[data-act]');
      if (!node) return;
      const act = node.getAttribute('data-act');
      if (act === 'settings-close') { /* 已有 data-act */ }
      onAct(act, node);
    });

    el.btnSettings.addEventListener('click', () => onAct('settings', el.btnSettings));
    el.btnPause.addEventListener('click', () => onAct('pause', el.btnPause));
    el.btnMute.addEventListener('click', () => {
      const val = !S.settings().muted;
      S.setSetting('muted', val);
      P.audio.setMuted(val);
      syncMute();
      P.audio.ui();
    });
  }

  function syncMute() {
    const muted = S.settings().muted;
    el.btnMute.textContent = muted ? '✕' : '♪';
    el.btnMute.title = muted ? '取消静音 (M)' : '静音 (M)';
  }

  // ---------------------------------------------------------------- 对外接口
  let overlayPaused = false;   // 打开覆盖层时是否临时暂停了游戏

  function pauseForOverlay() {
    if (E.G.state === 'play') { overlayPaused = true; E.setState('pause'); }
  }
  function resumeAfterOverlay() {
    if (overlayPaused) {
      overlayPaused = false;
      if (E.G.state === 'pause') E.setState('play');
    }
  }

  const api = {
    el, toast, hint, updateHud, hideAll, showTitle, showSettings, showLevels, showResult,
    showPause, bind, syncMute,

    /** 从标题进入游戏 */
    playLevel(i) {
      hideAll();
      resumeAfterOverlay();
      E.startGame(i);
    },
    retry() {
      hideAll();
      resumeAfterOverlay();
      E.startGame(E.G.level);
    },
    toTitle() {
      E.setState('title');
      hideAll();
      resumeAfterOverlay();
      showTitle();
    },
    openLevels() { pauseForOverlay(); showLevels(); },
    closeLevels() {
      hideAll();
      resumeAfterOverlay();
      const s = E.G.state;
      if (s === 'title') showTitle();
      else if (s === 'gameover' || s === 'win') showResult(s, E.G.score, E.G.stat);
      else if (s === 'pause') showPause();
    },
    openSettings() { pauseForOverlay(); showSettings(); },
    closeSettings() {
      hideAll();
      resumeAfterOverlay();
      const s = E.G.state;
      if (s === 'title') showTitle();
      else if (s === 'gameover' || s === 'win') showResult(s, E.G.score, E.G.stat);
      else if (s === 'pause') showPause();
    },
    togglePause() {
      if (P.app && P.app.togglePause) P.app.togglePause();
    },
    resume() {
      hideAll();
      resumeAfterOverlay();
      if (E.G.state === 'pause') E.setState('play');
    },
    restart() {
      hideAll();
      resumeAfterOverlay();
      E.startGame(E.G.level);
    }
  };

  P.ui = api;
})(window.POJIE = window.POJIE || {});
