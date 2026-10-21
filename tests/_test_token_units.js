/* 数据看板：token 紧凑单位（K/M/B）。
 *
 *   1. fmtCompact：<1 万精确（千分位），≥1 万 K、≥100 万 M、≥10 亿 B；
 *      小数位随量级收缩、尾零去掉；单位是大写 K/M/B，与表头排序解析器
 *      （cellSortValue 的 K/M/G 换算）同一口径，带单位的单元格照样按数值排。
 *
 * Run with Node: node tests/_test_token_units.js
 */
'use strict';
const assert = require('assert');
const {dashboardHtml, dashboardScript} = require('./_dashboard_source.js');
const dom = require('./_dom_stub.js');

dom.installDom({fetch: () => Promise.resolve({ok: true, status: 200,
  json: () => Promise.resolve({}), text: () => Promise.resolve('')})});

const realLog = console.log;
console.log = () => {};
let api;
try {
  api = new Function(dashboardScript() + `
    return {
      fmtCompact: fmtCompact,
  cellSortValue: cellSortValue,
      ms: ms,
    };`)();
} catch(e) {
  console.log = realLog;
  console.error('脚本求值失败:', e.message);
  process.exit(1);
}
console.log = realLog;

/* ---- 0. 排序解析器要认得 fmtCompact 输出的每一个单位 --------------- */

// 带单位的格子必须按数值排序：fmtCompact 会输出 B，cellSortValue 就得认 B，
// 否则十亿那一格会按 1.5 排到 999M 下面去。
{
  const cell = (text) => ({textContent: text, getAttribute: () => null,
                           querySelector: () => null});
  assert.strictEqual(api.cellSortValue(cell('1.5B'), 'num'), 1.5e9);
  assert.strictEqual(api.cellSortValue(cell('999M'), 'num'), 999e6);
  assert.ok(api.cellSortValue(cell('1.5B'), 'num') > api.cellSortValue(cell('999M'), 'num'),
    'B 与 M 之间必须可比');
}

/* ---- 1. fmtCompact：单位换算 ---------------------------------------- */

const cases = [
  [0, '0'],
  [999, '999'],
  [9999, '9,999'],
  [10000, '10K'],
  [12345, '12.3K'],
  [123456, '123K'],
  [1000000, '1M'],
  [1234567, '1.23M'],
  [12345678, '12.3M'],
  [123456789, '123M'],
  [2500000000, '2.5B'],
];
for(const [input, want] of cases){
  assert.strictEqual(api.fmtCompact(input), want,
    'fmtCompact(' + input + ') 应为 ' + want + '，实际 ' + api.fmtCompact(input));
}

/* ---- 1b. ms()：延迟/耗时的自动单位（≥1000ms → s，否则 ms） ---------- */

const msCases = [
  [undefined, '—'],
  [null, '—'],
  [0, '0 ms'],
  [890, '890 ms'],
  [999.6, '1000 ms'],
  [1000, '1.00 s'],
  [1397, '1.40 s'],
  [65432.1, '65.43 s'],
];
for(const [input, want] of msCases){
  assert.strictEqual(api.ms(input), want,
    'ms(' + input + ') 应为 ' + want + '，实际 ' + api.ms(input));
}

console.log('_test_token_units.js: all assertions passed');
