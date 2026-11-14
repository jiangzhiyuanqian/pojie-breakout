/* =========================================================================
   破界 · 打砖块  ——  入口层（主循环 · 输入 · 钩子接线）
   ========================================================================= */
(function (P) {
  'use strict';

  const E = P.engine, R = P.render, UI = P.ui, S = P.storage, A = P.audio;
  const G = E.G;

  // ---------------------------------------------------------------- 钩子接线
  E.hooks.levelClear = function (lv) {
    UI.toast('第 ' + lv + ' 关通过');
  };

  E.hooks.unlock = function (lv) {
    UI.toast('解锁新关卡：第 ' + lv + ' 关');
    A.unlock();
  };

  E.hooks.gameOver = function (score, stat) {
    UI.showResult('gameover', score, stat);
  };

  E.hooks.win = function (score) {
    S.recordStats(G.stat.bricks, G.stat.maxCombo, G.stat.elapsed);
    UI.showResult('win', score, G.stat);
  };

  E.hooks.stateChange = function (s) {
    UI.el.hud.classList.toggle('hidden', s === 'title');
    if (s === 'play') {
      UI.hideAll();
      UI.hint(S.settings().showHints ? '鼠标移动挡板 · 空格发球 · Esc 暂停' : '');
    } else if (s !== 'pause') {
      UI.hint('');
    }
  };

  // ---------------------------------------------------------------- 暂停开关
  function overlayOpen() {
    return !UI.el.levels.classList.contains('hidden') ||
           !UI.el.settings.classList.contains('hidden');
  }

  P.app = {
    togglePause() {
      if (overlayOpen()) {
        if (!UI.el.levels.classList.contains('hidden')) UI.closeLevels();
        else UI.closeSettings();
        return;
      }
      if (G.state === 'play') {
        E.setState('pause');
        UI.showPause();
      } else if (G.state === 'pause') {
        UI.resume();
      }
    }
  };

  // ---------------------------------------------------------------- 输入
  function pointerX(clientX) {
    const rect = R.canvas.getBoundingClientRect();
    const x = (clientX - rect.left - R.view.ox) / (R.view.s || 1);
    return Math.max(0, Math.min(E.W, x));
  }

  R.canvas.addEventListener('pointermove', e => {
    G.mouse.x = pointerX(e.clientX);
  });

  R.canvas.addEventListener('pointerdown', e => {
    G.mouse.x = pointerX(e.clientX);
    if (G.state === 'play') E.launchBall();
  });

  // 触摸：手指控制挡板，轻点发球
  R.canvas.addEventListener('touchmove', e => {
    if (!e.touches.length) return;
    e.preventDefault();
    G.mouse.x = pointerX(e.touches[0].clientX);
  }, { passive: false });

  R.canvas.addEventListener('touchstart', e => {
    if (!e.touches.length) return;
    e.preventDefault();
    G.mouse.x = pointerX(e.touches[0].clientX);
    if (G.state === 'play') E.launchBall();
  }, { passive: false });

  window.addEventListener('keydown', e => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight') { G.keys[k] = true; e.preventDefault(); return; }
    if (k === ' ' || k === 'Spacebar') {
      e.preventDefault();
      if (G.state === 'play') E.launchBall();
      else if (G.state === 'title') { A.ui(); UI.playLevel(S.progress().unlocked - 1); }
      return;
    }
    if (k === 'Escape') {
      e.preventDefault();
      P.app.togglePause();
      return;
    }
    if (k === 'p' || k === 'P') {
      e.preventDefault();
      P.app.togglePause();
      return;
    }
    if (k === 'r' || k === 'R') {
      if (G.state === 'play' || G.state === 'pause') {
        e.preventDefault();
        UI.hideAll();
        E.startGame(G.level);
      }
      return;
    }
    if (k === 'm' || k === 'M') {
      e.preventDefault();
      const v = !S.settings().muted;
      S.setSetting('muted', v);
      A.setMuted(v);
      UI.syncMute();
      return;
    }
  });

  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') G.keys[e.key] = false;
  });

  // 失焦自动暂停
  window.addEventListener('blur', () => {
    if (G.state === 'play') { E.setState('pause'); UI.showPause(); }
  });

  // 首次交互解锁 WebAudio
  function unlockAudio() {
    A.init(); A.resume();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  }
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // ---------------------------------------------------------------- 主循环
  let last = 0, acc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) { last = now; return; }
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;          // 切标签页回来时不要一次跳太多
    acc += dt;

    let steps = 0;
    while (acc >= E.FIXED && steps < 8) {
      E.update(E.FIXED);
      acc -= E.FIXED;
      steps++;
    }
    if (steps >= 8) acc = 0;

    R.render(G, dt);
    UI.updateHud(G);
  }

  // ---------------------------------------------------------------- 启动
  function boot() {
    const st = S.settings();
    A.setVolume(st.volume);
    A.setMuted(st.muted);

    R.resize();
    UI.bind();
    UI.syncMute();

    G.state = 'title';
    UI.el.hud.classList.add('hidden');
    UI.showTitle();

    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.POJIE = window.POJIE || {});
