// LABEL WALL - anonymous phone responses -> live digital board (Kahoot-style)
// Zero dependencies. Run:  node server.js     (Node 16+)
// Students open  http://<your-address>:3000      Facilitator opens the /board?key=... link printed below.
const http = require("http"),
  fs = require("fs"),
  os = require("os"),
  path = require("path"),
  crypto = require("crypto");
const PORT = process.env.PORT || 3000;
const KEY =
  process.env.ADMIN_KEY || String(Math.floor(1000 + Math.random() * 9000));
const FILE = path.join(__dirname, "notes.json");
let S = { notes: [], locked: false, review: false };
try {
  S = Object.assign(S, JSON.parse(fs.readFileSync(FILE, "utf8")));
} catch (e) {}
const save = () => fs.writeFile(FILE, JSON.stringify(S), () => {});
const clients = new Set(); // SSE connections {res, admin}
const hits = new Map(); // flood control only (in memory, never stored with notes)

const view = (admin) => ({
  locked: S.locked,
  review: S.review,
  notes: S.notes
    .filter((n) => admin || !n.hidden)
    .map((n) => ({ id: n.id, type: n.type, text: n.text, hidden: n.hidden })),
});
const push = () =>
  clients.forEach((c) =>
    c.res.write("data: " + JSON.stringify(view(c.admin)) + "\n\n"),
  );
const json = (res, code, o) => {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(o));
};
const body = (req) =>
  new Promise((r) => {
    let b = "";
    req.on("data", (d) => {
      b += d;
      if (b.length > 4000) req.destroy();
    });
    req.on("end", () => {
      try {
        r(JSON.parse(b));
      } catch (e) {
        r({});
      }
    });
  });

http
  .createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(STUDENT);
    }
    if (u.pathname === "/board") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(BOARD);
    }
    if (u.pathname === "/api/info")
      return json(res, 200, {
        port: PORT,
        lan: lanIPs(),
        admin: u.searchParams.get("key") === KEY,
      });
    if (u.pathname === "/api/stream") {
      const admin = u.searchParams.get("key") === KEY;
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const c = { res, admin };
      clients.add(c);
      res.write("data: " + JSON.stringify(view(admin)) + "\n\n");
      const ka = setInterval(() => res.write(": ping\n\n"), 20000);
      return req.on("close", () => {
        clients.delete(c);
        clearInterval(ka);
      });
    }
    if (u.pathname === "/api/note" && req.method === "POST") {
      const b = await body(req);
      const ip = req.socket.remoteAddress,
        now = Date.now();
      const h = (hits.get(ip) || []).filter((t) => now - t < 600000);
      if (h.length >= 30) return json(res, 429, { error: "slow" });
      hits.set(ip, h.concat(now));
      if (S.locked) return json(res, 423, { error: "locked" });
      const text = String(b.text || "")
        .replace(/[\u0000-\u001f<>]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 60);
      if (!text || !["others", "self"].includes(b.type))
        return json(res, 400, { error: "bad" });
      S.notes.push({
        id: crypto.randomBytes(4).toString("hex"),
        type: b.type,
        text,
        hidden: S.review,
      });
      save();
      push();
      return json(res, 200, { ok: true });
    }
    if (u.pathname === "/api/admin" && req.method === "POST") {
      const b = await body(req);
      if (b.key !== KEY) return json(res, 403, { error: "key" });
      const n = S.notes.find((x) => x.id === b.id);
      if (b.action === "hide" && n) n.hidden = true;
      else if (b.action === "show" && n) n.hidden = false;
      else if (b.action === "delete")
        S.notes = S.notes.filter((x) => x.id !== b.id);
      else if (b.action === "lock") S.locked = !!b.value;
      else if (b.action === "review") S.review = !!b.value;
      else if (b.action === "clear") S.notes = [];
      save();
      push();
      return json(res, 200, { ok: true });
    }
    res.writeHead(404);
    res.end("Not found");
  })
  .listen(PORT, "0.0.0.0", () => {
    const ip = lanIPs()[0] || "localhost";
    console.log("\n  LABEL WALL is running\n");
    console.log("  Students open :  http://" + ip + ":" + PORT);
    console.log(
      "  Facilitator   :  http://" +
        ip +
        ":" +
        PORT +
        "/board?key=" +
        KEY +
        "   (project this one)\n",
    );
    console.log(
      "  Phones must be on the same Wi-Fi/hotspot as this computer (or host the app online).\n",
    );
  });
function lanIPs() {
  return []
    .concat(...Object.values(os.networkInterfaces()))
    .filter((i) => i.family === "IPv4" && !i.internal)
    .map((i) => i.address);
}

// ---------- Student page (phones) ----------
const STUDENT = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Label Wall</title><style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#f4f1ea;color:#222;padding:16px;max-width:520px;margin:auto}
h1{font-size:20px;margin:4px 0 2px}.sub{font-size:13px;color:#666;margin-bottom:14px}
.tabs{display:flex;gap:8px}.tab{flex:1;border:3px solid transparent;border-radius:12px;padding:12px 8px;font-size:15px;font-weight:600;cursor:pointer;color:#222}
.tab.y{background:#ffe066}.tab.b{background:#8ecbff}.tab.on{border-color:#222}
.hint{font-size:14px;margin:12px 2px 8px;min-height:38px}
textarea{width:100%;height:96px;border:2px solid #222;border-radius:10px;padding:10px;font-size:17px;font-family:inherit;resize:none}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.chip{background:#fff;border:1px solid #bbb;border-radius:16px;padding:5px 10px;font-size:13px;cursor:pointer}
.send{width:100%;padding:14px;border:0;border-radius:12px;background:#222;color:#fff;font-size:17px;font-weight:700;cursor:pointer}.send:disabled{opacity:.4}
.msg{margin-top:10px;font-size:14px;min-height:20px;font-weight:600}.anon{font-size:12px;color:#666;margin-top:14px}
.lang{float:right;font-size:12px;border:1px solid #aaa;background:#fff;border-radius:8px;padding:3px 8px;cursor:pointer}
</style></head><body>
<button class="lang" id="lang">EN / МК</button><h1 id="h"></h1><div class="sub" id="sub"></div>
<div class="tabs"><button class="tab y on" id="ty"></button><button class="tab b" id="tb"></button></div>
<div class="hint" id="hint"></div><textarea id="t" maxlength="60"></textarea><div class="chips" id="chips"></div>
<button class="send" id="send"></button><div class="msg" id="msg"></div><div class="anon" id="anon"></div>
<script>
const L={mk:{h:'Табла со етикети',sub:'Одговорите се анонимни и се појавуваат на екранот.',ty:'Што велат другите за мене',tb:'Што јас велам за себе',
hy:'Етикети што ми ги ставаат другите или општеството.',hb:'Етикети што сам си ги ставам – добри или лоши.',ph:'Напиши една етикета (до 60 знаци)…',send:'Испрати',
ok:'Испратено! Погледни на екранот. Можеш да додадеш уште.',lock:'Испраќањето е затворено.',lim:'Го достигна лимитот (8 етикети).',err:'Не успеа. Обиди се пак.',
anon:'Анонимно е: не се собираат имиња и никој не гледа кој што напишал.',
ex:['ученик','син/ќерка на…','од Битола','мрзливата генерација','оној што ќе замине','премногу млад','тивкиот','смешниот']},
en:{h:'Label Wall',sub:'Answers are anonymous and appear on the big screen.',ty:'What others say about me',tb:'What I say about myself',
hy:'Labels other people or society put on you.',hb:'Labels you put on yourself, good or bad.',ph:'Write one label (max 60 characters)…',send:'Send',
ok:'Sent! Look at the screen. You can add more.',lock:'Sending is closed.',lim:'You reached the limit (8 labels).',err:'Did not work. Try again.',
anon:'This is anonymous: no names are collected and nobody can see who wrote what.',
ex:['student','the son/daughter of…','from Bitola','the lazy generation','the one who will leave','too young','the quiet one','the funny one']}};
let lg=(navigator.language||'').startsWith('mk')?'mk':'en',type='others',$=i=>document.getElementById(i);
let sent=+(localStorage.getItem('lw_sent')||0);
function draw(){const s=L[lg];$('h').textContent=s.h;$('sub').textContent=s.sub;$('ty').textContent=s.ty;$('tb').textContent=s.tb;
$('hint').textContent=type==='others'?s.hy:s.hb;$('t').placeholder=s.ph;$('send').textContent=s.send;$('anon').textContent=s.anon;
$('chips').innerHTML='';if(type==='others')s.ex.forEach(x=>{const c=document.createElement('span');c.className='chip';c.textContent=x;c.onclick=()=>{$('t').value=x;$('t').focus()};$('chips').appendChild(c)});}
$('lang').onclick=()=>{lg=lg==='mk'?'en':'mk';draw()};
$('ty').onclick=()=>{type='others';$('ty').classList.add('on');$('tb').classList.remove('on');draw()};
$('tb').onclick=()=>{type='self';$('tb').classList.add('on');$('ty').classList.remove('on');draw()};
$('send').onclick=async()=>{const s=L[lg],text=$('t').value.trim();if(!text)return;if(sent>=8){$('msg').textContent=s.lim;return}
$('send').disabled=true;try{const r=await fetch('/api/note',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,text})});
if(r.ok){sent++;localStorage.setItem('lw_sent',sent);$('t').value='';$('msg').textContent=s.ok}else $('msg').textContent=r.status===423?s.lock:s.err}
catch(e){$('msg').textContent=s.err}setTimeout(()=>$('send').disabled=false,1500)};
draw();
</script></body></html>`;

// ---------- Board page (projector) ----------
const BOARD = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Label Wall - Board</title><style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#2b2b2b;color:#fff;height:100vh;display:flex;flex-direction:column}
header{display:flex;justify-content:space-between;align-items:center;padding:10px 22px;background:#1b1b1b;gap:16px;flex-wrap:wrap}
.join{font-size:20px}.join b{font-size:26px;color:#ffe066}.tools button{margin-left:6px;padding:6px 10px;border-radius:8px;border:0;background:#555;color:#fff;cursor:pointer;font-size:14px}
.tools button.on{background:#c0392b}main{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:14px;min-height:0}
.col{border-radius:14px;padding:12px;display:flex;flex-direction:column;min-height:0}.col.y{background:#5a4f1a}.col.b{background:#1d4468}
.col h2{margin:0 0 10px;font-size:24px;display:flex;justify-content:space-between}.cnt{opacity:.7}
.wall{display:flex;flex-wrap:wrap;gap:12px;align-content:flex-start;overflow:auto;padding:4px}
.note{position:relative;padding:12px 14px;border-radius:4px;font-size:22px;font-weight:600;color:#222;box-shadow:2px 3px 6px rgba(0,0,0,.4);max-width:100%;animation:pop .4s}
.y .note{background:#ffe066}.b .note{background:#8ecbff}.note.hid{opacity:.35;outline:2px dashed #fff}.note.pick{outline:6px solid #fff;transform:scale(1.15) rotate(0)!important;z-index:5}
.note:nth-child(3n){transform:rotate(-2deg)}.note:nth-child(3n+1){transform:rotate(1.5deg)}.note:nth-child(3n+2){transform:rotate(-.5deg)}
.x{position:absolute;top:-8px;right:-8px;width:24px;height:24px;border-radius:50%;border:0;background:#c0392b;color:#fff;cursor:pointer;font-size:13px}
@keyframes pop{from{transform:scale(.3);opacity:0}to{opacity:1}}
</style></head><body>
<header><div class="join" id="join">…</div><div class="tools" id="tools"></div></header>
<main><section class="col y"><h2><span>What others say / Што велат другите</span><span class="cnt" id="cy"></span></h2><div class="wall" id="wy"></div></section>
<section class="col b"><h2><span>What I say / Што јас велам</span><span class="cnt" id="cb"></span></h2><div class="wall" id="wb"></div></section></main>
<script>
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
</script></body></html>`;
