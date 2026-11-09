/* ===================================================================
   生日小屋 · 等距房间（isometric room）
   ------------------------------------------------------------------
   世界坐标：x 向右下方、y 向左下方、z 向上，房间 7×7。
   等距投影：sx = (x-y)·cos30, sy = (x+y)/2 - z
   所有家具在这里生成，main.js 只负责交互。
   =================================================================== */
(function () {
  'use strict';

  var U = 62;              // 一个世界单位 = 62px
  var K = 0.8660254;       // cos30
  var CX = 500, CY = 208;  // 后角（房间最里面的那个角）的屏幕位置
  var S = 7;               // 房间边长
  var WH = 3.05;           // 墙高

  /* ── 投影 ───────────────────────────────────────────── */
  function pt(x, y, z) {
    return {
      x: CX + (x - y) * K * U,
      y: CY + (x + y) * 0.5 * U - (z || 0) * U
    };
  }
  function f(n) { return (Math.round(n * 10) / 10).toString(); }
  function P(x, y, z) { var q = pt(x, y, z); return f(q.x) + ',' + f(q.y); }
  function P3(a) { return P(a[0], a[1], a[2]); }

  function poly(points, fill, extra) {
    return '<polygon points="' + points.join(' ') + '" fill="' + fill + '"' +
      (extra ? ' ' + extra : '') + '/>';
  }
  function wpoly(list, fill, extra) {
    return poly(list.map(P3), fill, extra);
  }
  function L(a, b, attrs) {
    var p1 = pt(a[0], a[1], a[2]);
    var p2 = pt(b[0], b[1], b[2]);
    return '<line x1="' + f(p1.x) + '" y1="' + f(p1.y) +
           '" x2="' + f(p2.x) + '" y2="' + f(p2.y) + '" ' + attrs + '/>';
  }
  function circleAt(x, y, z, r, fill, extra) {
    var c = pt(x, y, z);
    return '<circle cx="' + f(c.x) + '" cy="' + f(c.y) + '" r="' + r + '" fill="' +
      fill + '"' + (extra ? ' ' + extra : '') + '/>';
  }
  /* 等距下的水平圆 = 横向椭圆 */
  function ellipseAt(x, y, z, r, fill, extra) {
    var c = pt(x, y, z);
    return '<ellipse cx="' + f(c.x) + '" cy="' + f(c.y) + '" rx="' + f(r * 1.2247 * U) +
      '" ry="' + f(r * 0.7071 * U) + '" fill="' + fill + '"' + (extra ? ' ' + extra : '') + '/>';
  }

  /* ── 立方体 ─────────────────────────────────────────── */
  function box(x, y, z, w, d, h, top, sideA, sideB, attrs) {
    var a = attrs || '';
    var s = '';
    s += wpoly([[x, y + d, z], [x + w, y + d, z],
                [x + w, y + d, z + h], [x, y + d, z + h]], sideB, a);   // 朝左下
    s += wpoly([[x + w, y, z], [x + w, y + d, z],
                [x + w, y + d, z + h], [x + w, y, z + h]], sideA, a);   // 朝右下
    s += wpoly([[x, y, z + h], [x + w, y, z + h],
                [x + w, y + d, z + h], [x, y + d, z + h]], top, a);     // 顶
    return s;
  }
  /* 地面投影阴影 */
  function shadow(x, y, w, d, op) {
    return wpoly([[x + 0.06, y + d * 0.85], [x + w, y + d * 0.85],
                  [x + w + 0.10, y + d + 0.10], [x + 0.12, y + d + 0.10]],
                 '#1a1014', 'opacity="' + (op || 0.14) + '"');
  }
  /* 透明热区（点击范围） */
  function hot(x, y, w, d, z) {
    return wpoly([[x, y, z || 0], [x + w, y, z || 0],
                  [x + w, y + d, z || 0], [x, y + d, z || 0]], 'transparent');
  }
  function item(id, inner) {
    return '<g class="item" data-item="' + id + '" tabindex="0" role="button" aria-label="' +
      id + '">' + inner + '</g>';
  }

  /* ── 地板 ───────────────────────────────────────────── */
  function floor() {
    var s = '';

    // 地板厚度
    s += wpoly([[7, 0, 0], [7, 7, 0], [7, 7, -0.26], [7, 0, -0.26]], 'var(--floor-deep)');
    s += wpoly([[0, 7, 0], [7, 7, 0], [7, 7, -0.26], [0, 7, -0.26]], 'var(--floor-deep)');

    // 地板面
    s += wpoly([[0, 0, 0], [7, 0, 0], [7, 7, 0], [0, 7, 0]], 'var(--floor)');

    // 木纹：沿 x 方向的板缝
    for (var i = 1; i < 14; i++) {
      var yy = i * 0.5;
      s += L([0, yy, 0.004], [7, yy, 0.004],
             'stroke="var(--floor-line)" stroke-width="1.6" opacity=".5"');
    }
    // 错开的短接缝
    var seams = [[0.9, 0.5], [3.2, 1.5], [5.6, 1.0], [2.0, 2.5], [4.6, 3.0],
                 [1.2, 4.0], [5.0, 4.5], [3.0, 5.5], [1.5, 6.0]];
    for (var j = 0; j < seams.length; j++) {
      var sx = seams[j][0], sy = seams[j][1];
      s += L([sx, sy, 0.005], [sx, sy + 0.5, 0.005],
             'stroke="var(--floor-line)" stroke-width="1.4" opacity=".38"');
    }

    return s;
  }

  /* ── 墙 ─────────────────────────────────────────────── */
  function walls() {
    var s = '';

    // 右后墙（y = 0）
    s += wpoly([[0, 0, 0], [7, 0, 0], [7, 0, WH], [0, 0, WH]], 'var(--wall)');
    // 左后墙（x = 0）
    s += wpoly([[0, 0, 0], [0, 7, 0], [0, 7, WH], [0, 0, WH]], 'var(--wall)');

    // 左墙压暗一点，分出受光面
    s += wpoly([[0, 0, 0], [0, 7, 0], [0, 7, WH], [0, 0, WH]], '#20161f',
               'opacity=".11"');

    // 墙顶压边
    s += L([0, 0, WH], [7, 0, WH], 'stroke="var(--wall-top)" stroke-width="5" stroke-linecap="round"');
    s += L([0, 0, WH], [0, 7, WH], 'stroke="var(--wall-top)" stroke-width="5" stroke-linecap="round"');

    // 踢脚线
    s += L([0, 0.02, 0], [7, 0.02, 0], 'stroke="var(--base)" stroke-width="7" opacity=".85"');
    s += L([0.02, 0, 0], [0.02, 7, 0], 'stroke="var(--base)" stroke-width="7" opacity=".85"');

    return s;
  }

  /* ── 窗（右墙 y=0） ─────────────────────────────────── */
  function windowOnWall() {
    var x1 = 4.15, x2 = 5.95, z1 = 0.95, z2 = 2.25;
    var s = '';

    // 窗框
    s += wpoly([[x1 - 0.07, 0.012, z1 - 0.07], [x2 + 0.07, 0.012, z1 - 0.07],
                [x2 + 0.07, 0.012, z2 + 0.07], [x1 - 0.07, 0.012, z2 + 0.07]],
               'var(--wood-dark)');

    // 玻璃
    var quad = [[x1, 0.02, z1], [x2, 0.02, z1], [x2, 0.02, z2], [x1, 0.02, z2]];
    s += '<g class="sky-frame">';
    s += wpoly(quad, 'url(#skyGrad)');

    // 裁切，天空内容只出现在窗里
    var cPts = quad.map(P3).join(' ');
    s += '<clipPath id="winClip"><polygon points="' + cPts + '"/></clipPath>';
    s += '<g clip-path="url(#winClip)">';

    // 用墙面的仿射关系摆天空元素：沿 (x,z) 放，再投影
    function skyDot(xx, zz, r, fill, op) {
      var q = pt(xx, 0.02, zz);
      return '<circle cx="' + f(q.x) + '" cy="' + f(q.y) + '" r="' + r +
             '" fill="' + fill + '" opacity="' + (op == null ? 1 : op) + '"/>';
    }

    // 白天
    s += '<g class="sky sky-day">';
    s += skyDot(5.55, 2.02, 17, '#fff8d6');
    s += skyDot(4.75, 1.85, 13, '#ffffff', .72);
    s += skyDot(4.55, 1.72, 8, '#ffffff', .72);
    s += skyDot(5.05, 1.28, 16, '#ffffff', .55);
    s += '</g>';

    // 黄昏
    s += '<g class="sky sky-dusk">';
    s += skyDot(5.55, 1.28, 18, '#ffc98a');
    s += skyDot(4.85, 2.02, 13, '#ffd9b8', .55);
    s += skyDot(5.35, 2.05, 9, '#ffd9b8', .45);
    s += '</g>';

    // 夜
    s += '<g class="sky sky-night">';
    s += skyDot(5.5, 2.0, 15, '#fdf3d0');
    s += skyDot(5.63, 1.94, 14, 'var(--sky-top)');
    var stars = [[4.45, 1.9, 1.8], [4.75, 2.12, 1.4], [5.0, 1.62, 1.6],
                 [5.3, 1.98, 1.3], [5.75, 1.55, 1.7], [4.6, 1.35, 1.3],
                 [5.15, 1.2, 1.5]];
    for (var i = 0; i < stars.length; i++) {
      s += skyDot(stars[i][0], stars[i][1], stars[i][2], '#fff8dc', .95);
    }
    s += '</g>';

    // 流星
    s += '<g class="sky sky-meteor">';
    for (var m = 0; m < stars.length; m++) {
      s += skyDot(stars[m][0], stars[m][1], stars[m][2], '#fff8dc', .95);
    }
    s += skyDot(5.5, 2.0, 15, '#fdf3d0');
    s += skyDot(5.63, 1.94, 14, '#2b3352');
    s += L([4.7, 0.02, 2.05], [4.45, 0.02, 1.78],
           'stroke="#fff8dc" stroke-width="2.4" stroke-linecap="round" class="meteor"');
    s += L([5.2, 0.02, 1.95], [5.05, 0.02, 1.78],
           'stroke="#fff8dc" stroke-width="2" stroke-linecap="round" class="meteor"');
    s += '</g>';

    s += '</g>';       // clip

    // 窗格：竖梃 + 横梃
    var mid = (x1 + x2) / 2;
    s += wpoly([[mid - 0.035, 0.03, z1], [mid + 0.035, 0.03, z1],
                [mid + 0.035, 0.03, z2], [mid - 0.035, 0.03, z2]], 'var(--wood-dark)');
    var zm = (z1 + z2) / 2;
    s += wpoly([[x1, 0.03, zm - 0.035], [x2, 0.03, zm - 0.035],
                [x2, 0.03, zm + 0.035], [x1, 0.03, zm + 0.035]], 'var(--wood-dark)');

    s += '</g>';

    // 窗台
    s += box(x1 - 0.16, 0, z1 - 0.12, (x2 - x1) + 0.32, 0.20, 0.10,
             'var(--wood)', 'var(--wood)', 'var(--wood-dark)');

    return item('window', s + hot(x1 - 0.2, 0, (x2 - x1) + 0.4, 0.32, z1 - 0.15));
  }

  /* ── 门（左墙 x=0） ─────────────────────────────────── */
  function doorOnWall() {
    var y1 = 4.35, y2 = 5.65, z1 = 0, z2 = 2.25;
    var s = '';

    // 门框
    s += wpoly([[0.012, y1 - 0.08, z1], [0.012, y2 + 0.08, z1],
                [0.012, y2 + 0.08, z2 + 0.08], [0.012, y1 - 0.08, z2 + 0.08]],
               'var(--wood-dark)');

    // 门板
    s += '<g class="door-leaf">';
    s += wpoly([[0.022, y1, z1], [0.022, y2, z1], [0.022, y2, z2], [0.022, y1, z2]],
               'var(--wood)');
    // 两块凹板
    s += wpoly([[0.03, y1 + 0.12, 0.22], [0.03, y2 - 0.12, 0.22],
                [0.03, y2 - 0.12, 1.0], [0.03, y1 + 0.12, 1.0]],
               'var(--furni-2)', 'opacity=".55"');
    s += wpoly([[0.03, y1 + 0.12, 1.14], [0.03, y2 - 0.12, 1.14],
                [0.03, y2 - 0.12, 2.05], [0.03, y1 + 0.12, 2.05]],
               'var(--furni-2)', 'opacity=".55"');
    s += '</g>';

    // 门把手
    s += circleAt(0.05, y2 - 0.16, 1.02, 5, 'var(--line)', 'opacity=".8"');

    return item('door', s + hot(0, y1 - 0.1, 0.3, (y2 - y1) + 0.2, 0));
  }

  /* ── 相框（左墙 x=0） ───────────────────────────────── */
  function frameOnWall() {
    var y1 = 2.25, y2 = 3.25, z1 = 1.25, z2 = 2.15;
    var s = '';
    s += wpoly([[0.012, y1 - 0.05, z1 - 0.05], [0.012, y2 + 0.05, z1 - 0.05],
                [0.012, y2 + 0.05, z2 + 0.05], [0.012, y1 - 0.05, z2 + 0.05]],
               'var(--wood-dark)');
    s += '<g class="frame-art">';
    s += wpoly([[0.02, y1, z1], [0.02, y2, z1], [0.02, y2, z2], [0.02, y1, z2]],
               'var(--paper)');
    // 小风景：两座山 + 一个太阳
    s += wpoly([[0.028, y1 + 0.1, z1 + 0.14], [0.028, y1 + 0.52, z1 + 0.52],
                [0.028, y1 + 0.95, z1 + 0.14]], 'var(--accent-3)', 'opacity=".85"');
    s += wpoly([[0.028, y1 + 0.58, z1 + 0.14], [0.028, y1 + 0.86, z1 + 0.40],
                [0.028, y2 - 0.08, z1 + 0.14]], 'var(--accent-3)', 'opacity=".55"');
    s += circleAt(0.03, y2 - 0.26, z2 - 0.22, 8, 'var(--accent)', 'opacity=".8"');
    s += '</g>';

    return item('frame', s + hot(0, y1 - 0.1, 0.3, (y2 - y1) + 0.2, 0));
  }

  /* ── 灯串（两面墙上各一段） ─────────────────────────── */
  function stringLights() {
    var s = '';
    var i, t, q;

    // 右墙 y=0，x 从 0.5 到 4.0
    var seg1 = [];
    for (i = 0; i <= 10; i++) {
      t = i / 10;
      var xx = 0.5 + t * 3.5;
      var zz = 2.62 + Math.sin(t * Math.PI) * -0.16;
      q = pt(xx, 0.05, zz);
      seg1.push(f(q.x) + ',' + f(q.y));
    }
    s += '<polyline points="' + seg1.join(' ') +
         '" fill="none" stroke="var(--line)" stroke-width="2.4" opacity=".38" stroke-linecap="round"/>';

    // 左墙 x=0，y 从 0.5 到 4.0
    var seg2 = [];
    for (i = 0; i <= 10; i++) {
      t = i / 10;
      var yy = 0.5 + t * 3.5;
      var z2 = 2.62 + Math.sin(t * Math.PI) * -0.16;
      q = pt(0.05, yy, z2);
      seg2.push(f(q.x) + ',' + f(q.y));
    }
    s += '<polyline points="' + seg2.join(' ') +
         '" fill="none" stroke="var(--line)" stroke-width="2.4" opacity=".38" stroke-linecap="round"/>';

    // 灯泡
    var bulbs = [];
    for (i = 1; i <= 4; i++) {
      t = i / 5;
      bulbs.push([0.5 + t * 3.5, 0.05, 2.60 + Math.sin(t * Math.PI) * -0.16, true]);
    }
    for (i = 1; i <= 4; i++) {
      t = i / 5;
      bulbs.push([0.05, 0.5 + t * 3.5, 2.60 + Math.sin(t * Math.PI) * -0.16, false]);
    }
    for (i = 0; i < bulbs.length; i++) {
      var b = bulbs[i];
      var c = pt(b[0], b[1], b[2]);
      s += '<g class="bulb">';
      s += '<circle cx="' + f(c.x) + '" cy="' + f(c.y) + '" r="15" fill="url(#glowTiny)" class="bulb-halo"/>';
      s += '<circle cx="' + f(c.x) + '" cy="' + f(c.y) + '" r="6.5" class="bulb-core"/>';
      s += '</g>';
    }

    // 顶部一条透明带做点击区（两块）
    s += wpoly([[0.3, 0, 2.3], [4.2, 0, 2.3], [4.2, 0, 2.95], [0.3, 0, 2.95]], 'transparent');
    s += wpoly([[0, 0.3, 2.3], [0, 4.2, 2.3], [0, 4.2, 2.95], [0, 0.3, 2.95]], 'transparent');

    return item('lights', s);
  }

  /* ── 书架（靠右墙） ─────────────────────────────────── */
  function shelf() {
    var x = 2.30, y = 0.14, w = 1.30, d = 0.34, h = 1.82;
    var s = '';

    s += shadow(x, y, w, d, 0.16);
    s += box(x, y, 0, w, d, h, 'var(--wood)', 'var(--wood)', 'var(--wood-dark)');

    // 朝房间内那一面（y+d）上的层板与书
    var fy = y + d + 0.006;
    var levels = [0.62, 1.22];
    for (var i = 0; i < levels.length; i++) {
      s += wpoly([[x + 0.05, fy, levels[i]], [x + w - 0.05, fy, levels[i]],
                  [x + w - 0.05, fy, levels[i] + 0.07], [x + 0.05, fy, levels[i] + 0.07]],
                 'var(--wood-dark)');
    }

    // 书
    var books = [
      [x + 0.08, 0.03, 0.64, 0.52, 'var(--accent-3)'],
      [x + 0.12, 0.05, 0.69, 0.47, 'var(--accent)'],
      [x + 0.18, 0.04, 0.72, 0.44, 'var(--furni)'],
      [x + 0.23, 0.06, 0.66, 0.50, 'var(--accent-2)'],
      [x + 0.30, 0.04, 0.70, 0.46, 'var(--line)'],
      [x + 0.36, 0.05, 0.68, 0.48, 'var(--accent-3)'],
      [x + 0.43, 0.04, 0.73, 0.43, 'var(--accent)'],
      [x + 0.08, 0.03, 1.24, 0.50, 'var(--accent)'],
      [x + 0.13, 0.05, 1.28, 0.46, 'var(--furni)'],
      [x + 0.19, 0.04, 1.25, 0.49, 'var(--accent-3)'],
      [x + 0.25, 0.06, 1.30, 0.44, 'var(--accent-2)'],
      [x + 0.32, 0.04, 1.26, 0.48, 'var(--line)'],
      [x + 0.39, 0.05, 1.29, 0.45, 'var(--accent)']
    ];
    for (var j = 0; j < books.length; j++) {
      var b = books[j];
      s += wpoly([[b[0], fy, b[2]], [b[0] + b[1], fy, b[2]],
                  [b[0] + b[1], fy, b[2] + b[3]], [b[0], fy, b[2] + b[3]]],
                 b[4], 'opacity=".92"');
    }

    // 书籍阴影落在层板上
    s += wpoly([[x + 0.05, fy - 0.004, 0.60], [x + w - 0.05, fy - 0.004, 0.60],
                [x + w - 0.05, fy - 0.004, 0.64], [x + 0.05, fy - 0.004, 0.64]],
               '#000', 'opacity=".10"');

    return item('books', s + hot(x, y, w, d + 0.12, 0));
  }

  /* ── 床（靠左墙） ───────────────────────────────────── */
  function bed() {
    var x = 0.30, y = 0.95, w = 1.72, d = 2.05;
    var s = '';

    s += shadow(x, y, w, d, 0.16);

    // 床架
    s += box(x, y, 0, w, d, 0.30, 'var(--wood)', 'var(--wood)', 'var(--wood-dark)');
    // 床垫
    s += box(x + 0.05, y + 0.05, 0.30, w - 0.10, d - 0.10, 0.16,
             'var(--paper)', 'var(--paper)', 'var(--furni)');

    // 被子（在床垫顶面）
    s += '<g class="duvet">';
    s += wpoly([[x + 0.06, y + 0.72, 0.472], [x + w - 0.06, y + 0.72, 0.472],
                [x + w - 0.06, y + d - 0.05, 0.472], [x + 0.06, y + d - 0.05, 0.472]],
               'var(--accent-2)');
    s += wpoly([[x + 0.06, y + 0.72, 0.476], [x + w - 0.06, y + 0.72, 0.476],
                [x + w - 0.06, y + 0.84, 0.476], [x + 0.06, y + 0.84, 0.476]],
               'var(--paper)', 'opacity=".65"');
    s += '</g>';

    // 枕头
    s += box(x + 0.16, y + 0.16, 0.46, 0.62, 0.38, 0.13,
             'var(--paper)', 'var(--paper)', 'var(--furni)');

    // 床头板（靠左墙那端）
    s += box(x, y - 0.06, 0, 0.10, d + 0.02, 0.78,
             'var(--wood-dark)', 'var(--wood-dark)', 'var(--wood-dark)');

    return item('bed', s + hot(x, y - 0.1, w, d + 0.1, 0));
  }

  /* ── 蛋糕桌 ─────────────────────────────────────────── */
  function cakeTable() {
    var x = 3.42, y = 2.98, w = 1.06, d = 1.06;
    var s = '';

    s += shadow(x, y, w, d, 0.18);

    // 桌腿 + 桌面
    s += box(x + 0.06, y + 0.06, 0, 0.10, 0.10, 0.66, 'var(--wood-dark)', 'var(--wood-dark)', 'var(--wood-dark)');
    s += box(x + w - 0.16, y + 0.06, 0, 0.10, 0.10, 0.66, 'var(--wood-dark)', 'var(--wood-dark)', 'var(--wood-dark)');
    s += box(x + 0.06, y + d - 0.16, 0, 0.10, 0.10, 0.66, 'var(--wood-dark)', 'var(--wood-dark)', 'var(--wood-dark)');
    s += box(x + w - 0.16, y + d - 0.16, 0, 0.10, 0.10, 0.66, 'var(--wood-dark)', 'var(--wood-dark)', 'var(--wood-dark)');
    s += box(x, y, 0.66, w, d, 0.09, 'var(--wood)', 'var(--wood)', 'var(--wood-dark)');

    // 桌布
    s += wpoly([[x + 0.07, y + 0.07, 0.752], [x + w - 0.07, y + 0.07, 0.752],
                [x + w - 0.07, y + d - 0.07, 0.752], [x + 0.07, y + d - 0.07, 0.752]],
               'var(--paper)', 'opacity=".55"');

    // 蛋糕
    s += '<g class="cake-body">';
    s += ellipseAt(3.95, 3.51, 0.757, 0.30, '#1a1014', 'opacity=".16"');
    s += box(3.76, 3.32, 0.757, 0.38, 0.38, 0.26, 'var(--accent)', 'var(--accent)', '#c96f80');
    // 奶油顶
    s += box(3.74, 3.30, 1.017, 0.42, 0.42, 0.07, 'var(--paper)', 'var(--paper)', 'var(--furni)');
    // 蜡烛
    s += box(3.935, 3.495, 1.087, 0.06, 0.06, 0.30, 'var(--accent-2)', 'var(--accent-2)', '#d68b9c');
    s += '</g>';

    // 火焰 + 光晕（屏幕坐标，直接摆）
    var fl = pt(3.965, 3.525, 1.39);
    s += '<g class="flame" opacity="0">';
    s += '<ellipse cx="' + f(fl.x) + '" cy="' + f(fl.y - 6) + '" rx="34" ry="34" fill="url(#glowBig)"/>';
    s += '<path d="M' + f(fl.x) + ',' + f(fl.y - 22) +
         ' C' + f(fl.x + 8) + ',' + f(fl.y - 12) +
         ' ' + f(fl.x + 8) + ',' + f(fl.y - 2) +
         ' ' + f(fl.x) + ',' + f(fl.y + 2) +
         ' C' + f(fl.x - 8) + ',' + f(fl.y - 2) +
         ' ' + f(fl.x - 8) + ',' + f(fl.y - 12) +
         ' ' + f(fl.x) + ',' + f(fl.y - 22) + ' Z" fill="#ffd166"/>';
    s += '<path d="M' + f(fl.x) + ',' + f(fl.y - 14) +
         ' C' + f(fl.x + 4) + ',' + f(fl.y - 7) +
         ' ' + f(fl.x + 4) + ',' + f(fl.y - 1) +
         ' ' + f(fl.x) + ',' + f(fl.y + 1) +
         ' C' + f(fl.x - 4) + ',' + f(fl.y - 1) +
         ' ' + f(fl.x - 4) + ',' + f(fl.y - 7) +
         ' ' + f(fl.x) + ',' + f(fl.y - 14) + ' Z" fill="#fff3c4"/>';
    s += '</g>';

    // 烟
    s += '<g class="smoke" opacity="0">';
    s += '<path d="M' + f(fl.x) + ',' + f(fl.y - 8) + ' q10,-18 2,-34 q-8,-16 4,-30" fill="none" stroke="var(--line)" stroke-width="3" stroke-linecap="round" opacity=".35"/>';
    s += '</g>';

    return item('cake', s + hot(x - 0.12, y - 0.12, w + 0.24, d + 0.24, 0));
  }

  /* ── 唱片机柜 ───────────────────────────────────────── */
  function recordPlayer() {
    var x = 5.42, y = 2.72, w = 0.98, d = 0.54;
    var s = '';

    s += shadow(x, y, w, d, 0.16);
    s += box(x, y, 0, w, d, 0.58, 'var(--wood)', 'var(--wood)', 'var(--wood-dark)');

    // 柜门缝
    s += wpoly([[x + 0.06, y + d + 0.008, 0.08], [x + w - 0.06, y + d + 0.008, 0.08],
                [x + w - 0.06, y + d + 0.008, 0.50], [x + 0.06, y + d + 0.008, 0.50]],
               'var(--wood-dark)', 'opacity=".55"');

    // 唱机
    s += box(x + 0.07, y + 0.07, 0.58, w - 0.14, d - 0.14, 0.09,
             'var(--furni)', 'var(--furni)', 'var(--furni-2)');

    // 唱盘
    var tx = x + 0.42, ty = y + d / 2;
    s += '<g class="platter-g">';
    s += ellipseAt(tx, ty, 0.675, 0.155, 'var(--night)');
    s += ellipseAt(tx, ty, 0.678, 0.045, 'var(--accent-2)');
    s += '</g>';

    // 唱臂
    s += L([x + w - 0.16, y + 0.14, 0.68], [x + w - 0.30, y + 0.20, 0.68],
           'stroke="var(--line)" stroke-width="3.5" stroke-linecap="round" opacity=".7"');

    // 音符
    var n1 = pt(x + 0.70, y + 0.10, 1.05);
    s += '<text class="music-note n1" x="' + f(n1.x) + '" y="' + f(n1.y) + '">♪</text>';
    var n2 = pt(x + 0.86, y + 0.22, 1.16);
    s += '<text class="music-note n2" x="' + f(n2.x) + '" y="' + f(n2.y) + '">♫</text>';
    var n3 = pt(x + 0.62, y + 0.30, 1.22);
    s += '<text class="music-note n3" x="' + f(n3.x) + '" y="' + f(n3.y) + '">♪</text>';

    return item('record', s + hot(x, y, w, d + 0.1, 0));
  }

  /* ── 落地灯 ─────────────────────────────────────────── */
  function floorLamp() {
    var x = 0.70, y = 6.30;
    var s = '';

    s += ellipseAt(x, y, 0.02, 0.30, '#1a1014', 'opacity=".14"');
    s += ellipseAt(x, y, 0.03, 0.24, 'var(--wood-dark)');
    s += L([x, y, 0.03], [x, y, 1.52], 'stroke="var(--line)" stroke-width="5" stroke-linecap="round"');

    // 灯罩
    s += '<g class="lamp-shade">';
    s += wpoly([[x - 0.30, y, 1.16], [x + 0.30, y, 1.16],
                [x + 0.17, y, 1.56], [x - 0.17, y, 1.56]], 'var(--furni-2)');
    s += ellipseAt(x, y, 1.56, 0.17, 'var(--furni)');
    s += '</g>';

    // 光晕
    var g = pt(x, y, 1.28);
    s += '<g class="lamp-glow" opacity="0">';
    s += '<ellipse cx="' + f(g.x) + '" cy="' + f(g.y) + '" rx="112" ry="112" fill="url(#glowBig)"/>';
    s += '</g>';

    return item('lamp', s + hot(x - 0.45, y - 0.45, 0.9, 0.9, 0));
  }

  /* ── 猫 ─────────────────────────────────────────────── */
  function cat() {
    var x = 2.72, y = 4.58;
    var c = pt(x, y, 0);
    var s = '';

    s += ellipseAt(x, y + 0.05, 0.012, 0.38, '#1a1014', 'opacity=".17"');

    s += '<g class="cat-body">';
    // 尾巴：从身侧绕到后面再翘起来
    s += '<path d="M' + f(c.x - 38) + ',' + f(c.y - 14) +
         ' C' + f(c.x - 62) + ',' + f(c.y - 14) +
         ' ' + f(c.x - 66) + ',' + f(c.y - 48) +
         ' ' + f(c.x - 46) + ',' + f(c.y - 46) + '"' +
         ' fill="none" stroke="var(--furni-2)" stroke-width="10" stroke-linecap="round"/>';
    // 身体
    s += '<ellipse cx="' + f(c.x) + '" cy="' + f(c.y - 20) + '" rx="37" ry="24" fill="var(--furni-2)"/>';
    // 前爪
    s += '<ellipse cx="' + f(c.x + 18) + '" cy="' + f(c.y - 4) + '" rx="15" ry="8" fill="var(--furni-2)"/>';
    // 头
    s += '<circle cx="' + f(c.x + 30) + '" cy="' + f(c.y - 33) + '" r="20" fill="var(--furni-2)"/>';
    // 耳朵
    s += '<path d="M' + f(c.x + 15) + ',' + f(c.y - 45) +
         ' L' + f(c.x + 11) + ',' + f(c.y - 63) +
         ' L' + f(c.x + 30) + ',' + f(c.y - 51) + ' Z" fill="var(--furni-2)"/>';
    s += '<path d="M' + f(c.x + 42) + ',' + f(c.y - 49) +
         ' L' + f(c.x + 53) + ',' + f(c.y - 64) +
         ' L' + f(c.x + 54) + ',' + f(c.y - 45) + ' Z" fill="var(--furni-2)"/>';
    // 眼睛
    s += '<circle class="cat-eye" cx="' + f(c.x + 24) + '" cy="' + f(c.y - 35) + '" r="3.2" fill="var(--line)"/>';
    s += '<circle class="cat-eye" cx="' + f(c.x + 38) + '" cy="' + f(c.y - 35) + '" r="3.2" fill="var(--line)"/>';
    // 鼻子
    s += '<path d="M' + f(c.x + 31) + ',' + f(c.y - 27) +
         ' l-3.6,5 l7.2,0 Z" fill="var(--accent)"/>';
    s += '</g>';

    s += '<circle cx="' + f(c.x + 2) + '" cy="' + f(c.y - 24) + '" r="54" fill="transparent"/>';

    return item('cat', s);
  }

  /* ── 礼物盒（地上的） ───────────────────────────────── */
  function giftBox() {
    var x = 1.05, y = 4.30, w = 0.44, d = 0.44, h = 0.38;
    var s = '';

    s += shadow(x, y, w, d, 0.16);

    s += '<g class="gift-body">';
    s += box(x, y, 0, w, d, h, 'var(--accent)', 'var(--accent)', '#c96f80');
    // 丝带
    var cx = x + w / 2;
    s += wpoly([[cx - 0.035, y, h + 0.004], [cx + 0.035, y, h + 0.004],
                [cx + 0.035, y + d, h + 0.004], [cx - 0.035, y + d, h + 0.004]],
               'var(--paper)');
    s += wpoly([[x, y + d / 2 - 0.035, h + 0.004], [x + w, y + d / 2 - 0.035, h + 0.004],
                [x + w, y + d / 2 + 0.035, h + 0.004], [x, y + d / 2 + 0.035, h + 0.004]],
               'var(--paper)');
    // 丝带侧面
    s += wpoly([[x + w, y + d / 2 - 0.035, 0], [x + w, y + d / 2 + 0.035, 0],
                [x + w, y + d / 2 + 0.035, h], [x + w, y + d / 2 - 0.035, h]],
               'var(--paper)', 'opacity=".9"');
    // 蝴蝶结
    var bc = pt(cx, y + d / 2, h + 0.02);
    s += '<path d="M' + f(bc.x) + ',' + f(bc.y) +
         ' c-16,-12 -22,2 -8,5 c-2,-10 8,-11 8,-5 z" fill="var(--paper)"/>';
    s += '<path d="M' + f(bc.x) + ',' + f(bc.y) +
         ' c16,-12 22,2 8,5 c2,-10 -8,-11 -8,-5 z" fill="var(--paper)"/>';
    s += '</g>';

    return item('gift', s + hot(x, y, w, d, 0));
  }

  /* ── 气球（悬空） ───────────────────────────────────── */
  function balloon() {
    var bx = 1.95, by = 3.45, bz = 2.30;
    var c = pt(bx, by, bz);
    var g = pt(bx, by, 0);
    var s = '';

    s += ellipseAt(bx, by, 0.02, 0.22, '#1a1014', 'opacity=".10"');

    // 绳
    s += '<path class="balloon-string" d="M' + f(c.x) + ',' + f(c.y + 30) +
         ' Q' + f(c.x + 16) + ',' + f((c.y + g.y) / 2) +
         ' ' + f(g.x + 4) + ',' + f(g.y) +
         '" fill="none" stroke="var(--line)" stroke-width="1.8" opacity=".42"/>';

    s += '<g class="balloon-body">';
    s += '<ellipse cx="' + f(c.x) + '" cy="' + f(c.y) + '" rx="26" ry="31" fill="var(--accent)"/>';
    s += '<path d="M' + f(c.x) + ',' + f(c.y + 31) + ' l-6,10 l12,0 z" fill="var(--accent)"/>';
    s += '<ellipse cx="' + f(c.x - 9) + '" cy="' + f(c.y - 11) + '" rx="7" ry="11" fill="var(--paper)" opacity=".42"/>';
    s += '</g>';

    s += '<circle cx="' + f(c.x) + '" cy="' + f(c.y) + '" r="38" fill="transparent"/>';

    return item('balloon', s);
  }

  /* ── 窗外落进来的黄昏光 ─────────────────────────────── */
  function windowLight() {
    var s = '';

    // 主光斑
    s += wpoly([[3.90, 0.22, 0.010], [6.20, 0.22, 0.010],
                [6.20, 2.80, 0.010], [3.90, 2.80, 0.010]],
               'var(--glow)', 'opacity=".17"');
    // 近窗处更亮
    s += wpoly([[4.15, 0.22, 0.011], [5.95, 0.22, 0.011],
                [5.95, 1.55, 0.011], [4.15, 1.55, 0.011]],
               'var(--glow)', 'opacity=".15"');

    // 窗棂投下的影子
    s += wpoly([[5.00, 0.22, 0.012], [5.10, 0.22, 0.012],
                [5.10, 2.80, 0.012], [5.00, 2.80, 0.012]],
               '#2a1a14', 'opacity=".15"');
    s += wpoly([[3.90, 1.46, 0.012], [6.20, 1.46, 0.012],
                [6.20, 1.56, 0.012], [3.90, 1.56, 0.012]],
               '#2a1a14', 'opacity=".11"');

    // 空气里的灰
    var dust = [[4.55, 1.15], [5.35, 1.90], [4.95, 2.45],
                [5.70, 1.20], [4.25, 2.05], [5.15, 0.70]];
    for (var i = 0; i < dust.length; i++) {
      var q = pt(dust[i][0], dust[i][1], 0.62 + (i % 3) * 0.22);
      s += '<circle class="dust d' + (i + 1) + '" cx="' + f(q.x) + '" cy="' +
           f(q.y) + '" r="1.7" fill="var(--glow)" opacity=".45"/>';
    }

    return s;
  }

  /* ── 胶卷（挂在左墙，点开是照片轮播） ───────────────── */
  function filmOnWall() {
    var x = 0.032;
    var y1 = 3.26, y2 = 4.28;   // 沿墙方向
    var z1 = 1.28, z2 = 1.94;   // 高度
    var s = '';

    // 胶片底
    s += wpoly([[x, y1, z1], [x, y2, z1], [x, y2, z2], [x, y1, z2]], '#31251b');
    // 内圈
    s += wpoly([[x + 0.002, y1 + 0.03, z1 + 0.03], [x + 0.002, y2 - 0.03, z1 + 0.03],
                [x + 0.002, y2 - 0.03, z2 - 0.03], [x + 0.002, y1 + 0.03, z2 - 0.03]],
               '#1d1610');

    // 上下齿孔
    var n = 7;
    for (var i = 0; i < n; i++) {
      var cy = y1 + (y2 - y1) * (i + 0.5) / n;
      var hw = (y2 - y1) / n * 0.26;
      s += wpoly([[x + 0.004, cy - hw, z1 + 0.045], [x + 0.004, cy + hw, z1 + 0.045],
                  [x + 0.004, cy + hw, z1 + 0.115], [x + 0.004, cy - hw, z1 + 0.115]],
                 '#e6d8bf', 'opacity=".85"');
      s += wpoly([[x + 0.004, cy - hw, z2 - 0.115], [x + 0.004, cy + hw, z2 - 0.115],
                  [x + 0.004, cy + hw, z2 - 0.045], [x + 0.004, cy - hw, z2 - 0.045]],
                 '#e6d8bf', 'opacity=".85"');
    }

    // 三个画面
    var tones = ['var(--accent-3)', 'var(--accent)', 'var(--accent-2)'];
    for (var j = 0; j < 3; j++) {
      var a = y1 + 0.06 + j * 0.325;
      var b = a + 0.285;
      s += wpoly([[x + 0.006, a, z1 + 0.155], [x + 0.006, b, z1 + 0.155],
                  [x + 0.006, b, z2 - 0.155], [x + 0.006, a, z2 - 0.155]],
                 tones[j], 'opacity=".92"');
      s += wpoly([[x + 0.008, a + 0.04, z1 + 0.23], [x + 0.008, b - 0.04, z1 + 0.23],
                  [x + 0.008, b - 0.04, z2 - 0.24], [x + 0.008, a + 0.04, z2 - 0.24]],
                 'var(--paper)', 'opacity=".35"');
    }

    return item('film', s + hot(0, y1 - 0.12, 0.32, (y2 - y1) + 0.24, 0));
  }

  /* ── 组 装 ──────────────────────────────────────────── */
  function build() {
    var s = '';

    s += '<defs>';
    s += '<radialGradient id="glowBig" cx="50%" cy="50%" r="50%">' +
         '<stop offset="0%" stop-color="var(--glow)" stop-opacity=".55"/>' +
         '<stop offset="55%" stop-color="var(--glow)" stop-opacity=".20"/>' +
         '<stop offset="100%" stop-color="var(--glow)" stop-opacity="0"/>' +
         '</radialGradient>';
    s += '<radialGradient id="glowTiny" cx="50%" cy="50%" r="50%">' +
         '<stop offset="0%" stop-color="var(--glow)" stop-opacity=".95"/>' +
         '<stop offset="100%" stop-color="var(--glow)" stop-opacity="0"/>' +
         '</radialGradient>';
    s += '<linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">' +
         '<stop offset="0%" stop-color="var(--sky-top)"/>' +
         '<stop offset="100%" stop-color="var(--sky-deep)"/>' +
         '</linearGradient>';
    s += '</defs>';

    // 由远到近
    s += floor();
    s += wpoly([[2.05, 2.25, 0.006], [5.55, 2.25, 0.006],
                [5.55, 5.25, 0.006], [2.05, 5.25, 0.006]],
               'var(--accent-2)', 'opacity=".30"');
    s += wpoly([[2.18, 2.38, 0.007], [5.42, 2.38, 0.007],
                [5.42, 5.12, 0.007], [2.18, 5.12, 0.007]],
               'var(--paper)', 'opacity=".16"');
    s += windowLight();
    s += walls();
    s += windowOnWall();
    s += frameOnWall();
    s += filmOnWall();
    s += doorOnWall();
    s += stringLights();
    s += bed();
    s += shelf();
    s += balloon();
    s += giftBox();
    s += floorLamp();
    s += cakeTable();
    s += cat();
    s += recordPlayer();

    // 暗度遮罩
    s += '<rect class="darkness" x="0" y="0" width="1000" height="700" fill="#171222" opacity=".42" pointer-events="none"/>';

    // 星星层
    s += '<g class="star-layer" pointer-events="none"></g>';

    return s;
  }

  /* 蜡烛上方 —— 星星飞到这里 */
  var starPt = pt(3.965, 3.525, 1.72);

  window.ISOROOM = {
    build: build,
    starTarget: { x: starPt.x, y: starPt.y },
    toScreen: pt
  };
})();
