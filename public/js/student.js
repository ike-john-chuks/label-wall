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
