/* =========================================================================
   破界 · 打砖块  ——  通用工具
   ========================================================================= */
(function (P) {
  'use strict';

  const TAU = Math.PI * 2;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randI = (a, b) => Math.floor(rand(a, b + 1));
  const pick = arr => arr[(Math.random() * arr.length) | 0];

  /** 缓动：帧率无关的指数逼近 */
  const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

  /** 圆与矩形碰撞，返回法线与穿透深度；不相交返回 null */
  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    const dx = cx - nx, dy = cy - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r) return null;
    const d = Math.sqrt(d2);
    if (d > 1e-4) return { nx: dx / d, ny: dy / d, depth: r - d, px: nx, py: ny };
    // 圆心落在矩形内部：沿最近边推出
    const l = cx - rx, rr = rx + rw - cx, t = cy - ry, b = ry + rh - cy;
    const m = Math.min(l, rr, t, b);
    if (m === l)  return { nx: -1, ny: 0,  depth: r + l,  px: rx, py: cy };
    if (m === rr) return { nx: 1,  ny: 0,  depth: r + rr, px: rx + rw, py: cy };
    if (m === t)  return { nx: 0,  ny: -1, depth: r + t,  px: cx, py: ry };
    return { nx: 0, ny: 1, depth: r + b, px: cx, py: ry + rh };
  }

  /** #rrggbb 的明暗调整，amt ∈ [-1,1] */
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (amt < 0) { r *= (1 + amt); g *= (1 + amt); b *= (1 + amt); }
    else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  /** 数字补零 */
  const pad = (n, w) => String(n).padStart(w, '0');

  /** 毫秒 -> mm:ss */
  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ':' + pad(s % 60, 2);
  }

  P.util = { TAU, clamp, lerp, rand, randI, pick, damp, circleRect, shade, pad, fmtTime };
})(window.POJIE = window.POJIE || {});
