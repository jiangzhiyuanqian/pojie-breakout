/* =========================================================================
   破界 · 打砖块  ——  渲染层（Canvas 2D）
   ========================================================================= */
(function (P) {
  'use strict';

  const U = P.util, L = P.levels;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const view = { s: 1, ox: 0, oy: 0, dpr: 1 };

  // 把「游戏画面矩形」同步给 DOM 覆盖层，避免 HUD 与画面错位
  function syncHudRect() {
    const gs = document.documentElement.style;
    gs.setProperty('--gx', view.ox.toFixed(2) + 'px');
    gs.setProperty('--gy', view.oy.toFixed(2) + 'px');
    gs.setProperty('--gw', (P.engine.W * view.s).toFixed(2) + 'px');
    gs.setProperty('--gh', (P.engine.H * view.s).toFixed(2) + 'px');
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const s = Math.min(w / P.engine.W, h / P.engine.H);
    view.s = s;
    view.ox = (w - P.engine.W * s) / 2;
    view.oy = (h - P.engine.H * s) / 2;
    view.dpr = dpr;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * view.ox, dpr * view.oy);
    syncHudRect();
  }
  window.addEventListener('resize', resize);

  // ---------------------------------------------------------- 辉光缓存
  const glowCache = new Map();
  function glowTexture(color, size) {
    const key = color + '|' + size;
    let c = glowCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grd.addColorStop(0, color);
      grd.addColorStop(0.35, color);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(0, 0, size, size);
      glowCache.set(key, c);
    }
    return c;
  }
  function drawGlow(x, y, r, color, alpha) {
    const s = glowTexture(color, 64);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------------------------------------------------------- 背景
  function drawBackground(G, t) {
    const H = P.engine.H;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#080c1a');
    g.addColorStop(0.55, '#05070f');
    g.addColorStop(1, '#0a0714');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, P.engine.W, H);

    for (const s of G.stars) {
      ctx.globalAlpha = 0.18 + 0.5 * (0.5 + 0.5 * Math.sin(s.p + t * 1.6));
      ctx.fillStyle = '#cfe3ff';
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(90,140,220,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const off = (t * 12) % 48;
    for (let x = -48; x < P.engine.W + 48; x += 48) { ctx.moveTo(x + off * 0.2, 0); ctx.lineTo(x + off * 0.2, H); }
    for (let y = -48; y < H + 48; y += 48) { ctx.moveTo(0, y); ctx.lineTo(P.engine.W, y); }
    ctx.stroke();
  }
  // ---------------------------------------------------------- 砖块
  function drawBricks(G) {
    for (const b of G.bricks) {
      const dmg = 1 - b.hp / b.maxHp;
      ctx.save();
      roundRect(b.x, b.y, b.w, b.h, 5);
      ctx.fillStyle = 'rgba(8,12,24,0.85)';
      ctx.fill();

      const grd = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      grd.addColorStop(0, b.color);
      grd.addColorStop(1, U.shade(b.color, -0.42));
      ctx.fillStyle = grd;
      ctx.globalAlpha = 1 - dmg * 0.45;
      roundRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, 5);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      roundRect(b.x + 3, b.y + 2.5, b.w - 6, Math.max(1.5, b.h * 0.22), 3);
      ctx.fill();

      if (dmg > 0.33) {
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(b.x + b.w * 0.28, b.y);
        ctx.lineTo(b.x + b.w * 0.40, b.y + b.h * 0.5);
        ctx.lineTo(b.x + b.w * 0.26, b.y + b.h);
        ctx.stroke();
      }
      if (b.bomb) {
        // 雷区砖块：闪烁标记
        const pulse = 0.35 + 0.35 * Math.sin(performance.now() / 180 + b.cx);
        ctx.fillStyle = `rgba(255,255,255,${pulse * 0.5})`;
        roundRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, 5);
        ctx.fill();
      }
      if (b.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.75})`;
        roundRect(b.x, b.y, b.w, b.h, 5);
        ctx.fill();
        b.flash = Math.max(0, b.flash - 0.08);
      }
      ctx.restore();
      drawGlow(b.cx, b.cy, b.w * 0.34, b.color, 0.13 + dmg * 0.05);
    }
  }

  // ---------------------------------------------------------- Boss
  function drawBoss(G) {
    const bo = G.boss;
    if (!bo || bo.hp <= 0) return;
    const ratio = Math.max(0, bo.hp / bo.maxHp);
    const d = bo.def;
    ctx.save();
    roundRect(bo.x, bo.y, bo.w, bo.h, 12);
    const grd = ctx.createLinearGradient(bo.x, bo.y, bo.x + bo.w, bo.y + bo.h);
    grd.addColorStop(0, bo.enraged ? '#be123c' : d.colorA);
    grd.addColorStop(0.5, bo.enraged ? '#f97316' : d.colorB);
    grd.addColorStop(1, bo.enraged ? '#facc15' : d.colorB);
    ctx.fillStyle = grd;
    ctx.globalAlpha = 0.94;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = bo.enraged ? 'rgba(253,224,71,0.75)' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = bo.enraged ? 2 : 1.5;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = bo.x + 14; x < bo.x + bo.w; x += 18) { ctx.moveTo(x, bo.y + 3); ctx.lineTo(x, bo.y + bo.h - 3); }
    ctx.stroke();

    if (bo.enraged) {
      // 狂暴时边缘能量纹
      const t = performance.now() / 90;
      ctx.strokeStyle = `rgba(254,240,138,${0.3 + 0.3 * Math.sin(t)})`;
      ctx.lineWidth = 2.5;
      roundRect(bo.x - 3, bo.y - 3, bo.w + 6, bo.h + 6, 14);
      ctx.stroke();
    }
    if (bo.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${bo.flash * 0.6})`;
      roundRect(bo.x, bo.y, bo.w, bo.h, 12);
      ctx.fill();
      bo.flash = Math.max(0, bo.flash - 0.09);
    }

    // 面部：发光核心 + 双眼
    const tt = performance.now() / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(tt * 3.4);
    const cx = bo.x + bo.w / 2;
    const coreColor = bo.enraged ? '#fde047' : (d.bullet || '#f472b6');
    const eyeY = bo.y + bo.h * 0.40;
    for (const s of [-1, 1]) {
      const ex = cx + s * bo.w * 0.20;
      ctx.fillStyle = 'rgba(8,11,24,0.88)';
      ctx.beginPath(); ctx.ellipse(ex, eyeY, 16, 11, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = bo.enraged ? 'rgba(254,240,138,0.95)' : 'rgba(255,255,255,0.92)';
      ctx.beginPath(); ctx.ellipse(ex, eyeY, 7 + pulse * 1.2, 7 + pulse * 1.2, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(15,23,42,0.9)';
      ctx.beginPath(); ctx.arc(ex, eyeY, 3.2, 0, U.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(ex - 2.2, eyeY - 2.4, 1.8, 0, U.TAU); ctx.fill();
    }
    const coreY = bo.y + bo.h * 0.73;
    drawGlow(cx, coreY, 26 + pulse * 10, coreColor, 0.45 + pulse * 0.3);
    ctx.fillStyle = coreColor;
    ctx.beginPath(); ctx.arc(cx, coreY, 7 + pulse * 1.5, 0, U.TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(cx - 1.8, coreY - 1.8, 2, 0, U.TAU); ctx.fill();

    ctx.restore();
    drawGlow(bo.x + bo.w / 2, bo.y + bo.h / 2, bo.w * 0.42, bo.enraged ? '#fb923c' : '#f472b6', 0.3);

    // 血条
    const bw = bo.w, bh = 7, bx = bo.x, by = bo.y - 15;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(bx, by, bw, bh, 4); ctx.fill();
    const grd2 = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grd2.addColorStop(0, bo.enraged ? '#fb923c' : '#f472b6');
    grd2.addColorStop(1, bo.enraged ? '#fde047' : '#facc15');
    ctx.fillStyle = grd2;
    roundRect(bx, by, Math.max(3, bw * ratio), bh, 4); ctx.fill();
    ctx.font = '600 12px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = bo.enraged ? '#fde047' : 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'center';
    ctx.fillText(bo.name + (bo.enraged ? ' · 狂暴' : ''), bo.x + bo.w / 2, by - 5);
  }

  // ---------------------------------------------------------- 挡板 / 球 / 道具
  function drawPaddle(G) {
    const p = G.paddle;
    const grad = ctx.createLinearGradient(p.x - p.w / 2, p.y, p.x + p.w / 2, p.y);
    if (G.laserPower > 0) { grad.addColorStop(0, '#fbbf24'); grad.addColorStop(0.5, '#fef08a'); grad.addColorStop(1, '#fbbf24'); }
    else { grad.addColorStop(0, '#38bdf8'); grad.addColorStop(0.5, '#e0f2fe'); grad.addColorStop(1, '#6366f1'); }
    ctx.save();
    roundRect(p.x - p.w / 2, p.y, p.w, p.h, 8);
    ctx.fillStyle = grad;
    ctx.shadowColor = G.laserPower > 0 ? 'rgba(250,204,21,0.9)' : 'rgba(56,189,248,0.8)';
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
    drawGlow(p.x, p.y + p.h / 2, p.w * 0.32, G.laserPower > 0 ? '#facc15' : '#38bdf8', 0.3);
  }

  function drawBalls(G) {
    for (const b of G.balls) {
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i], k = (i / b.trail.length);
        ctx.globalAlpha = k * 0.35;
        ctx.fillStyle = '#7dd3fc';
        ctx.beginPath(); ctx.arc(t.x, t.y, b.r * (0.25 + k * 0.7), 0, U.TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      drawGlow(b.x, b.y, b.r * 3.4, '#38bdf8', 0.55);
      ctx.fillStyle = '#f0f9ff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, U.TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.38, 0, U.TAU); ctx.fill();
    }
  }

  function drawDrops(G) {
    for (const d of G.drops) {
      const def = L.POWER[d.kind];
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(Math.sin(d.spin) * 0.25);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = def.color;
      roundRect(-11, -11, 22, 22, 6); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.font = '700 13px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.label, 0, 1);
      ctx.restore();
      drawGlow(d.x, d.y, 26, def.color, 0.4);
    }
  }

  function drawLasers(G) {
    for (const l of G.lasers) {
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(l.x - 2, l.y - 14, 4, 16);
      drawGlow(l.x, l.y - 6, 16, '#facc15', 0.6);
    }
  }

  function drawBullets(G) {
    for (const u of G.bullets) {
      drawGlow(u.x, u.y, u.r * 3, u.color || '#f87171', 0.6);
      ctx.fillStyle = '#fecaca';
      ctx.beginPath(); ctx.arc(u.x, u.y, u.r, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath(); ctx.arc(u.x, u.y, u.r * 0.45, 0, U.TAU); ctx.fill();
    }
  }

  function drawParticles(G) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of G.particles) {
      const k = 1 - p.life / p.max;
      ctx.globalAlpha = k * 0.95;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * k, 0, U.TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------------------------------------------------------- 冲击波
  function drawWaves(G) {
    for (const w of G.waves) {
      const k = U.clamp(w.t / w.dur, 0, 1);
      ctx.globalAlpha = (1 - k) * 0.7;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 6 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.r0 + (w.r1 - w.r0) * k, 0, U.TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------- 世界内 HUD
  function drawOverlayText(G) {
    if (G.state === 'play' && G.balls.some(b => b.stuck)) {
      ctx.textAlign = 'center';
      ctx.font = '600 15px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(226,232,240,0.6)';
      ctx.fillText('空格 / 点击发球', G.balls[0].x, G.balls[0].y - 26);
    }
    if (G.combo >= 3) {
      ctx.textAlign = 'center';
      ctx.font = `800 ${26 + Math.min(G.combo, 12)}px "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = '#facc15';
      ctx.fillText('×' + (1 + G.combo * 0.1).toFixed(1), P.engine.W / 2, P.engine.H - 74);
      ctx.font = '600 13px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(250,204,21,0.75)';
      ctx.fillText(G.combo + ' 连击', P.engine.W / 2, P.engine.H - 56);
    }
    if (G.bannerT > 0 && (G.state === 'play' || G.state === 'levelclear')) {
      const a = Math.min(1, G.bannerT);
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.font = '800 44px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(G.banner, P.engine.W / 2, P.engine.H * 0.44);
      ctx.font = '500 15px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(148,163,184,0.9)';
      ctx.fillText(G.bannerSub || '', P.engine.W / 2, P.engine.H * 0.44 + 30);
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------- 主渲染
  function render(G, dt) {
    const dpr = view.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * view.ox, dpr * view.oy);

    drawBackground(G, performance.now() / 1000);

    if (G.shake > 0.2) ctx.translate(U.rand(-G.shake, G.shake), U.rand(-G.shake, G.shake));

    drawBricks(G);
    drawBoss(G);
    drawDrops(G);
    drawLasers(G);
    if (G.state !== 'title') drawPaddle(G);
    drawBullets(G);
    drawBalls(G);
    drawParticles(G);
    drawWaves(G);

    ctx.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * view.ox, dpr * view.oy);
    drawOverlayText(G);

    if (G.flash > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${G.flash * 0.5})`;
      ctx.fillRect(0, 0, P.engine.W, P.engine.H);
    }
  }

  P.render = { canvas, ctx, view, resize, render, roundRect, drawGlow };
})(window.POJIE = window.POJIE || {});
