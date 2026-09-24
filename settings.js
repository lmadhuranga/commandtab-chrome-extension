
const d=[
 {name:'Home 4G',baseUrl:'http://192.168.8.1',statusPath:'',enabled:true},
 {name:'Dialog ZLT P11',baseUrl:'http://192.168.8.1',statusPath:'',enabled:true}
];
const ROUTER2_DEFAULT_BASE='http://192.168.8.1';
const ROUTER2_LEGACY_DEFAULT_BASE='http://192.168.1.1';
const ROUTER2_DEFAULT_USERNAME='admin';
async function init(){const s=await chrome.storage.local.get('routers');let r=s.routers||d;
 if(r[1]?.baseUrl===ROUTER2_LEGACY_DEFAULT_BASE){r=r.map((router,index)=>index===1?{...router,baseUrl:ROUTER2_DEFAULT_BASE,name:router.name==='Backup 4G'?'Dialog ZLT P11':router.name}:router);await chrome.storage.local.set({routers:r})}
 const credentials=await chrome.storage.local.get(['router2Username','router2PasswordHash']);
 for(let i=0;i<2;i++){let n=i+1;document.querySelector('#r'+n+'name').value=r[i]?.name||d[i].name;document.querySelector('#r'+n+'url').value=r[i]?.baseUrl||d[i].baseUrl;const path=document.querySelector('#r'+n+'path');if(path)path.value=r[i]?.statusPath||''}
 document.querySelector('#router2Username').value=credentials.router2Username||ROUTER2_DEFAULT_USERNAME;
 document.querySelector('#router2Password').value='';
}
document.querySelector('#save').onclick=async()=>{
 const routers=[1,2].map(n=>{const path=document.querySelector('#r'+n+'path');return {name:document.querySelector('#r'+n+'name').value.trim(),baseUrl:document.querySelector('#r'+n+'url').value.trim().replace(/\/$/,''),statusPath:path?path.value.trim():'',enabled:true}});
 const username=document.querySelector('#router2Username').value.trim()||ROUTER2_DEFAULT_USERNAME;
 const password=document.querySelector('#router2Password').value;
 const stored=await chrome.storage.local.get('router2PasswordHash');
 const values={routers,router2Username:username};
 if(password)values.router2PasswordHash=RouterMD5.md5(password);
 else if(stored.router2PasswordHash)values.router2PasswordHash=stored.router2PasswordHash;
 else values.router2PasswordHash='';
 await chrome.storage.local.set(values);document.querySelector('#router2Password').value='';document.querySelector('#msg').textContent='Saved ✓';setTimeout(()=>document.querySelector('#msg').textContent='',1800)
};init();
