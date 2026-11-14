/* =========================================================================
   破界 · 打砖块  ——  游戏引擎（状态、物理、碰撞、实体）
   ========================================================================= */
(function (P) {
  'use strict';

  const U = P.util, L = P.levels, A = P.audio;

  const W = 960, H = 640;
  const GX = 40, GY = 78, CW = 68, CH = 26;
  const BASE_PADDLE_W = 132;
  const FIXED = 1 / 120;

  const G = {
    state: 'title',        // title | play | pause | levelclear | gameover | win
    stateT: 0,
    score: 0,
    lives: 3,
    level: 0,
    bricks: [],
    balls: [],
    drops: [],
    lasers: [],
    bullets: [],
    particles: [],
    waves: [],
    boss: null,
    paddle: { x: W / 2, w: BASE_PADDLE_W, h: 16, y: H - 46 },
    combo: 0,
    comboTimer: 0,
    shake: 0,
    hitStop: 0,
    flash: 0,
    banner: '',
    bannerSub: '',
    bannerT: 0,
    laserTimer: 0,
    wideTimer: 0, smallTimer: 0, laserPower: 0, slowTimer: 0,
    slowFactor: 1,
    mouse: { x: W / 2, y: 0, down: false },
    keys: {},
    stars: [],
    // 本局统计
    stat: { bricks: 0, hits: 0, maxCombo: 0, startedAt: 0, elapsed: 0, shots: 0 }
  };

  // 钩子（由 UI 层注册）
  const hooks = {
    levelClear: null,
    gameOver: null,
    win: null,
    unlock: null,
    stateChange: null
  };

  for (let i = 0; i < 90; i++) {
    G.stars.push({ x: U.rand(0, W), y: U.rand(0, H), z: U.rand(0.3, 1), s: U.rand(0.6, 2.1), p: U.rand(0, U.TAU) });
  }

  function diff() { return L.DIFFICULTY[P.storage.settings().difficulty] || L.DIFFICULTY.normal; }

  function setState(s) {
    if (G.state === s) return;
    G.state = s;
    G.stateT = 0;
    if (hooks.stateChange) hooks.stateChange(s);
  }

  // ---------------------------------------------------------------- 关卡构建
  function buildLevel(idx) {
    const lv = L.LEVELS[idx];
    const d = diff();

    G.bricks = []; G.balls = []; G.drops = []; G.lasers = []; G.bullets = [];
    G.boss = null; G.combo = 0; G.comboTimer = 0;
    G.laserPower = 0; G.slowTimer = 0; G.slowFactor = 1;
    G.wideTimer = 0; G.smallTimer = 0;
    G.paddle.w = BASE_PADDLE_W * d.paddle;
    G.paddle.x = W / 2;
    G.levelStartScore = G.score;

    lv.grid.forEach((row, y) => {
      for (let x = 0; x < row.length && x < L.COLS; x++) {
        const ch = row[x];
        if (ch === ' ') continue;
        const def = L.BRICK[ch];
        if (!def) continue;
        const hp = Math.max(1, Math.round(def.hp * d.hpScale));
        G.bricks.push({
          x: GX + x * CW + 2, y: GY + y * CH + 2, w: CW - 4, h: CH - 4,
          hp, maxHp: hp, color: def.color, score: def.score,
          bomb: !!def.bomb, drop: !!def.drop, flash: 0, dead: false,
          cx: 0, cy: 0
        });
      }
    });
    G.bricks.forEach(b => { b.cx = b.x + b.w / 2; b.cy = b.y + b.h / 2; });

    if (lv.boss) {
      const b = L.BOSSES[lv.boss];
      G.boss = {
        kind: lv.boss, name: b.name,
        x: W / 2 - 130, y: GY + 40, w: 260, h: 66,
        hp: Math.round(b.hp * d.hpScale), maxHp: Math.round(b.hp * d.hpScale),
        flash: 0, phase: 0, fireT: 1.2, enraged: false, dieT: 0,
        def: b
      };
    }

    resetBall();
    G.banner = lv.name;
    G.bannerSub = '准备';
    G.bannerT = 1.6;
  }

  function resetBall() {
    const p = G.paddle;
    G.balls = [{
      x: p.x, y: p.y - 22, vx: 0, vy: 0, r: 9,
      speed: (392 + G.level * 14) * diff().speed,
      trail: [], stuck: true
    }];
  }

  // ---------------------------------------------------------------- 粒子
  function spawnParticles(x, y, color, n, spd, size) {
    if (!P.storage.settings().particles) { n = Math.ceil(n * 0.35); }
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, U.TAU), s = U.rand(spd * 0.25, spd);
      G.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - U.rand(0, 60),
        life: 0, max: U.rand(0.35, 0.85), size: U.rand(size * 0.5, size * 1.4), color
      });
    }
    if (G.particles.length > 900) G.particles.splice(0, G.particles.length - 900);
  }

  function updateParticles(dt) {
    const ps = G.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.max) { ps.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 520 * dt;
      p.vx *= (1 - 1.4 * dt);
      p.vy *= (1 - 0.6 * dt);
    }
  }

  /** 冲击波（清场时的扩散圆环） */
  function spawnWave(x, y, r0, r1, dur, color) {
    G.waves.push({ x, y, r0, r1, dur, t: 0, color: color || '#38bdf8' });
  }
  function updateWaves(dt) {
    for (let i = G.waves.length - 1; i >= 0; i--) {
      const w = G.waves[i];
      w.t += dt;
      if (w.t >= w.dur) G.waves.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- 砖块
  function damageBrick(b, dmg, byLaser) {
    b.hp -= dmg;
    b.flash = 1;
    if (b.hp > 0) {
      A.crack();
      spawnParticles(b.cx + U.rand(-b.w / 2, b.w / 2), b.cy, b.color, 5, 130, 2);
      return;
    }
    b.dead = true;
    const mult = 1 + G.combo * 0.1;
    G.score += Math.round(b.score * mult);
    G.combo++;
    G.comboTimer = 3;
    G.stat.bricks++;
    if (G.combo > G.stat.maxCombo) G.stat.maxCombo = G.combo;
    spawnParticles(b.cx, b.cy, b.color, 16, 260, 3.2);
    spawnParticles(b.cx, b.cy, '#ffffff', 5, 150, 2);
    addShake(2.4);
    A.brick(G.combo);

    if (b.bomb) {
      for (const o of G.bricks) {
        if (o.dead || o === b) continue;
        if (Math.hypot(o.cx - b.cx, o.cy - b.cy) < 86) damageBrick(o, 99);
      }
      spawnParticles(b.cx, b.cy, '#fb923c', 30, 380, 4);
      addShake(5);
      A.noise({ dur: 0.35, vol: 0.22, filt: 1200, sweepTo: 120 });
    }
    const dropRate = 0.16 * diff().dropRate;
    if (b.drop || Math.random() < dropRate) spawnDrop(b.cx, b.cy);
    if (byLaser) addShake(1.2);
  }

  function addShake(v) {
    if (!P.storage.settings().shake) return;
    G.shake = Math.min(G.shake + v, 16);
  }

  function spawnDrop(x, y) {
    const k = U.pick(L.POWER_KEYS);
    G.drops.push({ x, y, w: 22, h: 22, vy: 118, kind: k, spin: U.rand(0, U.TAU), life: 0 });
  }

  // ---------------------------------------------------------------- 道具
  function applyPower(kind) {
    const p = G.paddle;
    A.power();
    spawnParticles(p.x, p.y - 10, L.POWER[kind].color, 18, 260, 3);
    switch (kind) {
      case 'wide':
        G.wideTimer = L.POWER.wide.dur; G.smallTimer = 0;
        setPaddleWidth(BASE_PADDLE_W * diff().paddle * L.POWER.wide.w); break;
      case 'small':
        G.smallTimer = L.POWER.small.dur; G.wideTimer = 0;
        setPaddleWidth(BASE_PADDLE_W * diff().paddle * L.POWER.small.w); break;
      case 'multi': {
        const src = G.balls[0];
        if (!src) break;
        for (let i = 0; i < 2; i++) {
          const a = Math.atan2(src.vy, src.vx) + (i ? 0.5 : -0.5);
          G.balls.push({
            x: src.x, y: src.y, vx: Math.cos(a) * src.speed, vy: Math.sin(a) * src.speed,
            r: src.r, speed: src.speed, trail: [], stuck: false
          });
        }
        break;
      }
      case 'laser': G.laserPower = L.POWER.laser.dur; break;
      case 'slow': G.slowTimer = L.POWER.slow.dur; G.slowFactor = 0.68; break;
      case 'life': G.lives++; break;
    }
  }

  function setPaddleWidth(w) {
    G.paddle.w = w;
    G.paddle.x = U.clamp(G.paddle.x, w / 2 + 8, W - w / 2 - 8);
  }

  // ---------------------------------------------------------------- 流程
  function startGame(levelIdx, keepScore) {
    A.init(); A.resume();
    const d = diff();
    if (!keepScore) G.score = 0;
    G.lives = d.lives;
    G.won = false;
    G.stat = { bricks: 0, hits: 0, maxCombo: 0, startedAt: performance.now(), elapsed: 0, shots: 0 };
    G.particles.length = 0; G.waves.length = 0; G.shake = 0; G.flash = 0;
    G._waveSpawned = false;
    G.level = U.clamp(levelIdx == null ? 0 : levelIdx, 0, L.LEVELS.length - 1);
    buildLevel(G.level);
    setState('play');
  }

  function launchBall() {
    let any = false;
    for (const b of G.balls) {
      if (!b.stuck) continue;
      any = true;
      b.stuck = false;
      const a = U.rand(-0.55, 0.55);
      b.vx = Math.sin(a) * b.speed;
      b.vy = -Math.cos(a) * b.speed;
    }
    if (any) {
      G.stat.shots++;
      A.tone({ freq: 660, dur: 0.09, type: 'triangle', vol: 0.16, slide: 300 });
    }
  }

  function fireLaser() {
    if (G.laserPower > 0 && G.laserTimer <= 0) {
      G.laserTimer = 0.19;
      const p = G.paddle;
      G.lasers.push({ x: p.x - p.w / 2 + 8, y: p.y - 4, vy: -880 },
                    { x: p.x + p.w / 2 - 8, y: p.y - 4, vy: -880 });
      A.laser();
    }
  }

  function nextLevel() {
    if (G.level >= L.LEVELS.length - 1) {
      setState('win');
      A.win();
      P.storage.recordGameOver(G.score);
      if (hooks.win) hooks.win(G.score);
      return;
    }
    G.level++;
    buildLevel(G.level);
    setState('play');
    A.levelUp();
  }

  function loseLife() {
    G.lives--;
    G.combo = 0;
    G.flash = 0.55;
    addShake(8);
    A.die();
    if (G.lives <= 0) {
      setState('gameover');
      P.storage.recordGameOver(G.score);
      P.storage.recordStats(G.stat.bricks, G.stat.maxCombo, G.stat.elapsed);
      if (hooks.gameOver) hooks.gameOver(G.score, G.stat);
    } else {
      G.balls = []; G.bullets = []; G.laserPower = 0;
      resetBall();
    }
  }

  function killBoss() {
    const bo = G.boss;
    if (!bo) return;
    G.hitStop = 0.16;
    addShake(18);
    G.flash = 0.9;
    for (let i = 0; i < 5; i++) {
      spawnParticles(bo.x + U.rand(0, bo.w), bo.y + U.rand(0, bo.h),
        U.pick(['#f472b6', '#fb923c', '#facc15', '#ffffff']), 22, 420, 4);
    }
    G.score += 2500;
    A.bossDie();
    bo.hp = 0;
  }

  // ---------------------------------------------------------------- 主更新
  function update(dt) {
    G.stateT += dt;
    G.shake *= Math.pow(0.0016, dt);
    G.flash *= Math.pow(0.0009, dt);
    G.bannerT = Math.max(0, G.bannerT - dt);
    G.comboTimer = Math.max(0, G.comboTimer - dt);
    if (G.comboTimer <= 0) G.combo = 0;
    updateParticles(dt);
    updateWaves(dt);

    for (const s of G.stars) {
      s.y += 14 * s.z * dt;
      if (s.y > H) { s.y = -4; s.x = U.rand(0, W); }
    }

    if (G.state === 'title') return;
    if (G.state === 'levelclear') {
      if (!G._waveSpawned) {
        G._waveSpawned = true;
        spawnWave(P.engine.W / 2, P.engine.H - 60, 20, 760, 0.85, '#7dd3fc');
        spawnWave(P.engine.W / 2, P.engine.H - 60, 10, 520, 0.6, '#facc15');
        if (hooks.levelClear) hooks.levelClear(G.level + 1);
      }
      if (G.stateT > 1.3) {
        const lvlScore = Math.max(0, G.score - (G.levelStartScore || 0));
        const cleared = P.storage.recordLevelResult(G.level, lvlScore, true, G.stat.elapsed);
        if (cleared && hooks.unlock && G.level + 2 <= P.levels.LEVELS.length) hooks.unlock(G.level + 2);
        nextLevel();
      }
      return;
    }
    G._waveSpawned = false;
    if (G.state !== 'play') return;
    if (G.hitStop > 0) { G.hitStop -= dt; return; }

    G.stat.elapsed += dt * 1000;

    // ---- 挡板 ----
    const p = G.paddle;
    let target = G.mouse.x;
    if (G.keys['ArrowLeft']) { target -= 460 * dt; G.mouse.x = target; }
    if (G.keys['ArrowRight']) { target += 460 * dt; G.mouse.x = target; }
    const minX = p.w / 2 + 8, maxX = W - p.w / 2 - 8;
    p.x = U.damp(p.x, U.clamp(target, minX, maxX), 22, dt);

    // ---- 道具计时 ----
    if (G.wideTimer > 0) { G.wideTimer -= dt; if (G.wideTimer <= 0) setPaddleWidth(BASE_PADDLE_W * diff().paddle); }
    if (G.smallTimer > 0) { G.smallTimer -= dt; if (G.smallTimer <= 0) setPaddleWidth(BASE_PADDLE_W * diff().paddle); }
    if (G.laserPower > 0) G.laserPower -= dt;
    if (G.slowTimer > 0) { G.slowTimer -= dt; if (G.slowTimer <= 0) G.slowFactor = 1; }
    G.laserTimer = Math.max(0, G.laserTimer - dt);
    fireLaser();

    for (const b of G.balls) if (b.stuck) { b.x = p.x; b.y = p.y - 22; }

    // ---- 球 ----
    const step = 5;
    for (let bi = G.balls.length - 1; bi >= 0; bi--) {
      const b = G.balls[bi];
      if (b.stuck) continue;
      const vlen = Math.hypot(b.vx, b.vy) || 1;
      const sp = b.speed * G.slowFactor;
      let vx = (b.vx / vlen) * sp, vy = (b.vy / vlen) * sp;
      const dist = sp * dt;
      const n = Math.max(1, Math.ceil(dist / step));
      const sdt = dt / n;
      let dead = false;

      for (let s = 0; s < n && !dead; s++) {
        b.x += vx * sdt; b.y += vy * sdt;

        if (b.x - b.r < 0) { b.x = b.r; vx = Math.abs(vx); A.wall(); }
        if (b.x + b.r > W) { b.x = W - b.r; vx = -Math.abs(vx); A.wall(); }
        if (b.y - b.r < 0) { b.y = b.r; vy = Math.abs(vy); A.wall(); }

        // 挡板
        const pr = U.circleRect(b.x, b.y, b.r, p.x - p.w / 2, p.y, p.w, p.h);
        if (pr && vy > 0) {
          const rel = U.clamp((b.x - (p.x - p.w / 2)) / p.w, -1, 1);
          b.speed = Math.min(b.speed * 1.012, 720);
          const ang = rel * (65 * Math.PI / 180);
          b.vx = Math.sin(ang) * b.speed;
          b.vy = -Math.cos(ang) * b.speed;
          vx = b.vx; vy = b.vy;
          b.y = p.y - b.r - 0.5;
          G.combo = 0; G.comboTimer = 0;
          addShake(1.4);
          spawnParticles(b.x, b.y, '#7dd3fc', 6, 150, 2);
          A.paddle(rel);
        }

        // 砖块
        for (const br of G.bricks) {
          if (br.dead) continue;
          const c = U.circleRect(b.x, b.y, b.r, br.x, br.y, br.w, br.h);
          if (!c) continue;
          const dot = vx * c.nx + vy * c.ny;
          vx -= 2 * dot * c.nx; vy -= 2 * dot * c.ny;
          b.x += c.nx * (c.depth + 0.6);
          b.y += c.ny * (c.depth + 0.6);
          if (Math.abs(vy) < 60) vy = (vy >= 0 ? 1 : -1) * 60;
          b.vx = vx; b.vy = vy;
          G.stat.hits++;
          damageBrick(br, 1);
          break;
        }

        // Boss
        const bo = G.boss;
        if (bo && bo.hp > 0) {
          const c = U.circleRect(b.x, b.y, b.r, bo.x, bo.y, bo.w, bo.h);
          if (c) {
            const dot = vx * c.nx + vy * c.ny;
            vx -= 2 * dot * c.nx; vy -= 2 * dot * c.ny;
            b.x += c.nx * (c.depth + 0.6);
            b.y += c.ny * (c.depth + 0.6);
            bo.hp -= 1; bo.flash = 1;
            G.score += 25;
            G.stat.hits++;
            spawnParticles(b.x, b.y, '#f472b6', 6, 200, 2.5);
            A.bossHit();
            addShake(2.2);
            if (bo.hp <= 0) killBoss();
          }
        }

        if (b.y - b.r > H + 20) dead = true;
      }

      if (dead) {
        G.balls.splice(bi, 1);
        if (G.balls.length === 0) loseLife();
        continue;
      }

      b.vx = vx; b.vy = vy;
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 14) b.trail.shift();
    }

    // ---- 激光 ----
    for (let i = G.lasers.length - 1; i >= 0; i--) {
      const l = G.lasers[i];
      l.y += l.vy * dt;
      if (l.y < -10) { G.lasers.splice(i, 1); continue; }
      for (const br of G.bricks) {
        if (br.dead) continue;
        if (l.x >= br.x && l.x <= br.x + br.w && l.y <= br.y + br.h && l.y >= br.y - 6) {
          damageBrick(br, 1, true);
          spawnParticles(l.x, l.y, '#facc15', 5, 160, 2);
          G.lasers.splice(i, 1);
          break;
        }
      }
    }

    // ---- Boss 行为 ----
    const bo = G.boss;
    if (bo && bo.hp > 0) {
      bo.flash = Math.max(0, bo.flash - dt * 4);
      bo.phase += dt;
      const d = bo.def;
      if (!bo.enraged && bo.hp / bo.maxHp <= d.phase2At) {
        bo.enraged = true;
        bo.fireT = 0.4;
        G.flash = Math.max(G.flash, 0.25);
        A.bossDie();
      }
      const spd = d.speed * (bo.enraged ? 1.55 : 1);
      bo.x = W / 2 - bo.w / 2 + Math.sin(bo.phase * 0.9) * (W / 2 - bo.w / 2 - 24) * (spd / d.speed);
      bo.fireT -= dt;
      if (bo.fireT <= 0) {
        const base = Math.max(0.5, d.fireInterval * (bo.enraged ? 0.62 : 1) - G.level * 0.05);
        bo.fireT = base;
        const n = bo.enraged ? d.phase2Shots : d.shots;
        const spread = bo.enraged ? d.phase2Spread : d.spread;
        for (let i = 0; i < n; i++) {
          const x = bo.x + bo.w * ((i + 1) / (n + 1));
          const ang = spread ? U.rand(-spread, spread) : 0;
          G.bullets.push({
            x, y: bo.y + bo.h,
            vx: Math.sin(ang) * 190, vy: Math.cos(ang) * 175,
            r: 8, t: 0, color: d.bullet
          });
        }
        A.tone({ freq: 200, dur: 0.12, type: 'sawtooth', vol: 0.1, slide: -60 });
      }
    }

    // ---- Boss 子弹 ----
    for (let i = G.bullets.length - 1; i >= 0; i--) {
      const u = G.bullets[i];
      u.t += dt;
      u.x += u.vx * dt; u.y += u.vy * dt;
      if (u.y > H + 20) { G.bullets.splice(i, 1); continue; }
      if (u.x < 0 || u.x > W) { u.vx *= -1; u.x = U.clamp(u.x, 0, W); }
      const pc = U.circleRect(u.x, u.y, u.r, p.x - p.w / 2, p.y, p.w, p.h);
      if (pc) { G.bullets.splice(i, 1); loseLife(); break; }
    }

    // ---- 掉落道具 ----
    for (let i = G.drops.length - 1; i >= 0; i--) {
      const d = G.drops[i];
      d.y += d.vy * dt; d.life += dt; d.spin += dt * 3;
      if (d.y > H + 30) { G.drops.splice(i, 1); continue; }
      const pc = U.circleRect(d.x, d.y, 12, p.x - p.w / 2, p.y, p.w, p.h);
      if (pc) { G.drops.splice(i, 1); applyPower(d.kind); }
    }

    // ---- 清理与过关 ----
    for (let i = G.bricks.length - 1; i >= 0; i--) if (G.bricks[i].dead) G.bricks.splice(i, 1);
    if (G.bricks.length === 0 && (!G.boss || G.boss.hp <= 0)) {
      G.banner = '关卡通过';
      G.bannerSub = '得分 +' + Math.max(0, G.score - (G.levelStartScore || 0));
      G.bannerT = 1.2;
      setState('levelclear');
    }
  }

  P.engine = {
    G, W, H, GX, GY, CW, CH, BASE_PADDLE_W, FIXED,
    hooks, diff, startGame, launchBall, fireLaser, nextLevel, loseLife,
    buildLevel, applyPower, setState, update, spawnParticles, resetBall,
    spawnWave
  };
})(window.POJIE = window.POJIE || {});
