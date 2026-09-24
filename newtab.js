
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
  {name:'Dialog ZLT P11',baseUrl:'http://192.168.8.1',statusPath:'',enabled:true}
 ],
 services:[
  {name:'Next.js',url:'http://localhost:3000'},
  {name:'API Server',url:'http://localhost:8080'},
  {name:'Expo Metro',url:'http://localhost:8081'},
  {name:'PostgreSQL',url:'http://localhost:5432'}
 ],
 tasks:['Finish React Native route screenshot automation','Update router monitor extension','Prepare Marga Shilpaya deployment']
};
const ROUTER2_DEFAULT_BASE='http://192.168.8.1';
const ROUTER2_LEGACY_DEFAULT_BASE='http://192.168.1.1';
const ROUTER2_API_PATH='/cgi-bin/http.cgi';
const ROUTER2_DEFAULT_USERNAME='admin';
// Dialog ZLT P11 ships with the built-in credentials. Keep only the router-compatible hash in memory.
const ROUTER2_DEFAULT_PASSWORD_HASH='21232f297a57a5a743894a0e4a801fc3';

function normalizeRouter2Origin(value){
 try{
  const input=String(value||ROUTER2_DEFAULT_BASE).trim();
  const url=new URL(/^https?:\/\//i.test(input)?input:`http://${input}`);
  if(!['http:','https:'].includes(url.protocol)||!url.hostname)return ROUTER2_DEFAULT_BASE;
  return `${url.protocol}//${url.host}`;
 }catch{return ROUTER2_DEFAULT_BASE}
}

function resolveRouter2Credentials(values={}){
 const savedUsername=String(values.router2Username||'').trim();
 const savedPasswordHash=typeof values.router2PasswordHash==='string'?values.router2PasswordHash.trim():'';
 return {
  username:savedUsername||ROUTER2_DEFAULT_USERNAME,
  passwordHash:savedPasswordHash||ROUTER2_DEFAULT_PASSWORD_HASH,
  source:savedUsername||savedPasswordHash?'saved settings':'built-in default'
 };
}

function migrateRouterDefaults(routers){
 const migrated=[...(routers||[])];
 const router2=migrated[1];
 if(router2 && router2.baseUrl===ROUTER2_LEGACY_DEFAULT_BASE){
  migrated[1]={...router2,baseUrl:ROUTER2_DEFAULT_BASE};
  if(router2.name==='Backup 4G')migrated[1].name='Dialog ZLT P11';
  return {routers:migrated,changed:true};
 }
 return {routers:migrated,changed:false};
}
async function load(){
 const s=await chrome.storage.local.get(['routers','services','tasks','taskDone','light','router2Username','router2PasswordHash']);
 if(s.light)document.body.classList.add('light');
 const storedRouters=s.routers||defaults.routers;
 const migration=migrateRouterDefaults(storedRouters);
 const routers=migration.routers;
 if(migration.changed)await chrome.storage.local.set({routers});
 router2Origin=normalizeRouter2Origin(routers[1]?.baseUrl||ROUTER2_DEFAULT_BASE);
 const resolvedCredentials=resolveRouter2Credentials(s);
 router2Credentials.username=resolvedCredentials.username;
 router2Credentials.passwordHash=resolvedCredentials.passwordHash;
 router2CredentialSource=resolvedCredentials.source;
 router2DiagnosticLog('Credentials loaded',`credential presence=${router2HasCredentials()?'yes':'no'}; source=${router2CredentialSource}`);
 routers.forEach((r,i)=>{
   let n=i+1;
   $('#r'+n+'name').textContent=r.name;
   $('#r'+n+'ip').textContent=new URL(r.baseUrl).hostname;
   $('#router'+n+'link').href=r.baseUrl;
   if(n===2) setRouter2IdleState(); // Router 2 starts only after the public ZLT detector confirms its firmware.
 });
 renderServices(s.services||defaults.services);
 renderTasks(s.tasks||defaults.tasks,s.taskDone||{});
}
async function timedFetch(url,ms=2500,options={}){
 const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);
 try{return await fetch(url,{cache:'no-store',signal:c.signal,mode:'cors',...options})}finally{clearTimeout(t)}
}
async function checkRouter(r,n){
 const state=$('#r'+n+'state');
 if(!r.enabled){state.textContent='● Disabled';return}
 if(n===2&&router2ZltDetected)return;
 try{
  const res=await timedFetch(r.baseUrl+(r.statusPath||'/'));
  if(n===2&&router2ZltDetected)return;
  state.textContent=res?'● Online':'● Offline';state.className='online';
  // Optional generic JSON adapter. Map your router's API fields in Settings/status endpoint.
  try{
   const data=await res.clone().json();
   const set=(k,v)=>{const el=$('#r'+n+k);if(el&&v!==undefined&&v!==null)el.textContent=v};
   set('quality',(data.signalQuality??data.signal??'--')+(typeof(data.signalQuality??data.signal)==='number'?'%':''));
   set('down',formatRate(data.downloadBps));
   set('up',formatRate(data.uploadBps));
   set('devices',data.connectedDevices??'--');
   set('ping',data.pingMs!=null?data.pingMs+' ms':'--');
   set('uptime',formatRouter2Uptime(data.uptime));
  }catch{}
 }catch{if(n===2&&router2ZltDetected)return;state.textContent='● Offline / CORS';state.className='bad'}
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

/* ===== Router 2: bounded, redacted diagnostics ===== */
const ROUTER2_DIAGNOSTIC_LIMIT=80;
const router2DiagnosticEntries=[];
const router2DiagnosticRateLimits=new Map();
const router2DiagnosticState={
 uiState:'Checking',detection:'pending',integration:'stopped',auth:'unknown',
 lastCommand:'none',lastHttp:'none',lastParse:'none',lastError:'none'
};

function router2DiagnosticSanitize(value){
 let text=String(value??'').replace(/[\r\n]+/g,' ');
 text=text.replace(/(?:passwordhash|password|passwd|authorization|cookie|sessionid|token|secret)\s*[:=]\s*[^,;\s|]+/gi,'$1=[redacted]');
 text=text.replace(/Bearer\s+[^,;\s|]+/gi,'Bearer [redacted]');
 return text.length>240?`${text.slice(0,237)}...`:text;
}

function router2DiagnosticSafeError(error){
 const message=String(error?.message||error||'');
 if(/abort|timed out/i.test(message))return 'timeout';
 const http=message.match(/^HTTP\s+(\d{3})$/i);if(http)return `HTTP ${http[1]}`;
 if(/empty router response/i.test(message))return 'empty response';
 if(/invalid router status/i.test(message))return 'invalid status data';
 if(/invalid cmd 186 response/i.test(message))return 'invalid CMD 186 data';
 if(/cmd 186 failed/i.test(message))return 'CMD 186 failed';
 if(/cmd 186 data unavailable/i.test(message))return 'CMD 186 data unavailable';
 if(/invalid cmd 121 response/i.test(message))return 'invalid CMD 121 data';
 if(/cmd\s*121 failed/i.test(message))return 'CMD 121 failed';
 if(/authentication_failed|authentication failed/i.test(message))return 'authentication failed';
 if(/session_expired|session expired/i.test(message))return 'session expired';
 return 'request failed';
}

function router2DiagnosticLog(event,detail='',options={}){
 const now=Date.now();
 const key=options.key;
 const minInterval=Number(options.minInterval)||0;
 if(key&&minInterval>0&&now-(router2DiagnosticRateLimits.get(key)||0)<minInterval)return;
 if(key)router2DiagnosticRateLimits.set(key,now);
 const safeEvent=router2DiagnosticSanitize(event);
 const safeDetail=router2DiagnosticSanitize(detail);
 router2DiagnosticEntries.push({timestamp:new Date(now).toISOString(),event:safeEvent,detail:safeDetail});
 if(router2DiagnosticEntries.length>ROUTER2_DIAGNOSTIC_LIMIT)router2DiagnosticEntries.splice(0,router2DiagnosticEntries.length-ROUTER2_DIAGNOSTIC_LIMIT);
 router2DiagnosticRender();
}

function router2DiagnosticRender(){
 const output=document.getElementById('router2Diagnostics');
 if(!output)return;
 output.textContent=router2DiagnosticEntries.length?router2DiagnosticEntries.map(entry=>`[${entry.timestamp}] ${entry.event}${entry.detail?` — ${entry.detail}`:''}`).join('\n'):'Waiting for Router 2 diagnostics…';
 output.scrollTop=output.scrollHeight;
}

function router2DiagnosticResponseSummary(text){
 const raw=String(text??'');
 const json=router2TryJson(raw);
 if(!json||typeof json!=='object')return `type=text; bytes=${raw.length}`;
 const result=json.success===true?'success':json.success===false?'failure':'unknown';
 return `type=json; bytes=${raw.length}; result=${result}; data=${json.data!==undefined?'present':'absent'}`;
}

function router2DiagnosticReport(){
 const state=document.getElementById('r2state')?.textContent?.trim()||'unknown';
 const sessionState=document.getElementById('r2sessionstatus')?.textContent?.trim()||'unknown';
 const credentials=typeof router2HasCredentials==='function'&&router2HasCredentials()?'yes':'no';
 const credentialSource=typeof router2CredentialSource!=='undefined'?router2CredentialSource:'unknown';
 const detected=typeof router2ZltDetected!=='undefined'&&router2ZltDetected?'yes':'no';
 const integration=typeof router2IntegrationStarted!=='undefined'&&router2IntegrationStarted?'running':'stopped';
 const lines=router2DiagnosticEntries.map(entry=>`[${entry.timestamp}] ${entry.event}${entry.detail?` — ${entry.detail}`:''}`);
 return [
  'CommandTab Router 2 diagnostics',
  `Report generated: ${new Date().toISOString()}`,
  `UI state: ${router2DiagnosticSanitize(state)}`,
  `Router session state: ${router2DiagnosticSanitize(sessionState)}`,
  `ZLT detected: ${detected}`,
  `Integration: ${integration}`,
  `Credentials configured: ${credentials}; source=${router2DiagnosticSanitize(credentialSource)}`,
  `Lifecycle: detection=${router2DiagnosticState.detection}; auth=${router2DiagnosticState.auth}; last command=${router2DiagnosticState.lastCommand}; last HTTP=${router2DiagnosticState.lastHttp}; last parse=${router2DiagnosticState.lastParse}; last error=${router2DiagnosticState.lastError}`,
  '',
  'Events (newest entries are retained; secrets, sessions, headers, and response bodies are omitted):',
  ...lines
 ].join('\n');
}

function router2SetDiagnosticCopyStatus(message,ok=false){
 const status=document.getElementById('router2DiagnosticsStatus');
 if(status){status.textContent=message;status.className=ok?'ok':'muted'}
}

async function copyRouter2Diagnostics(){
 const report=router2DiagnosticReport();
 let copied=false;
 try{
  if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(report);copied=true}
 }catch{}
 if(!copied){
  const textarea=document.createElement('textarea');
  textarea.value=report;textarea.setAttribute('readonly','');textarea.style.position='fixed';textarea.style.opacity='0';
  document.body.append(textarea);textarea.select();
  try{copied=document.execCommand('copy')}catch{}finally{textarea.remove()}
 }
 router2SetDiagnosticCopyStatus(copied?'Copied diagnostics':'Copy failed — select the diagnostics text and copy manually.',copied);
 router2DiagnosticLog(copied?'Diagnostics copied':'Diagnostics copy failed',copied?'Plain-text report copied':'Clipboard unavailable',{key:'copy-status',minInterval:1000});
}

document.getElementById('router2CopyDiagnostics')?.addEventListener('click',copyRouter2Diagnostics);
router2DiagnosticRender();
load();


/* ===== Shared 192.168.8.1 detection ===== */
const ROUTER2_ZLT_SIGNATURES=Object.freeze([
 'RequestCmd.LOGIN',
 'RequestCmd.DEVICE_VERSION_INFO',
 'id="login-template"',
 'js/underscore-min.js'
]);
const ROUTER2_ZLT_MIN_SIGNATURES=3;
const ROUTER1_REDETECT_MS=7000;
let router2ZltDetected=false;
let router1Mode='unknown';
let router1DetectionInFlight=false;
let router1DetectionTimer=null;
let router1LiveLoopStarted=false;
let router1LiveLoopRunning=false;
let router1LiveTimer=null;
let router1BootstrapStarted=false;

/* ===== Router 2: Dialog ZLT P11 live integration ===== */
let router2Origin=ROUTER2_DEFAULT_BASE;
let router2Credentials={username:ROUTER2_DEFAULT_USERNAME,passwordHash:ROUTER2_DEFAULT_PASSWORD_HASH};
let router2CredentialSource='built-in default';
let router2SessionId='';
let router2Generation=0;
let router2IntegrationStarted=false;
let router2StatusRunning=false;
let router2DevicesRunning=false;
let router2CellRunning=false;
let router2StatusTimer=null;
let router2DevicesTimer=null;
let router2CellTimer=null;
let router2AuthPromise=null;
let router2AbortControllers=new Set();
let router2PreviousCounters=null;
let router2PreviousTimestamp=null;
let router2Signal={metric:'rssi',rssi:null,rsrp:null};
let router2LastRawUptime='--';
let router2DetectionOrigin=ROUTER2_DEFAULT_BASE;
let router2ApiHealthy=false;
let router2ApiAvailabilityFailures=0;

const ROUTER2_STATUS_INTERVAL_MS=2000;
const ROUTER2_DEVICES_INTERVAL_MS=30000;
const ROUTER2_CELL_INTERVAL_MS=60000;
const ROUTER2_TIMEOUT_MS=5000;
const ROUTER2_API_FAILURE_THRESHOLD=3;
const ROUTER2_RSSI_THRESHOLDS=Object.freeze({
 excellent:-70,
 good:-85,
 fair:-100,
 weak:-110
});

function router2SetState(label,className='muted',sessionStatus=label.replace(/^●\s*/,'')){
 const nextState=String(label).replace(/^●\s*/,'');
 if(router2DiagnosticState.uiState!==nextState){
  const previous=router2DiagnosticState.uiState;
  router2DiagnosticState.uiState=nextState;
  router2DiagnosticLog('UI state transition',`${previous} -> ${nextState}`);
 }
 const state=document.getElementById('r2state');
 if(state){state.textContent=`● ${nextState}`;state.className=className}
 setRouterText('r2sessionstatus',sessionStatus);
}

function setRouter2IdleState(){
 if(router2IntegrationStarted)return;
 router2SetState('Checking','muted','Waiting for ZLT detection');
}

function router2HasCredentials(){
 return Boolean(String(router2Credentials.username||'').trim()&&String(router2Credentials.passwordHash||'').trim());
}

function router2NormalizeDbm(raw){
 const value=Number(raw);
 if(!Number.isFinite(value))return null;
 return value>0?-Math.abs(value):value;
}

function router2RssiQuality(raw){
 const value=router2NormalizeDbm(raw);
 if(value===null)return {label:'--',bars:0,value:null,metric:'RSSI'};
 if(value>=ROUTER2_RSSI_THRESHOLDS.excellent)return {label:'Excellent',bars:4,value,metric:'RSSI'};
 if(value>=ROUTER2_RSSI_THRESHOLDS.good)return {label:'Good',bars:3,value,metric:'RSSI'};
 if(value>=ROUTER2_RSSI_THRESHOLDS.fair)return {label:'Fair',bars:2,value,metric:'RSSI'};
 if(value>=ROUTER2_RSSI_THRESHOLDS.weak)return {label:'Weak',bars:1,value,metric:'RSSI'};
 return {label:'Poor',bars:1,value,metric:'RSSI'};
}

function router2RsrpQuality(raw){
 const value=router2NormalizeDbm(raw);
 if(value===null)return {label:'--',bars:0,value:null,metric:'RSRP'};
 const quality=signalLabel(value,NaN,NaN);
 return {label:quality.label,bars:quality.bars,value,metric:'RSRP'};
}

function renderRouter2SignalBars(count,label='--'){
 const bars=document.getElementById('r2signal');
 if(!bars)return;
 const style=SIGNAL_QUALITY_STYLES[label]||SIGNAL_QUALITY_STYLES.unavailable;
 const activeCount=Math.max(0,Math.min(4,Number.isFinite(Number(count))?Math.trunc(Number(count)):0));
 bars.classList.remove(...SIGNAL_QUALITY_CLASSES);
 bars.classList.add(style.className);
 bars.dataset.quality=style.key;
 [...bars.children].forEach((bar,index)=>{
  const active=index<activeCount;
  bar.classList.toggle('active',active);
  bar.classList.toggle('dim',!active);
 });
 bars.setAttribute('aria-label',`${label==='--'?'Signal strength unavailable':`${label} signal strength`} , ${activeCount} of 4 bars`);
}

function updateRouter2SignalDisplay(){
 const quality=router2Signal.rsrp!==null?router2RsrpQuality(router2Signal.rsrp):router2RssiQuality(router2Signal.rssi);
 router2Signal.metric=quality.metric.toLowerCase();
 renderRouter2SignalBars(quality.bars,quality.label);
}

function calculateRouter2Rates(previous,current,elapsedMs){
 const elapsed=Number(elapsedMs)/1000;
 const prevRx=Number(previous?.rx),prevTx=Number(previous?.tx);
 const rx=Number(current?.rx),tx=Number(current?.tx);
 if(!Number.isFinite(elapsed)||elapsed<=0||![prevRx,prevTx,rx,tx].every(Number.isFinite))return null;
 if(rx<prevRx||tx<prevTx)return {downloadBps:0,uploadBps:0,reset:true};
 return {downloadBps:(rx-prevRx)/elapsed,uploadBps:(tx-prevTx)/elapsed,reset:false};
}

function formatRouter2Rate(bytesPerSecond){
 if(!Number.isFinite(bytesPerSecond)||bytesPerSecond<0)return '--';
 if(bytesPerSecond<1000)return `${bytesPerSecond.toFixed(0)} B/s`;
 if(bytesPerSecond<1000000)return `${(bytesPerSecond/1000).toFixed(1)} KB/s`;
 return `${(bytesPerSecond/1000000).toFixed(2)} MB/s`;
}

function formatRouter2Duration(totalSeconds){
 const seconds=Math.max(0,Math.floor(Number(totalSeconds)));
 const days=Math.floor(seconds/86400);
 const hours=Math.floor((seconds%86400)/3600);
 const minutes=Math.floor((seconds%3600)/60);
 const remainder=seconds%60;
 const parts=[];
 if(days)parts.push(`${days}d`);
 if(hours)parts.push(`${hours}h`);
 if(minutes)parts.push(`${minutes}m`);
 if(remainder&&!days&&!hours)parts.push(`${remainder}s`);
 return parts.length?parts.slice(0,3).join(' '):'0m';
}

function formatRouter2Uptime(value){
 if(value===null||value===undefined)return '--';
 const source=String(value).trim();
 if(!source||source==='--')return '--';
 const numeric=Number(source);
 if((typeof value==='number'||/^\d+(?:\.\d+)?$/.test(source))&&Number.isFinite(numeric)&&numeric>=0){
  return formatRouter2Duration(numeric);
 }

 // Linux commonly returns "21:37:45 up 4:58, load average: ...". Only
 // parse the duration after "up" so the current clock is never displayed.
 const linuxDuration=source.match(/\bup\s+(.+?)(?:,\s*load average\b|$)/i);
 const durationText=(linuxDuration?linuxDuration[1]:source).trim();
 let totalSeconds=0;
 let hasDuration=false;
 for(const [pattern,multiplier] of [
  [/\b(\d+(?:\.\d+)?)\s*(?:days?|d)\b/i,86400],
  [/\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i,3600],
  [/\b(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/i,60],
  [/\b(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/i,1]
 ]){
  const match=durationText.match(pattern);
  if(match){totalSeconds+=Number(match[1])*multiplier;hasDuration=true;}
 }
 const clock=durationText.match(/\b(\d+):(\d{1,2})(?::(\d{1,2}))?\b/);
 if(clock){
  totalSeconds+=Number(clock[1])*3600+Number(clock[2])*60+(clock[3]===undefined?0:Number(clock[3]));
  hasDuration=true;
 }
 return hasDuration?formatRouter2Duration(totalSeconds):'--';
}

function router2RawUptime(value){
 const source=String(value??'').replace(/\s+/g,' ').trim();
 if(!source)return '--';
 return source.length>180?`${source.slice(0,177)}...`:source;
}

function router2TryJson(text){
 try{return JSON.parse(text)}catch{return null}
}

function router2IsSessionInvalid(text){
 if(!String(text||'').trim())return true;
 const json=router2TryJson(text);
 if(json&&json.success===false)return true;
 const lower=String(text).toLowerCase();
 return ['invalid session','session expired','sessionid invalid','invalid sessionid','authentication failed','unauthorized','login required','not login','not logged','no_auth'].some(word=>lower.includes(word));
}

function router2FindSessionId(text){
 const json=router2TryJson(text);
 if(!json||typeof json!=='object')return '';
 const keys=['sessionId','sessionID','SessionID','sid','session'];
 const walk=value=>{
  if(!value||typeof value!=='object')return '';
  for(const key of keys)if(typeof value[key]==='string'&&value[key])return value[key];
  for(const item of Object.values(value)){const found=walk(item);if(found)return found}
  return '';
 };
 return walk(json);
}

function router2Flatten(value,output=[]){
 if(value===null||value===undefined)return output;
 if(typeof value==='string'||typeof value==='number'){output.push(String(value));return output}
 if(Array.isArray(value)){value.forEach(item=>router2Flatten(item,output));return output}
 if(typeof value==='object')Object.values(value).forEach(item=>router2Flatten(item,output));
 return output;
}

function router2FindTaggedNumber(text,tags){
 const source=String(text||'');
 for(const tag of tags){
  const escaped=tag.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  for(const pattern of [new RegExp(`${escaped}\\s*[:=,]?\\s*(-?\\d+(?:\\.\\d+)?)`,'i'),new RegExp(`\\+${escaped}\\s*[:=,]?\\s*(-?\\d+(?:\\.\\d+)?)`,'i')]){
   const match=source.match(pattern);if(match)return Number(match[1]);
  }
 }
 return null;
}

function router2NumericValue(value){
 const match=String(value??'').match(/-?\d+(?:\.\d+)?/);return match?Number(match[0]):null;
}

function parseRouter2Diagnostics(data){
 if(!data||typeof data!=='object')throw new Error('Invalid CMD 186 response');
 if(data.success===false)throw new Error('CMD 186 failed');
 const lines=router2Flatten(data);
 const flattened=lines.join('\n');
 let rsrp=router2FindTaggedNumber(flattened,['TZRSRP','RSRP']);
 let globalCellId=router2FindTaggedNumber(flattened,['TZGLBCELLID','GLBCELLID','GLOBALCELLID']);
 for(let i=0;i<lines.length;i++){
  const line=String(lines[i]);
  if(rsrp===null&&/TZRSRP|RSRP/i.test(line)){rsrp=router2NumericValue(line);if(rsrp===null&&i+1<lines.length)rsrp=router2NumericValue(lines[i+1])}
  if(globalCellId===null&&/TZGLBCELLID|GLBCELLID|GLOBALCELLID/i.test(line)){globalCellId=router2NumericValue(line);if(globalCellId===null&&i+1<lines.length)globalCellId=router2NumericValue(lines[i+1])}
 }
 if(rsrp===null||globalCellId===null)throw new Error('CMD 186 data unavailable');
 const cellId=Math.trunc(globalCellId);
 return {rsrpDbm:router2NormalizeDbm(rsrp),globalCellId:cellId,globalCellIdHex:`0x${cellId.toString(16).padStart(8,'0')}`,eNodeBId:cellId>>8,sectorId:cellId&255};
}

function router2CurrentData(parsed){
 if(parsed&&parsed.data&&typeof parsed.data==='object'&&!Array.isArray(parsed.data))return parsed.data;
 return parsed;
}

function router2CancelDetectionPolling(){
 if(router1DetectionTimer!==null){
  clearTimeout(router1DetectionTimer);
  router1DetectionTimer=null;
  router2DiagnosticLog('ZLT detection polling','paused after successful API response',{key:'zlt-polling-paused',minInterval:10000});
 }
}

function router2MarkApiHealthy(command){
 const wasHealthy=router2ApiHealthy;
 router2ApiHealthy=true;
 router2ApiAvailabilityFailures=0;
 if(!wasHealthy)router2DiagnosticLog('Router 2 API availability',`${command} returned HTTP 200; integration confirmed`);
 if(router2ZltDetected&&router2IntegrationStarted)router2CancelDetectionPolling();
}

function router2ScheduleDetectionAfterApiFailure(reason){
 if(!router2ZltDetected||!router2IntegrationStarted||router1DetectionTimer!==null)return;
 router2DiagnosticLog('ZLT detection polling',`scheduled after ${ROUTER2_API_FAILURE_THRESHOLD} API availability failures (${reason})`);
 router1DetectionTimer=setTimeout(()=>{
  router1DetectionTimer=null;
  runRouter1Detection();
 },ROUTER1_REDETECT_MS);
}

function router2MarkApiUnavailable(reason){
 if(!router2ZltDetected||!router2IntegrationStarted)return;
 router2ApiHealthy=false;
 router2ApiAvailabilityFailures+=1;
 router2DiagnosticLog('Router 2 API unavailable',`failure ${router2ApiAvailabilityFailures}/${ROUTER2_API_FAILURE_THRESHOLD}; reason=${reason}`,{key:`api-unavailable-${reason}`,minInterval:5000});
 if(router2ApiAvailabilityFailures>=ROUTER2_API_FAILURE_THRESHOLD)router2ScheduleDetectionAfterApiFailure(reason);
}

async function router2Request(payload,timeoutMs=ROUTER2_TIMEOUT_MS){
 const controller=new AbortController();
 router2AbortControllers.add(controller);
 const started=performance.now();
 const command=Number.isFinite(Number(payload?.cmd))?`CMD${Number(payload.cmd)}`:'Router command';
 router2DiagnosticState.lastCommand=command;
 router2DiagnosticLog(`${command} attempt`,`method=${String(payload?.method||'GET').toUpperCase()}`);
 try{
  const response=await fetch(`${router2Origin}${ROUTER2_API_PATH}`,{
   method:'POST',headers:{
    Accept:'text/plain, */*; q=0.01',
    'Content-Type':'application/json; charset=UTF-8',
    Origin:router2Origin,
    Referer:`${router2Origin}/mindex.html`,
   'X-Requested-With':'XMLHttpRequest'
   },credentials:'include',cache:'no-store',body:JSON.stringify(payload),signal:controller.signal
  });
  const latency=Math.round(performance.now()-started);
  router2DiagnosticState.lastHttp=`${response.status} / ${latency} ms`;
  if(!response.ok){
   router2DiagnosticLog(`${command} HTTP error`,`status=${response.status}; latency=${latency} ms`);
   if(response.status!==401&&response.status!==403)router2MarkApiUnavailable(`HTTP ${response.status}`);
   else router2DiagnosticLog(`${command} HTTP auth rejection`,`status=${response.status}; endpoint reachable`,{key:`${command}-auth-http`,minInterval:5000});
   throw new Error(`HTTP ${response.status}`);
  }
  router2MarkApiHealthy(command);
  const text=await response.text();
  router2DiagnosticLog(`${command} HTTP`,`status=${response.status}; latency=${latency} ms`,{key:`${command}-http-success`,minInterval:15000});
  if(!text.trim()){
   router2DiagnosticLog(`${command} error`,'empty response');
   throw new Error('Empty router response');
  }
  router2DiagnosticLog(`${command} response`,router2DiagnosticResponseSummary(text),{key:`${command}-response`,minInterval:15000});
  return text;
 }catch(error){
  if(error?.name==='AbortError'){
   router2DiagnosticState.lastError='timeout';
   router2DiagnosticLog(`${command} error`,'timeout');
   router2MarkApiUnavailable('timeout');
   throw new Error('Router request timed out');
  }
  if(/^HTTP\s+\d{3}$/i.test(String(error?.message||'')))router2DiagnosticState.lastError=router2DiagnosticSafeError(error);
  else if(!/^HTTP\s+\d{3}$/i.test(String(error?.message||''))){
   router2DiagnosticState.lastError=router2DiagnosticSafeError(error);
   router2DiagnosticLog(`${command} error`,router2DiagnosticSafeError(error),{key:`${command}-error-${router2DiagnosticSafeError(error)}`,minInterval:5000});
   if(!/^HTTP\s+\d{3}$/i.test(String(error?.message||'')))router2MarkApiUnavailable(router2DiagnosticSafeError(error));
  }
  throw error;
 }finally{router2AbortControllers.delete(controller);router2LastRequestMs=Math.round(performance.now()-started)}
}

let router2LastRequestMs=null;

async function authenticateRouter2(generation=router2Generation){
 if(!router2HasCredentials()){
  router2DiagnosticState.auth='missing credentials';
  router2DiagnosticLog('Authentication skipped','credentials missing — open CommandTab Settings and save Router 2 credentials',{key:'auth-missing',minInterval:10000});
  return false;
 }
 if(router2AuthPromise)return router2AuthPromise;
 const promise=(async()=>{
  router2DiagnosticState.auth='attempting';
  router2DiagnosticLog('Authentication attempt','credential presence=yes');
  if(router2IsActive(generation))router2SetState('Authenticating','muted','Authenticating');
  try{
   const response=await router2Request({cmd:100,method:'POST',sessionId:router2SessionId,username:router2Credentials.username,passwd:router2Credentials.passwordHash,language:'EN'});
   const json=router2TryJson(response);
   if(router2IsSessionInvalid(response)||(json&&json.success===false)){
    router2DiagnosticState.auth='failed';
    router2DiagnosticLog('Authentication result','failed');
    return false;
   }
   const nextSession=router2FindSessionId(response);if(nextSession)router2SessionId=nextSession;
   router2DiagnosticState.auth='succeeded';
   router2DiagnosticLog('Authentication result',`succeeded; session established=${nextSession?'yes':'no'}`);
   return true;
  }catch(error){
   router2DiagnosticState.auth='failed';
   router2DiagnosticLog('Authentication result',router2DiagnosticSafeError(error));
   return false;
  }
 })();
 router2AuthPromise=promise;
 try{return await promise}finally{if(router2AuthPromise===promise)router2AuthPromise=null}
}

async function router2RequestWithAuth(payload,generation=router2Generation){
 const requestPayload={...payload,sessionId:router2SessionId};
 let response=await router2Request(requestPayload);
 if(!router2IsSessionInvalid(response))return response;
 router2DiagnosticLog('Authentication required','router rejected current session',{key:'auth-required',minInterval:5000});
 if(!(await authenticateRouter2(generation)))throw new Error('AUTHENTICATION_FAILED');
 response=await router2Request({...payload,sessionId:router2SessionId});
 if(router2IsSessionInvalid(response))throw new Error('SESSION_EXPIRED');
 return response;
}

function router2IsActive(generation=router2Generation){
 return router2IntegrationStarted&&router2ZltDetected&&generation===router2Generation;
}

function router2ResetCounters(){
 router2PreviousCounters=null;
 router2PreviousTimestamp=null;
 setRouterText('r2down','--');
 setRouterText('r2up','--');
}

function router2ResetView(){
 router2Signal={metric:'rssi',rssi:null,rsrp:null};
 router2LastRawUptime='--';
 router2ResetCounters();
 renderRouter2SignalBars(0,'--');
 ['r2devices','r2ping','r2ip','r2uptime','r2operator','r2plmn','r2rsrp','r2cellid'].forEach(id=>setRouterText(id,'--'));
 setRouterText('r2rawdata','--');
}

function router2SetAuthenticationFailure(message='Authentication failed'){
 router2SessionId='';
 router2ResetCounters();
 router2DiagnosticState.auth='failed';
 router2DiagnosticState.lastError=message;
 router2DiagnosticLog('Authentication state',message,{key:`auth-state-${message}`,minInterval:5000});
 if(router2IsActive())router2SetState(message,'bad',message);
}

const ROUTER2_OPERATOR_BY_PLMN=Object.freeze({
 '41302':'Dialog',
 '41311':'Dialog'
});

function router2OperatorName(plmn){
 const normalized=String(plmn??'').trim();
 return ROUTER2_OPERATOR_BY_PLMN[normalized]|| (normalized?'Mobile Network':'--');
}

function processRouter2Status(parsed,latencyMs){
 const data=router2CurrentData(parsed);
 if(!data||typeof data!=='object')throw new Error('Invalid router status');
 const rssi=router2NormalizeDbm(data.rssi);
 if(rssi!==null)router2Signal.rssi=rssi;
 const current={rx:Number(data.wanRxBytes),tx:Number(data.wanTxBytes)};
 const now=Date.now();
 if(Number.isFinite(current.rx)&&Number.isFinite(current.tx)){
  const rates=router2PreviousCounters?calculateRouter2Rates(router2PreviousCounters,current,now-router2PreviousTimestamp):null;
  if(rates?.reset){router2ResetCounters()}else if(rates){setRouterText('r2down',formatRouter2Rate(rates.downloadBps));setRouterText('r2up',formatRouter2Rate(rates.uploadBps))}
  router2PreviousCounters=current;router2PreviousTimestamp=now;
 }
 setRouterText('r2ping',Number.isFinite(Number(latencyMs))?`${Math.max(0,Math.round(Number(latencyMs)))} ms`:'--');
 setRouterText('r2ip',String(data.wanIP||'--'));
 setRouterText('r2uptime',formatRouter2Uptime(data.uptime));
 const rawUptime=router2RawUptime(data.uptime);
 router2LastRawUptime=rawUptime;
 const plmn=String(data.plmn??'').trim();
 setRouterText('r2plmn',plmn||'--');
 setRouterText('r2operator',router2OperatorName(plmn));
 updateRouter2SignalDisplay();
 const rx=Number(data.wanRxBytes),tx=Number(data.wanTxBytes);
 setRouterText('r2rawdata',`CMD0 · RSSI ${rssi===null?'--':`${rssi} dBm`} · WAN RX ${Number.isFinite(rx)?'available':'--'} · WAN TX ${Number.isFinite(tx)?'available':'--'} · PLMN ${plmn||'--'} · Uptime raw ${rawUptime}`);
 router2DiagnosticState.lastParse='CMD0 ok';
 router2DiagnosticLog('CMD0 parse',`result=ok; RSSI=${rssi===null?'absent':'present'}; WAN counters=${Number.isFinite(rx)&&Number.isFinite(tx)?'present':'absent'}; PLMN=${plmn?'present':'absent'}`,{key:'CMD0-parse-success',minInterval:15000});
}

async function router2StatusCycle(generation){
 if(!router2IsActive(generation))return;
 if(router2StatusRunning){return}
 router2StatusRunning=true;
 try{
  if(!router2HasCredentials()){
   router2DiagnosticState.auth='missing credentials';
   router2SetState('Login required','bad','Login required');
   router2DiagnosticLog('Login required','open CommandTab Settings and save Router 2 credentials',{key:'login-required',minInterval:10000});
   return;
  }
  const started=performance.now();
  const response=await router2RequestWithAuth({cmd:0,method:'GET',language:'EN'},generation);
  if(!router2IsActive(generation))return;
  processRouter2Status(router2TryJson(response),performance.now()-started);
  router2SetState('Online','online','Online');
  setRouterText('r2updated',new Date().toLocaleTimeString());
 }catch(error){
  if(!router2IsActive(generation))return;
  router2DiagnosticState.lastError=router2DiagnosticSafeError(error);
  router2DiagnosticLog('CMD0 cycle error',router2DiagnosticSafeError(error),{key:`CMD0-cycle-${router2DiagnosticSafeError(error)}`,minInterval:5000});
  if(error?.message==='AUTHENTICATION_FAILED'||error?.message==='SESSION_EXPIRED')router2SetAuthenticationFailure(error.message==='AUTHENTICATION_FAILED'?'Authentication failed':'Session expired');
  else router2SetState('Offline / API error','bad','Unavailable');
 }finally{
  router2StatusRunning=false;
  if(router2IsActive(generation))router2ScheduleStatus(generation,ROUTER2_STATUS_INTERVAL_MS);
 }
}

async function router2DevicesCycle(generation){
 if(!router2IsActive(generation)||router2DevicesRunning)return;
 router2DevicesRunning=true;
 try{
  if(router2HasCredentials()){
   const response=await router2RequestWithAuth({cmd:121,method:'GET',language:'EN'},generation);
   if(!router2IsActive(generation))return;
   const data=router2TryJson(response);
   if(!data||typeof data!=='object')throw new Error('Invalid CMD 121 response');
   if(data.success===false)throw new Error('CMD121 failed');
   const rows=Array.isArray(data?.data)?data.data:[];
   setRouterText('r2devices',String(rows.length));
   router2DiagnosticState.lastParse='CMD121 ok';
   router2DiagnosticLog('CMD121 parse',`result=ok; device rows=${rows.length}`,{key:'CMD121-parse-success',minInterval:30000});
  }else{
   router2DiagnosticLog('CMD121 skipped','credentials missing — open CommandTab Settings and save Router 2 credentials',{key:'CMD121-missing',minInterval:30000});
  }
 }catch(error){
  router2DiagnosticState.lastError=router2DiagnosticSafeError(error);
  router2DiagnosticLog('CMD121 cycle error',router2DiagnosticSafeError(error),{key:`CMD121-cycle-${router2DiagnosticSafeError(error)}`,minInterval:5000});
  if(router2IsActive(generation)&&(error?.message==='AUTHENTICATION_FAILED'||error?.message==='SESSION_EXPIRED'))router2SetAuthenticationFailure('Authentication failed');
 }finally{
  router2DevicesRunning=false;
  if(router2IsActive(generation))router2ScheduleDevices(generation,ROUTER2_DEVICES_INTERVAL_MS);
 }
}

async function router2CellCycle(generation){
 if(!router2IsActive(generation)||router2CellRunning)return;
 router2CellRunning=true;
 try{
  if(router2HasCredentials()){
   const response=await router2RequestWithAuth({method:'POST',cmd:186,atcmd:['AT+TZRSRP?','AT+TZGLBCELLID?'],language:'EN'},generation);
   if(!router2IsActive(generation))return;
   const parsed=parseRouter2Diagnostics(router2TryJson(response));
   router2Signal.rsrp=parsed.rsrpDbm;
   updateRouter2SignalDisplay();
   setRouterText('r2rsrp',`${parsed.rsrpDbm} dBm`);
   setRouterText('r2cellid',String(parsed.globalCellId));
   setRouterText('r2rawdata',`CMD0/CMD186 · ${router2Signal.metric.toUpperCase()} ${parsed.rsrpDbm} dBm · Cell ${parsed.globalCellId} · eNodeB ${parsed.eNodeBId} · Sector ${parsed.sectorId} · Uptime raw ${router2LastRawUptime}`);
   router2DiagnosticState.lastParse='CMD186 ok';
   router2DiagnosticLog('CMD186 parse',`result=ok; RSRP=${parsed.rsrpDbm} dBm; cell data=present`,{key:'CMD186-parse-success',minInterval:60000});
  }else{
   router2DiagnosticLog('CMD186 skipped','credentials missing — open CommandTab Settings and save Router 2 credentials',{key:'CMD186-missing',minInterval:60000});
  }
 }catch(error){
  router2DiagnosticState.lastError=router2DiagnosticSafeError(error);
  router2DiagnosticLog('CMD186 cycle error',router2DiagnosticSafeError(error),{key:`CMD186-cycle-${router2DiagnosticSafeError(error)}`,minInterval:5000});
  if(router2IsActive(generation)&&(error?.message==='AUTHENTICATION_FAILED'||error?.message==='SESSION_EXPIRED'))router2SetAuthenticationFailure('Authentication failed');
 }finally{
  router2CellRunning=false;
  if(router2IsActive(generation))router2ScheduleCell(generation,ROUTER2_CELL_INTERVAL_MS);
 }
}

function router2ScheduleStatus(generation,delay=0){
 if(!router2IsActive(generation)||router2StatusTimer!==null)return;
 router2StatusTimer=setTimeout(()=>{router2StatusTimer=null;router2StatusCycle(generation)},delay);
}
function router2ScheduleDevices(generation,delay=0){
 if(!router2IsActive(generation)||router2DevicesTimer!==null)return;
 router2DevicesTimer=setTimeout(()=>{router2DevicesTimer=null;router2DevicesCycle(generation)},delay);
}
function router2ScheduleCell(generation,delay=0){
 if(!router2IsActive(generation)||router2CellTimer!==null)return;
 router2CellTimer=setTimeout(()=>{router2CellTimer=null;router2CellCycle(generation)},delay);
}

function startRouter2Integration(){
 if(router2IntegrationStarted)return;
 router2IntegrationStarted=true;
 router2ApiHealthy=false;
 router2ApiAvailabilityFailures=0;
 router2DiagnosticState.integration='running';
 router2DiagnosticLog('Router 2 lifecycle','started');
 router2Generation+=1;
 router2SessionId='';
 router2ResetView();
 setRouter2DetectedState();
 const generation=router2Generation;
 router2ScheduleStatus(generation);
 router2ScheduleDevices(generation);
 router2ScheduleCell(generation);
}

function stopRouter2Integration(){
 router2IntegrationStarted=false;
 router2ApiHealthy=false;
 router2ApiAvailabilityFailures=0;
 router2DiagnosticState.integration='stopped';
 router2DiagnosticLog('Router 2 lifecycle','stopped');
 router2Generation+=1;
 router2SessionId='';
 [router2StatusTimer,router2DevicesTimer,router2CellTimer].forEach(timer=>{if(timer!==null)clearTimeout(timer)});
 router2StatusTimer=null;router2DevicesTimer=null;router2CellTimer=null;
 router2AbortControllers.forEach(controller=>controller.abort());
 router2AbortControllers.clear();
 router2ResetView();
}

async function detectZltRouter(origin=router2Origin){
 router2DiagnosticLog('ZLT detection attempt','checking configured router login page',{key:'zlt-detection-attempt',minInterval:5000});
 try{
  const response=await timedFetch(`${normalizeRouter2Origin(origin)}/login.html`,1800,{
   method:'GET',
   credentials:'omit',
   redirect:'error',
   headers:{'Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache'}
  });
  if(response.status!==200){
   router2DiagnosticLog('ZLT detection result',`detected=no; HTTP ${response.status}`,{key:'zlt-detection-result-no',minInterval:10000});
   return false;
  }
  const body=await response.text();
  const matches=ROUTER2_ZLT_SIGNATURES.reduce((count,signature)=>count+(body.includes(signature)?1:0),0);
  const detected=matches>=ROUTER2_ZLT_MIN_SIGNATURES;
  router2DiagnosticLog('ZLT detection result',`detected=${detected?'yes':'no'}; signatures=${matches}/${ROUTER2_ZLT_SIGNATURES.length}`,{key:`zlt-detection-result-${detected?'yes':'no'}`,minInterval:10000});
  return detected;
 }catch(error){
  router2DiagnosticState.lastError=router2DiagnosticSafeError(error);
  router2DiagnosticLog('ZLT detection error',router2DiagnosticSafeError(error),{key:`zlt-detection-error-${router2DiagnosticSafeError(error)}`,minInterval:5000});
  return false;
 }
}

function setRouter1NeutralState(){
 const state=document.getElementById('r1state');
 if(state){state.textContent='● Huawei not detected';state.className='muted'}
 setRouterText('r1sessionstatus','Not connected');
 setRouterText('r1updated','--');
 ['r1down','r1up','r1rsrp','r1rsrq','r1sinr','r1rssi','r1pci','r1cellid','r1mode','r1operator','r1plmn'].forEach(id=>setRouterText(id,'--'));
}

function setRouter2DetectedState(){
 const state=document.getElementById('r2state');
 if(state){state.textContent='● Detected';state.className='muted'}
 setRouterText('r2sessionstatus','Detected');
 setRouterText('r2updated','ZLT P11 detected');
}

function pauseRouter1LiveLoop(){
 if(router1LiveTimer!==null){clearTimeout(router1LiveTimer);router1LiveTimer=null}
}

async function runRouter1Detection(){
 if(router1DetectionInFlight)return;
 router1DetectionInFlight=true;
 try{
  router2DetectionOrigin=router2Origin;
  const zltDetected=await detectZltRouter(router2DetectionOrigin);
  const nextDetection=zltDetected?'zlt':'not-zlt';
  if(router2DiagnosticState.detection!==nextDetection){
   const previous=router2DiagnosticState.detection;
   router2DiagnosticState.detection=nextDetection;
   router2DiagnosticLog('ZLT detection transition',`${previous} -> ${nextDetection}`);
  }
  if(zltDetected){
   router2ZltDetected=true;
   router1Mode='zlt';
   router1BootstrapStarted=false;
   router1PrevTraffic=null;
   pauseRouter1LiveLoop();
   if(!router2IntegrationStarted)startRouter2Integration();
   setRouter1NeutralState();
  }else{
   const wasZlt=router2ZltDetected;
   router2ZltDetected=false;
   if(wasZlt)stopRouter2Integration();
   setRouter2IdleState();
   if(router1Mode!=='huawei'){
    router1Mode='huawei';
    await startRouter1();
   }else if(router1LiveLoopStarted&&!router1LiveLoopRunning&&router1LiveTimer===null){
    startRouter1LiveLoop();
   }
  }
 }finally{
  router1DetectionInFlight=false;
  if(router2ZltDetected&&router2IntegrationStarted){
   // A healthy CMD endpoint owns liveness after the shared-IP detector succeeds.
   router2CancelDetectionPolling();
  }else if(router1DetectionTimer===null){
   router1DetectionTimer=setTimeout(()=>{
    router1DetectionTimer=null;
    runRouter1Detection();
   },ROUTER1_REDETECT_MS);
  }
 }
}


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
  setRouterText('r1updated', new Date().toLocaleTimeString());
}

async function router1LiveCycle() {
 if(router1Mode!=='huawei'){router1LiveTimer=null;return}
 router1LiveLoopRunning=true;
 try {
    if(router1Mode!=='huawei') return;
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
    router1LiveLoopRunning=false;
    if(router1Mode==='huawei') router1LiveTimer=setTimeout(router1LiveCycle, ROUTER1_REFRESH_MS);
    else router1LiveTimer=null;
  }
}

function startRouter1LiveLoop(){
 if(router1Mode!=='huawei'||router1LiveLoopRunning||router1LiveTimer!==null)return;
 router1LiveLoopStarted=true;
 router1LiveCycle();
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
    setRouterText('r1sessionstatus', 'Session unavailable');
    return false;
  }
}

async function startRouter1() {
  if(router1Mode!=='huawei')return;
  if(!router1BootstrapStarted){
    router1BootstrapStarted=true;
    await bootstrapRouter1Session();
    if(router1Mode==='huawei')fetchRouter1PlmnOnce();
  }
 startRouter1LiveLoop();
}

chrome.storage?.onChanged?.addListener((changes,area)=>{
 if(area!=='local')return;
 if(changes.router2Username)router2Credentials.username=String(changes.router2Username.newValue||ROUTER2_DEFAULT_USERNAME).trim()||ROUTER2_DEFAULT_USERNAME;
 if(changes.router2PasswordHash)router2Credentials.passwordHash=typeof changes.router2PasswordHash.newValue==='string'&&changes.router2PasswordHash.newValue.trim()?changes.router2PasswordHash.newValue.trim():ROUTER2_DEFAULT_PASSWORD_HASH;
 if(changes.router2Username||changes.router2PasswordHash)router2CredentialSource=(changes.router2PasswordHash?.newValue||changes.router2Username?.newValue)?'saved settings':'built-in default';
 if(changes.routers?.newValue?.[1]?.baseUrl){
  const nextOrigin=normalizeRouter2Origin(changes.routers.newValue[1].baseUrl);
  if(nextOrigin!==router2Origin){router2Origin=nextOrigin;if(router2ZltDetected){stopRouter2Integration();startRouter2Integration()}}
 }
 if(changes.router2Username||changes.router2PasswordHash){
  router2DiagnosticLog('Credentials changed',`credential presence=${router2HasCredentials()?'yes':'no'}; source=${router2CredentialSource}`);
  router2SessionId='';
  if(router2ZltDetected&&router2IntegrationStarted){router2ResetCounters();router2SetState(router2HasCredentials()?'Authenticating':'Login required',router2HasCredentials()?'muted':'bad',router2HasCredentials()?'Authenticating':'Login required')}
 }
});
router2DiagnosticLog('Extension loaded','Router 2 diagnostics ready; sensitive values are omitted');
runRouter1Detection();
