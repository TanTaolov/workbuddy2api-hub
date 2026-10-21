/* 顶栏按钮的行为（#426 / #427）。

   1. 运行日志统一走顶部「运行日志」页签：顶栏不再有「在新窗口打开运行日志」
      的眼睛按钮，`toggleConsoleWindow` 随之删除；`/console/toggle` 也不再被
      请求（服务端端点保留为旧面板的兼容接口）。
   2. 关闭服务不能凭一次 postJSON 的成败宣布成功：容器或守护进程会把进程
      重新拉起，所以必须用 /health 复核；仍在运行时要如实提示。

   Run with: node tests/_test_console_shutdown.js
*/
'use strict';
const assert = require('assert');
const {dashboardHtml} = require('./_dashboard_source.js');
const {loadDashboard} = require('./_dashboard_sandbox.js');

const html = dashboardHtml();

/* ---- 1. 结构：顶栏不再有日志窗口按钮 ---------------------------------- */

assert.ok(!/id="btnConsoleToggle"/.test(html),
  '顶栏不应再有日志窗口按钮（运行日志走顶部页签）');
assert.ok(!/title="在新窗口打开运行日志"/.test(html),
  '按钮文案应一并移除');
assert.ok(!/function toggleConsoleWindow/.test(html),
  'toggleConsoleWindow 应随按钮一起删除');
assert.ok(!/postJSON\('\/console\/toggle'/.test(html),
  '页面不应再请求 /console/toggle');
assert.ok(/id="btnNavLogs"/.test(html), '运行日志的入口是顶部页签');

/* ---- 2. 关闭服务：仍活着就不能说「已关闭」 ----------------------------- */

const toasts = [];
let healthOk = true;
const page = loadDashboard({
  realTimers: true,
  confirm: () => true,
  fetch: (url) => {
    if (String(url).indexOf('/health') !== -1) {
      if (!healthOk) return Promise.reject(new Error('connection refused'));
      return Promise.resolve({status: 200, ok: true, json: () => Promise.resolve({ok: true})});
    }
    return Promise.resolve({status: 200, ok: true, json: () => Promise.resolve({ok: true})});
  },
});
page.toast = (msg, kind) => toasts.push({msg: String(msg), kind: kind});

(async () => {
  const shutdownButton = () => page.document.getElementById('btnGatewayShutdown');

  // 服务还在：/shutdown 成功，但 /health 一直 200（容器自动拉起）。
  healthOk = true;
  toasts.length = 0;
  await page.shutdownGateway({pollMs: 0, tries: 2});
  assert.ok(/仍在运行/.test(toasts.pop().msg),
    'health 还在应答时必须提示服务仍在运行');
  assert.strictEqual(shutdownButton().disabled, false,
    '关闭失败不能把按钮永久禁用');

  // 服务真的退出：/health 连接失败。
  healthOk = false;
  toasts.length = 0;
  await page.shutdownGateway({pollMs: 0, tries: 2});
  assert.ok(/已关闭/.test(toasts.pop().msg),
    'health 不再应答才算关闭成功');
  assert.strictEqual(shutdownButton().disabled, true,
    '确认关闭后按钮应禁用');

  console.log('console/shutdown suite ok');
})().catch((err) => {
  console.error(err && err.stack || err);
  process.exit(1);
});
