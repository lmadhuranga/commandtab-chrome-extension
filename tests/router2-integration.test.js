const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const newtab = fs.readFileSync(path.join(root, 'newtab.js'), 'utf8');
const newtabHtml = fs.readFileSync(path.join(root, 'newtab.html'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'settings.js'), 'utf8');
const settingsHtml = fs.readFileSync(path.join(root, 'settings.html'), 'utf8');

test('Router 2 API uses the audited POST endpoint and browser headers', () => {
  assert.match(newtab, /ROUTER2_API_PATH=['"]\/cgi-bin\/http\.cgi/);
  assert.match(newtab, /method:'POST'/);
  assert.match(newtab, /credentials:'include'/);
  assert.match(newtab, /X-Requested-With/);
  assert.match(newtab, /Referer:`\$\{router2Origin\}\/mindex\.html`/);
  assert.doesNotMatch(newtab, /cgi-bin\/http\.cgi\?/);
});

test('Router 2 credentials are hash-only in storage and password input stays blank', () => {
  assert.match(settings, /router2PasswordHash=RouterMD5\.md5\(password\)/);
  assert.match(settings, /router2Password'\)\.value=''/);
  assert.match(settingsHtml, /id="router2Password" type="password"/);
  assert.match(settingsHtml, /Leave blank to preserve/);
  assert.doesNotMatch(settings, /console\.(log|warn|error)/);
  assert.match(newtab, /const ROUTER2_DEFAULT_PASSWORD_HASH=['"]21232f297a57a5a743894a0e4a801fc3['"]/);
  assert.match(newtab, /passwordHash:savedPasswordHash\|\|ROUTER2_DEFAULT_PASSWORD_HASH/);
  assert.match(newtab, /source:savedUsername\|\|savedPasswordHash\?'saved settings':'built-in default'/);
});

test('Router 2 uses a non-empty built-in credential and lets saved settings override it', () => {
  const hash = newtab.match(/const ROUTER2_DEFAULT_PASSWORD_HASH=['"]([^'"]+)['"]/)?.[1];
  assert.ok(hash, 'built-in Router 2 password hash should be non-empty');
  const resolverSource = newtab.match(/function resolveRouter2Credentials\(values=\{\}\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(resolverSource, 'Router 2 credential resolver should remain explicit');
  const resolver = vm.runInNewContext(`const ROUTER2_DEFAULT_USERNAME='admin'; const ROUTER2_DEFAULT_PASSWORD_HASH='${hash}'; ${resolverSource}; resolveRouter2Credentials`);
  const builtIn = resolver({});
  assert.equal(builtIn.username, 'admin');
  assert.equal(builtIn.passwordHash, hash);
  assert.equal(builtIn.source, 'built-in default');
  const saved = resolver({router2Username: 'operator', router2PasswordHash: 'saved-hash'});
  assert.equal(saved.username, 'operator');
  assert.equal(saved.passwordHash, 'saved-hash');
  assert.equal(saved.source, 'saved settings');
});

test('Router 2 diagnostics are visible, bounded, copyable, and actionable', () => {
  assert.match(newtabHtml, /id="router2DiagnosticsDetails"/);
  assert.match(newtabHtml, /id="router2CopyDiagnostics"/);
  assert.match(newtabHtml, /id="router2Diagnostics"/);
  assert.match(newtab, /const ROUTER2_DIAGNOSTIC_LIMIT=80/);
  assert.match(newtab, /router2DiagnosticEntries\.splice\(0,router2DiagnosticEntries\.length-ROUTER2_DIAGNOSTIC_LIMIT\)/);
  assert.match(newtab, /navigator\.clipboard\?\.writeText/);
  assert.match(newtab, /document\.execCommand\('copy'\)/);
  assert.match(newtab, /open CommandTab Settings and save Router 2 credentials/);
  assert.match(newtab, /ZLT detection transition/);
  assert.match(newtab, /Authentication attempt/);
  assert.match(newtab, /router2DiagnosticLog\(`\$\{command\} attempt`/);
  assert.match(newtab, /CMD121 parse/);
  assert.match(newtab, /CMD186 parse/);
});

test('Router 2 diagnostics do not receive secrets or session identifiers', () => {
  assert.match(newtab, /function router2DiagnosticSanitize\(/);
  assert.match(newtab, /passwordhash\|password\|passwd\|authorization\|cookie\|sessionid\|token\|secret/);
  assert.doesNotMatch(newtab, /router2DiagnosticLog\([^\n]*(?:passwordHash|passwd|sessionId|router2Credentials\.username)/);
  assert.match(newtab, /sensitive values are omitted/);
});

test('Healthy Router 2 API owns liveness after shared-IP detection', () => {
  assert.match(newtab, /const ROUTER2_API_FAILURE_THRESHOLD=3/);
  assert.match(newtab, /function router2CancelDetectionPolling\(/);
  assert.match(newtab, /function router2MarkApiHealthy\(/);
  assert.match(newtab, /router2MarkApiHealthy\(command\)/);
  assert.match(newtab, /paused after successful API response/);
  assert.match(newtab, /if\(router2ZltDetected&&router2IntegrationStarted\)\{\s*\/\/ A healthy CMD endpoint owns liveness/);
  assert.match(newtab, /router2ScheduleDetectionAfterApiFailure\(/);
  assert.match(newtab, /failure \$\{router2ApiAvailabilityFailures\}\/\$\{ROUTER2_API_FAILURE_THRESHOLD\}/);
  assert.match(newtab, /status!==401&&response\.status!==403/);
});

test('Router 2 command cadence and concurrency guards are explicit', () => {
  assert.match(newtab, /const ROUTER2_STATUS_INTERVAL_MS=2000/);
  assert.match(newtab, /const ROUTER2_DEVICES_INTERVAL_MS=30000/);
  assert.match(newtab, /const ROUTER2_CELL_INTERVAL_MS=60000/);
  assert.match(newtab, /if\(!router2IsActive\(generation\)\|\|router2DevicesRunning\)return/);
  assert.match(newtab, /if\(!router2IsActive\(generation\)\|\|router2CellRunning\)return/);
  assert.match(newtab, /if\(router2IntegrationStarted\)return/);
});

test('Repeated ZLT detections do not overwrite an active Router 2 lifecycle state', () => {
  const detectionBranch = newtab.match(/if\(zltDetected\)\{([\s\S]*?)\n  \}else\{/)?.[1];
  assert.ok(detectionBranch, 'ZLT detection branch should remain present');
  assert.match(detectionBranch, /if\(!router2IntegrationStarted\)startRouter2Integration\(\);/);
  assert.doesNotMatch(detectionBranch, /setRouter2DetectedState\(\)/);

  const startIntegration = newtab.match(/function startRouter2Integration\(\)\{([\s\S]*?)\n\}/)?.[1];
  assert.ok(startIntegration, 'Router 2 integration startup should remain present');
  assert.match(startIntegration, /setRouter2DetectedState\(\);/);
});

test('Router 2 status math and cell parsing cover rollback-safe deltas and ECI fields', () => {
  assert.match(newtab, /function calculateRouter2Rates\(/);
  assert.match(newtab, /if\(rx<prevRx\|\|tx<prevTx\)return \{downloadBps:0,uploadBps:0,reset:true\}/);
  assert.match(newtab, /AT\+TZRSRP\?/);
  assert.match(newtab, /AT\+TZGLBCELLID\?/);
  assert.match(newtab, /eNodeBId:cellId>>8/);
  assert.match(newtab, /sectorId:cellId&255/);
});

test('Router 2 quality keeps RSSI thresholds distinct from RSRP thresholds', () => {
  assert.match(newtab, /ROUTER2_RSSI_THRESHOLDS/);
  assert.match(newtab, /function router2RssiQuality\(/);
  assert.match(newtab, /function router2RsrpQuality\(/);
  assert.match(newtab, /router2Signal\.rsrp!==null\?router2RsrpQuality/);
});

test('Router 2 uptime is normalized without displaying the Linux clock or load average', () => {
  const durationSource = newtab.match(/function formatRouter2Duration\([\s\S]*?\n\}/)?.[0];
  const uptimeSource = newtab.match(/function formatRouter2Uptime\([\s\S]*?\n\}/)?.[0];
  assert.ok(durationSource, 'Router 2 duration formatter should remain explicit');
  assert.ok(uptimeSource, 'Router 2 uptime formatter should remain explicit');
  const formatUptime = vm.runInNewContext(`${durationSource}; ${uptimeSource}; formatRouter2Uptime`);

  assert.equal(formatUptime('21:37:45 up 4:58, load average: 0.23, 0.11, 0.09'), '4h 58m');
  assert.equal(formatUptime('up 2 days, 03:04'), '2d 3h 4m');
  assert.equal(formatUptime(298), '4m 58s');
  assert.equal(formatUptime('not available'), '--');
});

test('Router 2 compact layout keeps live hooks and responsive grouping', () => {
  assert.match(newtabHtml, /class="glass router router-two" data-router="2"/);
  for (const id of ['r2signal', 'r2rsrp', 'r2cellid', 'r2down', 'r2up', 'r2devices', 'r2ping', 'r2ip', 'r2uptime', 'r2rawdata', 'router2DiagnosticsDetails', 'router2CopyDiagnostics']) {
    assert.match(newtabHtml, new RegExp(`id="${id}"`), `missing Router 2 hook: ${id}`);
  }
  assert.doesNotMatch(newtabHtml, /id="r2quality"/);
  assert.match(styles, /\.router2-live-summary\{display:grid/);
  assert.match(styles, /\.router2-overview\{display:grid/);
  assert.match(styles, /@media\(max-width:700px\)\{[\s\S]*\.router2-live-summary\{grid-template-columns:1fr\}/);
});

test('Router 2 signal bars keep a shared bottom baseline without redundant quality copy', () => {
  assert.match(styles, /\.router-two \.signal\.bars\{[^}]*align-items:flex-end[^}]*height:30px/);
  assert.match(styles, /\.router-two \.signal\.bars span\{[^}]*font-size:0[^}]*background:currentColor/);
  for (const [index, height] of [[1, 8], [2, 14], [3, 22], [4, 30]]) {
    assert.match(styles, new RegExp(`\\.router-two \\.signal\\.bars span:nth-child\\(${index}\\)\\{height:${height}px\\}`));
  }
  assert.match(newtab, /setRouterText\('r2updated',new Date\(\)\.toLocaleTimeString\(\)\)/);
  assert.doesNotMatch(newtab, /setRouterText\('r2updated',`Last updated \$\{new Date\(\)\.toLocaleTimeString\(\)\}`\)/);
});

test('Router 2 compact signal and traffic panels keep the focused hierarchy', () => {
  assert.match(newtabHtml, /aria-label="Router 2 signal"/);
  assert.match(newtabHtml, /<div class="router2-section-label">Signal<\/div>/);
  assert.doesNotMatch(newtabHtml, /Signal quality|Radio strength and quality|router2-signal-caption/);
  assert.doesNotMatch(newtabHtml, /id="r2enodeb"|id="r2sector"/);
  assert.match(styles, /\.router2-live-summary\{display:grid;grid-template-columns:minmax\(0,\.7fr\) minmax\(0,1\.3fr\)/);
  assert.match(styles, /\.router-two \.signal-metrics\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(newtab, /setRouterText\('r2enodeb'|setRouterText\('r2sector'/);
});

test('Router 2 keeps live RSRP beside signal bars and Cell ID as the sole radio detail', () => {
  assert.equal((newtabHtml.match(/id="r2rsrp"/g) || []).length, 1, 'Router 2 RSRP must have one live hook');
  const signalPanel = newtabHtml.match(/<section class="router2-signal-panel"[\s\S]*?<\/section>/)?.[0];
  assert.ok(signalPanel, 'Router 2 signal panel should remain present');
  assert.match(signalPanel, /class="router2-signal-row"[\s\S]*id="r2signal"[\s\S]*class="router2-signal-rsrp"[\s\S]*id="r2rsrp"/);

  const radioCard = newtabHtml.match(/<section class="router2-radio-card"[\s\S]*?<\/section>/)?.[0];
  assert.ok(radioCard, 'Router 2 radio details should remain present');
  assert.doesNotMatch(radioCard, /r2rsrp/);
  assert.match(radioCard, /<div class="router2-section-label">Cell ID<\/div>/);
  assert.match(radioCard, /id="r2cellid"/);
  assert.match(styles, /\.router2-signal-row\{[^}]*align-items:flex-end/);
  assert.match(styles, /\.router2-signal-rsrp[^{]*\{display:grid/);
});

test('Router 1 uses the compact signal and traffic hierarchy without losing Huawei radio hooks', () => {
  assert.match(newtabHtml, /class="glass router router-one" data-router="1"/);
  for (const id of ['r1signal', 'r1rsrp', 'r1rsrq', 'r1sinr', 'r1rssi', 'r1pci', 'r1cellid', 'r1mode', 'r1down', 'r1up', 'r1devices', 'r1ping', 'r1ip', 'r1uptime', 'r1rawsignal', 'r1rawtraffic']) {
    assert.match(newtabHtml, new RegExp(`id="${id}"`), `missing Router 1 hook: ${id}`);
  }
  assert.equal((newtabHtml.match(/id="r1rsrp"/g) || []).length, 1, 'Router 1 RSRP must have one live hook');
  assert.doesNotMatch(newtabHtml, /id="r1quality"/);
  const signalPanel = newtabHtml.match(/<section class="router1-signal-panel"[\s\S]*?<\/section>/)?.[0];
  assert.ok(signalPanel, 'Router 1 signal panel should remain present');
  assert.match(signalPanel, /class="router1-signal-row"[\s\S]*id="r1signal"[\s\S]*class="router1-signal-rsrp"[\s\S]*id="r1rsrp"/);
  const radioCard = newtabHtml.match(/<section class="router1-radio-card"[\s\S]*?<\/section>/)?.[0];
  assert.ok(radioCard, 'Router 1 radio details should remain present');
  assert.doesNotMatch(radioCard, /r1rsrp/);
  for (const id of ['r1rsrq', 'r1sinr', 'r1rssi', 'r1pci', 'r1cellid', 'r1mode']) {
    assert.match(radioCard, new RegExp(`id="${id}"`));
  }
  assert.match(styles, /\.router1-signal-row\{display:flex;align-items:flex-end/);
  assert.match(styles, /\.router1-live-summary\{display:grid/);
  assert.match(styles, /\.router-one \.signal\.bars\{[^}]*align-items:flex-end[^}]*height:30px/);
});

test('Router 2 maps known Dialog PLMNs while retaining generic fallback behavior', () => {
  assert.match(newtab, /const ROUTER2_OPERATOR_BY_PLMN=Object\.freeze\(\{/);
  const operatorSource = newtab.match(/const ROUTER2_OPERATOR_BY_PLMN=Object\.freeze\(\{[\s\S]*?\n\}\);\n\nfunction router2OperatorName\([\s\S]*?\n\}/)?.[0];
  assert.ok(operatorSource, 'Router 2 operator mapping should remain explicit');
  const operatorName = vm.runInNewContext(`${operatorSource}; router2OperatorName`);
  assert.equal(operatorName('41311'), 'Dialog');
  assert.equal(operatorName('41302'), 'Dialog');
  assert.equal(operatorName(''), '--');
  assert.equal(operatorName('99999'), 'Mobile Network');
});

test('Router 1 signal bars keep a shared bottom baseline without redundant quality copy', () => {
  assert.match(newtabHtml, /class="glass router(?: router-one)?" data-router="1"/);
  assert.match(newtabHtml, /id="r1signal"[^>]*role="img"[^>]*aria-label="Signal strength unavailable"/);
  assert.doesNotMatch(newtabHtml, /id="r1quality"/);
  assert.doesNotMatch(newtabHtml, /id="r1signal"[^>]*>[\s\S]*?▂/);
  assert.match(styles, /\.router\[data-router="1"\] \.signal\.bars\{[^}]*align-items:flex-end[^}]*height:30px/);
  assert.match(styles, /\.router\[data-router="1"\] \.signal\.bars span\{[^}]*font-size:0[^}]*background:currentColor/);
  for (const [index, height] of [[1, 8], [2, 14], [3, 22], [4, 30]]) {
    assert.match(styles, new RegExp(`\\.router\\[data-router="1"\\] \\.signal\\.bars span:nth-child\\(${index}\\)\\{height:${height}px\\}`));
  }
  assert.match(newtab, /setRouterText\('r1updated',\s*new Date\(\)\.toLocaleTimeString\(\)\)/);
  assert.doesNotMatch(newtab, /setRouterText\('r1updated',`Last updated \$\{new Date\(\)\.toLocaleTimeString\(\)\}`\)/);
  assert.doesNotMatch(newtab, /setRouterText\('r1quality'/);
});
