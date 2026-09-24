
const d=[
 {name:'Home 4G',baseUrl:'http://192.168.8.1',statusPath:'',enabled:true},
 {name:'Backup 4G',baseUrl:'http://192.168.1.1',statusPath:'',enabled:true}
];
async function init(){const s=await chrome.storage.local.get('routers'),r=s.routers||d;
 for(let i=0;i<2;i++){let n=i+1;document.querySelector('#r'+n+'name').value=r[i].name;document.querySelector('#r'+n+'url').value=r[i].baseUrl;document.querySelector('#r'+n+'path').value=r[i].statusPath||''}}
document.querySelector('#save').onclick=async()=>{
 const routers=[1,2].map(n=>({name:document.querySelector('#r'+n+'name').value.trim(),baseUrl:document.querySelector('#r'+n+'url').value.trim().replace(/\/$/,''),statusPath:document.querySelector('#r'+n+'path').value.trim(),enabled:true}));
 await chrome.storage.local.set({routers});document.querySelector('#msg').textContent='Saved ✓';setTimeout(()=>document.querySelector('#msg').textContent='',1800)
};init();
