const key=new URLSearchParams(location.search).get('key')||'',$=i=>document.getElementById(i);let st={notes:[],locked:false,review:false},admin=false,toolState;
const post=o=>fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({key},o))}).then(r=>{if(!r.ok)throw new Error('Admin request failed: '+r.status);return r});
fetch('/api/info?key='+encodeURIComponent(key)).then(r=>{if(!r.ok)throw new Error('API info request failed: '+r.status);return r.json()}).then(i=>{admin=i.admin;
 const local=['localhost','127.0.0.1'].includes(location.hostname),url=local?'http://'+(i.lan[0]||'localhost')+':'+(i.port||3000):location.origin;
 $('join').innerHTML='📱 '+'<b>'+url.replace('http://','').replace('https://','')+'</b>'+' <span style="font-size:14px;opacity:.7">(anonymous)</span>';
 if(admin)tools();draw()});
async function refresh(){try{const r=await fetch('/api/state?key='+encodeURIComponent(key));if(!r.ok)throw new Error('Board state request failed: '+r.status);st=await r.json();draw()}catch(e){console.error('Could not refresh board state',e)}}
refresh();setInterval(refresh,2000);
function tools(){const state=st.locked+':'+st.review;if(state===toolState)return;toolState=state;const t=$('tools');t.innerHTML='';
 const mk=(label,cls,fn)=>{const b=document.createElement('button');b.textContent=label;if(cls)b.className='on';b.onclick=fn;t.appendChild(b)};
 mk(st.locked?'🔒 Locked – open':'🔓 Lock sending',st.locked,()=>post({action:'lock',value:!st.locked}));
 mk(st.review?'👁 Review ON':'👁 Review OFF',st.review,()=>post({action:'review',value:!st.review}));
 mk('🎲 Pick a note','',()=>{document.querySelectorAll('.note.pick').forEach(n=>n.classList.remove('pick'));const a=[...document.querySelectorAll('.note:not(.hid)')];if(a.length)a[Math.floor(Math.random()*a.length)].classList.add('pick')});
 mk('Clear all','',()=>{if(confirm('Delete ALL notes?'))post({action:'clear'})});}
function draw(){if(admin)tools();
 for(const [ty,w,c] of [['others','wy','cy'],['self','wb','cb']]){
  const wall=$(w),ns=st.notes.filter(n=>n.type===ty),current=new Set(ns.map(n=>n.id));
  [...wall.children].forEach(card=>{if(!current.has(card.dataset.id))card.remove()});
  const count=String(ns.filter(n=>!n.hidden).length);if($(c).textContent!==count)$(c).textContent=count;
  ns.forEach(n=>{
   let d=[...wall.children].find(card=>card.dataset.id===n.id);
   if(!d){d=document.createElement('div');d.className='note';d.dataset.id=n.id;
    const label=document.createElement('span');label.className='label';d.appendChild(label);
    if(admin){const x=document.createElement('button');x.className='x';x.onclick=()=>post({action:x.dataset.action,id:n.id}).catch(e=>console.error(e));d.appendChild(x)}
    wall.appendChild(d)}
   d.classList.toggle('hid',n.hidden);
   const label=d.querySelector('.label');if(label.textContent!==n.text)label.textContent=n.text;
   if(admin){const x=d.querySelector('.x');x.textContent=n.hidden?'✓':'✕';x.title=n.hidden?'Show':'Hide';x.dataset.action=n.hidden?'show':'hide'}
  })
 }
}
