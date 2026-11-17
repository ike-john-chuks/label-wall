const key=new URLSearchParams(location.search).get('key')||'',$=i=>document.getElementById(i);let st={notes:[],locked:false,review:false},admin=false;
const post=o=>fetch('/api/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({key},o))});
fetch('/api/info?key='+encodeURIComponent(key)).then(r=>r.json()).then(i=>{admin=i.admin;
 const local=['localhost','127.0.0.1'].includes(location.hostname),url=local?'http://'+(i.lan[0]||'localhost')+':'+i.port:location.origin;
 $('join').innerHTML='📱 '+'<b>'+url.replace('http://','').replace('https://','')+'</b>'+' <span style="font-size:14px;opacity:.7">(anonymous)</span>';
 if(admin)tools();draw()});
new EventSource('/api/stream?key='+encodeURIComponent(key)).onmessage=e=>{st=JSON.parse(e.data);draw()};
function tools(){const t=$('tools');t.innerHTML='';
 const mk=(label,cls,fn)=>{const b=document.createElement('button');b.textContent=label;if(cls)b.className='on';b.onclick=fn;t.appendChild(b)};
 mk(st.locked?'🔒 Locked – open':'🔓 Lock sending',st.locked,()=>post({action:'lock',value:!st.locked}));
 mk(st.review?'👁 Review ON':'👁 Review OFF',st.review,()=>post({action:'review',value:!st.review}));
 mk('🎲 Pick a note','',()=>{document.querySelectorAll('.note.pick').forEach(n=>n.classList.remove('pick'));const a=[...document.querySelectorAll('.note:not(.hid)')];if(a.length)a[Math.floor(Math.random()*a.length)].classList.add('pick')});
 mk('Clear all','',()=>{if(confirm('Delete ALL notes?'))post({action:'clear'})});}
function draw(){if(admin)tools();
 for(const [ty,w,c] of [['others','wy','cy'],['self','wb','cb']]){const wall=$(w);wall.innerHTML='';const ns=st.notes.filter(n=>n.type===ty);$(c).textContent=ns.filter(n=>!n.hidden).length;
  ns.forEach(n=>{const d=document.createElement('div');d.className='note'+(n.hidden?' hid':'');d.textContent=n.text;
   if(admin){const x=document.createElement('button');x.className='x';x.textContent=n.hidden?'✓':'✕';x.title=n.hidden?'Show':'Hide';x.onclick=()=>post({action:n.hidden?'show':'hide',id:n.id});d.appendChild(x)}
   wall.appendChild(d)})}}
