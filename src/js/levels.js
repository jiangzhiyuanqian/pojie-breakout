/* =========================================================================
   破界 · 打砖块  ——  关卡与 Boss 数据
   ========================================================================= */
(function (P) {
  'use strict';

  const COLS = 13, ROWS = 8;

  // 砖块类型
  //   hp 血量  color 颜色  score 基础分  bomb 范围爆炸  drop 必掉道具
  const BRICK = {
    '-': { hp: 1, color: '#38bdf8', score: 60 },
    '=': { hp: 2, color: '#a78bfa', score: 90 },
    '#': { hp: 3, color: '#f472b6', score: 140 },
    'X': { hp: 1, color: '#fb923c', score: 120, bomb: true },
    '?': { hp: 1, color: '#facc15', score: 80, drop: true }
  };

  // Boss 形态
  //   name 名称  hp 血量  shots 每次弹幕数  spread 扇形张角(rad)  speed 横向速度
  //   fireInterval 射击间隔(s)  phase2Hp 狂暴阶段触发血量比例  phase2Shots 狂暴弹幕数
  //   colorA/colorB 渐变色
  const BOSSES = {
    fortress: {
      name: '堡垒', hp: 52, shots: 1, spread: 0, speed: 120,
      fireInterval: 1.45, phase2At: 0.5, phase2Shots: 3, phase2Spread: 0.34,
      colorA: '#7c3aed', colorB: '#db2777', bullet: '#f87171'
    },
    omega: {
      name: '终焉', hp: 78, shots: 3, spread: 0.28, speed: 210,
      fireInterval: 1.15, phase2At: 0.45, phase2Shots: 5, phase2Spread: 0.5,
      colorA: '#0f172a', colorB: '#7c3aed', bullet: '#facc15'
    }
  };

  const LEVELS = [
    { name: '破晓', grid: [
      '      -      ',
      '     ---     ',
      '    -----    ',
      '   -------   ',
      '  ---------  ',
      ' ----------- ',
      '             ',
      '             ' ] },

    { name: '棱镜', grid: [
      '- - - - - - -',
      ' = = = = = = =',
      '- - - - - - -',
      ' ? = ? = ? = ?',
      '- - - - - - -',
      ' = = = = = = =',
      '- - - - - - -',
      '             ' ] },

    { name: '荆棘', grid: [
      '#############',
      '#-----------#',
      '#--#---#---#',
      '#-----------#',
      '#---XXX---#',
      '#-----------#',
      '#--#---#---#',
      '#-----------#' ] },

    { name: '环', grid: [
      '  #####  ',
      '  #---#  ',
      ' #-----# ',
      '#-------#',
      '#--?--?--#',
      '#-------#',
      ' #-----# ',
      '  #####  ' ] },

    { name: '堡垒', boss: 'fortress', grid: [
      '             ',
      '             ',
      '             ',
      '             ',
      '             ',
      '             ',
      '             ',
      '             ' ] },

    { name: '交织', grid: (() => {
      const g = [];
      for (let y = 0; y < ROWS; y++) {
        let row = '';
        for (let x = 0; x < COLS; x++) row += ((x + y) % 3 === 0) ? '#' : ((x + y) % 3 === 1 ? '=' : '-');
        g.push(row);
      }
      return g;
    })() },

    { name: '双塔', grid: (() => {
      const g = [];
      for (let y = 0; y < ROWS; y++) {
        let row = '';
        for (let x = 0; x < COLS; x++) {
          const l = x < 4, r = x > 8;
          row += (l || r) ? ((y % 2 === 0) ? '#' : '=') : ((x === 6 && y < 3) ? '?' : ' ');
        }
        g.push(row);
      }
      return g;
    })() },

    { name: '雷区', grid: (() => {
      const g = [];
      for (let y = 0; y < ROWS; y++) {
        let row = '';
        for (let x = 0; x < COLS; x++) {
          row += ((x * 7 + y * 3) % 11 < 2) ? 'X' : ((x + y) % 2 ? '-' : '=');
        }
        g.push(row);
      }
      return g;
    })() },

    { name: '螺旋', grid: (() => {
      const g = [];
      for (let y = 0; y < ROWS; y++) {
        let row = '';
        for (let x = 0; x < COLS; x++) {
          const d = Math.abs(x - 6) + Math.abs(y - 3.5);
          row += d % 2 === 0 ? '-' : (d <= 3 ? '=' : ' ');
        }
        g.push(row);
      }
      return g;
    })() },

    { name: '终焉', boss: 'omega', grid: [
      '             ',
      '             ',
      '             ',
      '             ',
      '             ',
      '             ',
      '             ',
      '             ' ] }
  ];

  // 道具
  const POWER = {
    wide:  { color: '#34d399', label: '宽', desc: '挡板变宽', w: 1.55, dur: 16 },
    small: { color: '#f87171', label: '窄', desc: '挡板变窄', w: 0.62, dur: 14 },
    multi: { color: '#60a5fa', label: '多', desc: '分裂成三球', w: 1, dur: 0 },
    laser: { color: '#facc15', label: '激', desc: '发射激光', w: 1, dur: 14 },
    slow:  { color: '#c084fc', label: '缓', desc: '球速降低', w: 1, dur: 10 },
    life:  { color: '#fb7185', label: '命', desc: '生命 +1', w: 1, dur: 0 }
  };
  const POWER_KEYS = Object.keys(POWER);

  // 难度
  const DIFFICULTY = {
    easy:   { name: '休闲', paddle: 1.35, speed: 0.80, lives: 5, hpScale: 0.8, dropRate: 1.6, label: '休闲' },
    normal: { name: '标准', paddle: 1.00, speed: 1.00, lives: 3, hpScale: 1.0, dropRate: 1.0, label: '标准' },
    hard:   { name: '硬核', paddle: 0.82, speed: 1.18, lives: 2, hpScale: 1.3, dropRate: 0.7, label: '硬核' }
  };

  P.levels = { COLS, ROWS, BRICK, BOSSES, LEVELS, POWER, POWER_KEYS, DIFFICULTY };
})(window.POJIE = window.POJIE || {});
