
const $=s=>document.querySelector(s);
const fmt=(zone, opts={})=>new Intl.DateTimeFormat('en-US',{timeZone:zone,...opts}).format(new Date());
function tick(){
  const now=new Date(), h=+fmt('Asia/Colombo',{hour:'2-digit',hour12:false});
  $('#greeting').textContent=(h<12?'☀ Good Morning':h<17?'☀ Good Afternoon':'☾ Good Evening');
  $('#date').textContent=fmt('Asia/Colombo',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  for(const [id,z] of [['colombo','Asia/Colombo'],['dubai','Asia/Dubai']]){
    $('#'+id+'Time').textContent=fmt(z,{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
    $('#'+id+'Date').textContent=fmt(z,{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  }
} tick(); setInterval(tick,1000);

$('#searchForm').onsubmit=e=>{e.preventDefault();let q=$('#searchInput').value.trim();if(!q)return;
  const commands={github:'https://github.com',gh:'https://github.com',gmail:'https://mail.google.com',youtube:'https://youtube.com',yt:'https://youtube.com',chatgpt:'https://chatgpt.com',expo:'https://expo.dev'};
  location.href=commands[q.toLowerCase()]||'https://www.google.com/search?q='+encodeURIComponent(q);
};
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#searchInput').focus()}});

$('#settingsBtn').onclick=()=>chrome.runtime.openOptionsPage();
$('#themeBtn').onclick=async()=>{document.body.classList.toggle('light');chrome.storage.local.set({light:document.body.classList.contains('light')})};
$('#wallpaperBtn').onclick=()=>chrome.runtime.openOptionsPage();

const defaults={
 routers:[
  {name:'Home 4G',baseUrl:'http://192.168.8.1',statusPath:'',enabled:true},
  {name:'Backup 4G',baseUrl:'http://192.168.1.1',statusPath:'',enabled:true}
 ],
 services:[
  {name:'Next.js',url:'http://localhost:3000'},
  {name:'API Server',url:'http://localhost:8080'},
  {name:'Expo Metro',url:'http://localhost:8081'},
  {name:'PostgreSQL',url:'http://localhost:5432'}
 ],
 tasks:['Finish React Native route screenshot automation','Update router monitor extension','Prepare Marga Shilpaya deployment']
};
async function load(){
 const s=await chrome.storage.local.get(['routers','services','tasks','taskDone','light']);
 if(s.light)document.body.classList.add('light');
 const routers=s.routers||defaults.routers;
 routers.forEach((r,i)=>{
   let n=i+1;
   $('#r'+n+'name').textContent=r.name;
   $('#r'+n+'ip').textContent=new URL(r.baseUrl).hostname;
   $('#router'+n+'link').href=r.baseUrl;
   if(n===2) checkRouter(r,n); // Router 1 has its own controlled live loop below.
 });
 renderServices(s.services||defaults.services);
 renderTasks(s.tasks||defaults.tasks,s.taskDone||{});
}
async function timedFetch(url,ms=2500){
 const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);
 try{return await fetch(url,{cache:'no-store',signal:c.signal,mode:'cors'})}finally{clearTimeout(t)}
}
async function checkRouter(r,n){
 const state=$('#r'+n+'state');
 if(!r.enabled){state.textContent='● Disabled';return}
 try{
  const res=await timedFetch(r.baseUrl+(r.statusPath||'/'));
  state.textContent=res?'● Online':'● Offline';state.className='online';
  // Optional generic JSON adapter. Map your router's API fields in Settings/status endpoint.
  try{
   const data=await res.clone().json();
   const set=(k,v)=>{if(v!==undefined&&v!==null)$('#r'+n+k).textContent=v};
   set('quality',(data.signalQuality??data.signal??'--')+(typeof(data.signalQuality??data.signal)==='number'?'%':''));
   set('down',formatRate(data.downloadBps));
   set('up',formatRate(data.uploadBps));
   set('devices',data.connectedDevices??'--');
   set('ping',data.pingMs!=null?data.pingMs+' ms':'--');
   set('uptime',data.uptime??'--');
  }catch{}
 }catch{state.textContent='● Offline / CORS';state.className='bad'}
}
function formatRate(b){if(b==null)return '--';return b>=1e6?(b/1e6).toFixed(1)+' MB/s':b>=1e3?(b/1e3).toFixed(0)+' KB/s':b+' B/s'}
async function pingUrl(url){
 const start=performance.now();try{await timedFetch(url,1800);return Math.round(performance.now()-start)}catch{return null}
}
$('#testBtn').onclick=async()=>{
 $('#internetState').textContent='Testing…';
 const p=await pingUrl('https://www.google.com/generate_204');
 $('#internetPing').textContent=p==null?'Offline':p+' ms';
 $('#internetState').textContent=p==null?'Offline':p<100?'Excellent':p<250?'Good':'Slow';
 // Browsers cannot accurately measure OS-wide throughput without a helper/native app.
 $('#internetDown').textContent='Router API';
 $('#internetUp').textContent='Router API';
};
async function renderServices(list){
 const el=$('#services');el.innerHTML='';
 for(const s of list){
  const row=document.createElement('div');row.className='service';row.innerHTML=`<span>${s.name}</span><span class="muted">Checking…</span>`;el.append(row);
  const p=await pingUrl(s.url);row.lastElementChild.textContent=p==null?'● Offline':'● Online';row.lastElementChild.className=p==null?'bad':'ok';
 }
}
function renderTasks(tasks,done){
 const el=$('#tasks');el.innerHTML='';
 tasks.forEach((t,i)=>{
  const row=document.createElement('div');row.className='task '+(done[i]?'done':'');
  row.innerHTML=`<label><input type="checkbox" ${done[i]?'checked':''}><span>${escapeHtml(t)}</span></label><button data-del="${i}">×</button>`;
  row.querySelector('input').onchange=e=>{done[i]=e.target.checked;chrome.storage.local.set({taskDone:done});renderTasks(tasks,done)};
  row.querySelector('button').onclick=()=>{tasks.splice(i,1);chrome.storage.local.set({tasks});renderTasks(tasks,done)};
  el.append(row);
 });
}
$('#addTask').onclick=async()=>{const t=prompt('New focus task');if(!t)return;const s=await chrome.storage.local.get('tasks');const a=s.tasks||defaults.tasks;a.push(t);await chrome.storage.local.set({tasks:a});renderTasks(a,{})};
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
load();


/* ===== Router 1: Huawei B310s-927 live integration ===== */
const ROUTER1_BASE = 'https://192.168.8.1';
const ROUTER1_REFRESH_MS = 2000;
let router1PrevTraffic = null;

function setRouterText(id, value) {
  const el = document.getElementById(id);
  if (el && value !== undefined && value !== null) el.textContent = value;
}

function xmlValue(xml, tag) {
  return xml.querySelector(tag)?.textContent?.trim() || '';
}

function parseXml(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Invalid XML response');
  const apiError = doc.querySelector('error');
  if (apiError) throw new Error(`Router API error ${xmlValue(doc, 'code') || ''}`.trim());
  return doc;
}

async function router1Text(path, timeoutMs = 1800) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${ROUTER1_BASE}${path}`,
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache, no-store, max-age=0',
          'Pragma': 'no-cache'
        }
      }
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function cleanMetric(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function numericMetric(value) {
  const m = String(value).match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

function signalLabel(rsrp, rsrq, sinr) {
  // Conservative LTE dashboard classification. RSRP/SINR are primary indicators.
  let scores = [];

  if (Number.isFinite(rsrp)) {
    scores.push(rsrp >= -85 ? 4 : rsrp >= -95 ? 3 : rsrp >= -105 ? 2 : rsrp >= -115 ? 1 : 0);
  }
  if (Number.isFinite(sinr)) {
    scores.push(sinr >= 25 ? 4 : sinr >= 16 ? 3 : sinr >= 11 ? 2 : sinr >= 3 ? 1 : 0);
  }
  if (Number.isFinite(rsrq)) {
    scores.push(rsrq >= -10 ? 4 : rsrq >= -12 ? 3 : rsrq >= -15 ? 2 : rsrq >= -20 ? 1 : 0);
  }

  if (!scores.length) return { label: '--', bars: 0 };
  const score = Math.min(...scores);
  return [
    { label: 'Poor', bars: 1 },
    { label: 'Weak', bars: 1 },
    { label: 'Fair', bars: 2 },
    { label: 'Good', bars: 3 },
    { label: 'Excellent', bars: 4 }
  ][score];
}

const SIGNAL_QUALITY_STYLES = Object.freeze({
  Poor: { key: 'poor', className: 'quality-poor' },
  Weak: { key: 'weak', className: 'quality-weak' },
  Fair: { key: 'fair', className: 'quality-fair' },
  Good: { key: 'good', className: 'quality-good' },
  Excellent: { key: 'excellent', className: 'quality-excellent' },
  unavailable: { key: 'unavailable', className: 'quality-unavailable' }
});
const SIGNAL_QUALITY_CLASSES = Object.values(SIGNAL_QUALITY_STYLES)
  .map(({ className }) => className);

function renderSignalBars(count, label = '--') {
  const bars = document.querySelector('.router[data-router="1"] .bars');
  if (!bars) return;
  const hasKnownQuality = typeof label === 'string'
    && Object.prototype.hasOwnProperty.call(SIGNAL_QUALITY_STYLES, label);
  const quality = hasKnownQuality
    ? SIGNAL_QUALITY_STYLES[label]
    : SIGNAL_QUALITY_STYLES.unavailable;
  const numericCount = Number(count);
  const activeCount = Number.isFinite(numericCount)
    ? Math.max(0, Math.min(4, Math.trunc(numericCount)))
    : 0;
  bars.classList.remove(...SIGNAL_QUALITY_CLASSES);
  bars.classList.add(quality.className);
  bars.dataset.quality = quality.key;
  [...bars.children].forEach((bar, i) => {
    const active = i < activeCount;
    bar.classList.toggle('active', active);
    bar.classList.toggle('dim', !active);
    bar.style.opacity = '';
  });
  const accessibleLabel = label && label !== '--'
    ? `${label} signal strength`
    : 'Signal strength unavailable';
  bars.setAttribute(
    'aria-label',
    `${accessibleLabel}, ${activeCount} of 4 bars`
  );
}

async function refreshRouter1Signal() {
  const raw = await router1Text('/api/device/signal');
  const xml = parseXml(raw);

  const pci = cleanMetric(xmlValue(xml, 'pci'));
  const cellId = cleanMetric(xmlValue(xml, 'cell_id'));
  const rsrqText = cleanMetric(xmlValue(xml, 'rsrq'));
  const rsrpText = cleanMetric(xmlValue(xml, 'rsrp'));
  const rssiText = cleanMetric(xmlValue(xml, 'rssi'));
  const sinrText = cleanMetric(xmlValue(xml, 'sinr'));
  const mode = cleanMetric(xmlValue(xml, 'mode'));

  const rsrp = numericMetric(rsrpText);
  const rsrq = numericMetric(rsrqText);
  const sinr = numericMetric(sinrText);
  const quality = signalLabel(rsrp, rsrq, sinr);

  const state = document.getElementById('r1state');
  if (state) {
    state.textContent = '● Online';
    state.className = 'online';
  }

  renderSignalBars(quality.bars, quality.label);
  setRouterText('r1quality', `${quality.label} · ${rsrpText || '--'}`);
  setRouterText('r1rsrp', rsrpText || '--');
  setRouterText('r1rsrq', rsrqText || '--');
  setRouterText('r1sinr', sinrText || '--');
  setRouterText('r1rssi', rssiText || '--');
  setRouterText('r1pci', pci || '--');
  setRouterText('r1cellid', cellId || '--');
  setRouterText('r1mode', mode || '--');
  setRouterText('r1rawsignal',
    `PCI ${pci || '--'} · Cell ${cellId || '--'} · RSRQ ${rsrqText || '--'} · RSRP ${rsrpText || '--'} · RSSI ${rssiText || '--'} · SINR ${sinrText || '--'} · Mode ${mode || '--'}`
  );
}

function smartRouterRate(bps) {
  if (!Number.isFinite(bps) || bps < 0) return '--';
  if (bps < 1000) return `${bps.toFixed(0)} B/s`;
  if (bps < 1_000_000) return `${(bps / 1000).toFixed(1)} KB/s`;
  return `${(bps / 1_000_000).toFixed(2)} MB/s`;
}

async function refreshRouter1Traffic() {
  const text = await router1Text('/api/monitoring/traffic-statistics');
  const xml = parseXml(text);

  const downloadRate = Number(xmlValue(xml, 'CurrentDownloadRate'));
  const uploadRate = Number(xmlValue(xml, 'CurrentUploadRate'));

  // Huawei home.js uses these values directly and multiplies by 8 only
  // when displaying bits/sec. CommandTab displays bytes/sec as KB/s/MB/s,
  // so no *8 conversion is required here.
  if (Number.isFinite(downloadRate)) {
    setRouterText('r1down', smartRouterRate(downloadRate));
  }
  if (Number.isFinite(uploadRate)) {
    setRouterText('r1up', smartRouterRate(uploadRate));
  }

  setRouterText(
    'r1rawtraffic',
    `Down ${Number.isFinite(downloadRate) ? downloadRate : '--'} B/s · Up ${Number.isFinite(uploadRate) ? uploadRate : '--'} B/s`
  );
}

async function fetchRouter1PlmnOnce() {
  try {
    const raw = await router1Text('/api/net/current-plmn', 2500);
    const xml = parseXml(raw);

    // Huawei firmware variants use slightly different element names.
    const operator =
      xmlValue(xml, 'ShortName') ||
      xmlValue(xml, 'FullName') ||
      xmlValue(xml, 'Numeric') ||
      'Mobile Network';

    const plmn =
      xmlValue(xml, 'Numeric') ||
      xmlValue(xml, 'PLMN') ||
      '--';

    setRouterText('r1name', 'Huawei B310s-927');
    setRouterText('r1operator', operator);
    setRouterText('r1plmn', plmn);
  } catch (error) {
    setRouterText('r1name', 'Huawei B310s-927');
    setRouterText('r1operator', '--');
    setRouterText('r1plmn', '--');
  }
}

function updateRouter1Timestamp() {
  setRouterText('r1updated', `Last updated ${new Date().toLocaleTimeString()}`);
}

async function router1LiveCycle() {
  try {
    const results = await Promise.allSettled([
      refreshRouter1Signal(),
      refreshRouter1Traffic()
    ]);

    if (results.some(r => r.status === 'fulfilled')) {
      updateRouter1Timestamp();
    }

    if (results.every(r => r.status === 'rejected')) {
      const state = document.getElementById('r1state');
      if (state) {
        state.textContent = '● Refresh error';
        state.className = 'bad';
      }
    }
  } finally {
    setTimeout(router1LiveCycle, ROUTER1_REFRESH_MS);
  }
}

/* ===== Huawei B310s-927 automatic session bootstrap ===== */
const ROUTER1_HOME_URL = 'https://192.168.8.1/html/home.html';

async function getRouter1SessionCookie() {
  return chrome.cookies.get({url: ROUTER1_BASE + '/', name: 'SessionID'});
}

async function bootstrapRouter1Session() {
  setRouterText('r1sessionstatus', 'Getting session…');
  try {
    const res = await fetch(`${ROUTER1_HOME_URL}?_=${Date.now()}`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      redirect: 'follow'
    });
    await res.text();

    const cookie = await getRouter1SessionCookie();
    if (!cookie || !cookie.value) {
      setRouterText('r1sessionstatus', 'No SessionID');
      return false;
    }

    await chrome.storage.local.set({
      router1SessionId: cookie.value,
      router1SessionUpdatedAt: Date.now()
    });
    setRouterText('r1sessionstatus', 'Session ready');
    return true;
  } catch (e) {
    console.error('Router session bootstrap failed', e);
    setRouterText('r1sessionstatus', 'Session unavailable');
    return false;
  }
}

async function startRouter1() {
  await bootstrapRouter1Session();
  fetchRouter1PlmnOnce();
  router1LiveCycle();
}
startRouter1();
