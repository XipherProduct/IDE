// Self-contained admin console for the Xipher IDE backend. Token-gated
// (ADMIN_TOKEN). Zero external deps — one HTML string. Manages users/plans,
// models, device approvals, and the Web Code platform (live executors, sessions,
// memory). Served at /ide-api/admin.

export function adminPageHtml() {
	return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Xipher IDE · Admin</title>
<style>
:root{color-scheme:dark;--bg:#06080c;--bg2:#0a0d13;--panel:#0e131b;--panel2:#131a24;--line:#1b2330;--line2:#28323f;--ink:#ece5d3;--ink2:#a8a193;--mute:#6f6a5e;--ice:#38c6e6;--ice2:#2aa5d8;--aur:#3fb950;--warn:#d8a132;--red:#f85149;--mag:#c678dd}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:radial-gradient(1200px 600px at 80% -10%,#0d1826 0,var(--bg) 60%);color:var(--ink);font:14px/1.5 'Onest',system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
a{color:var(--ice)}
.mono{font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace}
#gate{min-height:100vh;display:grid;place-items:center}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px}
.gatebox{width:min(92vw,400px);padding:28px}
.gatebox h1{font-size:18px;margin:0 0 4px}.gatebox p{color:var(--mute);font-size:13px;margin:0 0 18px}
input,select{width:100%;padding:10px 12px;background:var(--bg2);border:1px solid var(--line);border-radius:9px;color:var(--ink);font:13px 'Onest',system-ui;outline:none}
input:focus,select:focus{border-color:var(--ice2)}
select{cursor:pointer;width:auto;min-width:120px}
button{border:0;border-radius:9px;background:var(--ice);color:#04121a;font-weight:600;font-size:13px;padding:10px 14px;cursor:pointer}
button.ghost{background:var(--panel2);color:var(--ink)}
button.danger{background:transparent;color:var(--red);border:1px solid transparent;padding:5px 9px}
button.danger:hover{border-color:var(--red);background:color-mix(in oklab,var(--red) 12%,transparent)}
button:disabled{opacity:.5;cursor:default}
.err{color:var(--red);font-size:13px;min-height:18px;margin-top:10px}
#app{max-width:1180px;margin:0 auto;padding:22px 22px 60px}
.top{display:flex;align-items:center;gap:14px;margin-bottom:20px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:9px;font-weight:700;font-size:16px}
.brand svg{width:24px;height:24px}
.spacer{flex:1}
.pill{font-size:12px;color:var(--mute);border:1px solid var(--line);border-radius:20px;padding:4px 11px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
.stat{padding:16px 18px}.stat .v{font-size:26px;font-weight:700;background:linear-gradient(180deg,var(--ice),var(--ice2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.stat .k{color:var(--mute);font-size:12px;margin-top:3px}
.tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin-bottom:18px;overflow-x:auto}
.tab{background:none;color:var(--ink2);border:0;border-bottom:2px solid transparent;border-radius:0;padding:10px 14px;font-weight:500;white-space:nowrap}
.tab.active{color:var(--ink);border-bottom-color:var(--ice)}
.tab .n{color:var(--mute);font-size:11px;margin-left:5px}
.panel{padding:2px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;color:var(--mute);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:8px 10px;border-bottom:1px solid var(--line)}
td{padding:10px;border-bottom:1px solid var(--line);vertical-align:middle}
tr:hover td{background:rgba(255,255,255,.02)}
.tag{display:inline-block;font-size:11px;padding:2px 8px;border-radius:20px;background:var(--panel2);color:var(--ink2);border:1px solid var(--line)}
.tag.ice{color:var(--ice);border-color:color-mix(in oklab,var(--ice) 40%,var(--line))}
.tag.aur{color:var(--aur);border-color:color-mix(in oklab,var(--aur) 40%,var(--line))}
.tag.warn{color:var(--warn)}.tag.mag{color:var(--mag)}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:6px;vertical-align:middle}
.dot.on{background:var(--aur);box-shadow:0 0 6px var(--aur)}.dot.off{background:var(--mute)}
.bar{height:5px;border-radius:3px;background:var(--line);overflow:hidden;min-width:70px;margin-top:3px}
.bar>i{display:block;height:100%;background:var(--ice)}
.bar.warn>i{background:var(--warn)}.bar.full>i{background:var(--red)}
.muted{color:var(--mute)}.small{font-size:12px}
.empty{color:var(--mute);text-align:center;padding:30px;font-size:13px}
.tblwrap{overflow-x:auto}
</style></head><body>
<div id="gate"><div class="card gatebox">
<h1>Xipher IDE · Admin</h1><p>Введите admin-токен сервера.</p>
<input id="tok" type="password" placeholder="ADMIN_TOKEN" class="mono" autocomplete="off">
<button id="go" style="width:100%;margin-top:14px">Войти</button>
<div class="err" id="gerr"></div>
</div></div>

<div id="app" hidden>
<div class="top">
<span class="brand"><svg viewBox="0 0 26 26" fill="none"><path d="M13 1 L25 13 L13 25 L1 13 Z" stroke="#38c6e6" stroke-width="1.2" stroke-opacity=".4"/><path d="M13 7 L19 13 L13 19 L7 13 Z" fill="#38c6e6"/></svg> Xipher IDE Admin</span>
<span class="pill" id="clock"></span>
<div class="spacer"></div>
<button class="ghost" id="refresh">↻ Обновить</button>
<button class="ghost" id="logout">Выйти</button>
</div>
<div class="stats" id="stats"></div>
<div class="tabs" id="tabs"></div>
<div class="panel" id="view"></div>
</div>

<script>
const $=s=>document.querySelector(s);
const base=location.pathname.replace(/\\/admin\\/?$/,'');
let TOK=sessionStorage.getItem('xip_admin')||'';
let DATA=null, TAB='overview';
// Fetch with an abort timeout so a slow/flaky network can never leave the UI
// stuck (the RU→prod path is intermittently slow).
async function apiOnce(path,opts={},timeoutMs=11000){
  const ac=new AbortController();const t=setTimeout(()=>ac.abort(),timeoutMs);
  let r;
  try{r=await fetch(base+path,{...opts,signal:ac.signal,cache:'no-store',headers:{'Authorization':'Bearer '+TOK,'Content-Type':'application/json',...(opts.headers||{})}});}
  catch(e){clearTimeout(t);const err=new Error(ac.signal.aborted?'timeout':'network');err.code=ac.signal.aborted?'timeout':'network';throw err;}
  clearTimeout(t);
  if(!r.ok){const err=new Error('HTTP '+r.status);err.status=r.status;throw err;}
  return r.json();
}
// Auth failures (401/403) fail fast; timeouts/network errors auto-retry a few times.
async function api(path,opts={},onStatus){
  let last;
  for(let i=0;i<3;i++){
    try{return await apiOnce(path,opts);}
    catch(e){last=e;if(e.status===401||e.status===403){throw e;}if(onStatus){onStatus('Медленно… повтор '+(i+2)+'/3');}await new Promise(r=>setTimeout(r,700*(i+1)));}
  }
  throw last;
}
function errMsg(e){if(e&&e.code==='timeout')return 'Сервер не ответил (сеть). Нажмите «Войти» ещё раз.';if(e&&e.code==='network')return 'Нет связи с сервером';if(e&&(e.status===401||e.status===403))return 'Неверный токен';return 'Ошибка: '+(e&&e.message||e);}
function esc(s){return String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function ago(ts){if(!ts)return '—';const s=(Date.now()-ts)/1000;if(s<60)return 'только что';if(s<3600)return Math.floor(s/60)+' мин';if(s<86400)return Math.floor(s/3600)+' ч';return Math.floor(s/86400)+' дн';}
function barCls(u,l){const p=l?u/l:0;return p>=1?'bar full':p>=.8?'bar warn':'bar';}
function pct(u,l){return l?Math.min(100,Math.round(100*u/l)):0;}
function kindLabel(k){return ({echo:'веб',none:'веб',local:'ПК',ssh:'SSH',ide:'IDE'})[k]||k||'веб';}
function kindCls(k){return ({ide:'ice',local:'aur',ssh:'warn',echo:'',none:''})[k]||'';}

const TABS=[
  ['overview','Обзор',()=>''],
  ['users','Пользователи',d=>d.users.length],
  ['models','Модели',d=>d.models.length],
  ['executors','Исполнители',d=>d.executors.length],
  ['sessions','Сессии',d=>d.sessions.totalSessions],
  ['devices','Устройства',d=>d.pending.length],
];

function renderStats(d){
  const s=d.stats;
  $('#stats').innerHTML=[
    ['Пользователи',s.users],['Модели',s.models],
    ['Исполнители онлайн',s.executorsOnline+' / '+s.executorsTotal],
    ['Сессии Code',s.sessions],['Фактов в памяти',d.memory.totalFacts],
  ].map(([k,v])=>'<div class="card stat"><div class="v">'+esc(v)+'</div><div class="k">'+k+'</div></div>').join('');
}
function renderTabs(d){
  $('#tabs').innerHTML=TABS.map(([id,label,n])=>{const c=n(d);return '<button class="tab'+(id===TAB?' active':'')+'" data-t="'+id+'">'+label+(c!==''?'<span class="n">'+c+'</span>':'')+'</button>';}).join('');
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{TAB=b.dataset.t;renderTabs(DATA);renderView(DATA);});
}
function tbl(cols,rows){return '<div class="card tblwrap" style="padding:6px 8px"><table><thead><tr>'+cols.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.join(''):'<tr><td colspan="'+cols.length+'"><div class="empty">Пусто</div></td></tr>')+'</tbody></table></div>';}
function sesRow(s,withMode){return '<tr><td>'+esc(s.title)+'</td><td class="mono small muted">'+esc(s.userId)+'</td><td><span class="tag '+kindCls(s.workspace&&s.workspace.kind)+'">'+kindLabel(s.workspace&&s.workspace.kind)+'</span></td><td class="small muted">'+esc(s.model||'—')+'</td>'+(withMode?'<td class="small muted">'+esc(s.agentMode||'agent')+'</td>':'')+'<td class="muted">'+s.messages+'</td><td class="muted small">'+ago(s.updatedAt)+'</td></tr>';}

function renderView(d){
  const v=$('#view');
  if(TAB==='overview'){
    const on=d.executors.filter(e=>e.status==='online');
    v.innerHTML='<div style="display:grid;gap:16px">'
      +'<div><div class="muted small" style="margin:0 0 8px">Онлайн-исполнители (демоны ПК / SSH / открытые IDE)</div>'
      +tbl(['','Имя','Тип','Пользователь','Проект'],on.map(e=>'<tr><td><span class="dot on"></span></td><td>'+esc(e.name)+'</td><td><span class="tag '+kindCls(e.kind)+'">'+kindLabel(e.kind)+'</span></td><td class="mono small muted">'+esc(e.userId)+'</td><td class="mono small muted">'+esc(e.root||'—')+'</td></tr>'))
      +'</div>'
      +'<div><div class="muted small" style="margin:0 0 8px">Недавние сессии Code</div>'
      +tbl(['Название','Пользователь','Воркспейс','Модель','Сообщ.','Обновлено'],d.sessions.recent.map(s=>sesRow(s,false)))
      +'</div></div>';
  } else if(TAB==='users'){
    v.innerHTML=tbl(['ID','Имя','План','5ч','Неделя','Сессий'],d.users.map(u=>{
      const us=u.usage||{};const plans=d.plans.map(p=>'<option value="'+p.id+'"'+(p.id===u.plan?' selected':'')+'>'+esc(p.label)+'</option>').join('');
      return '<tr><td class="mono small">'+esc(u.id)+'</td><td>'+esc(u.name)+'</td>'
        +'<td><select data-plan="'+esc(u.id)+'">'+plans+'</select></td>'
        +'<td class="small">'+(us.credits5h_used??0)+'/'+(us.credits5h_limit??0)+'<div class="'+barCls(us.credits5h_used,us.credits5h_limit)+'"><i style="width:'+pct(us.credits5h_used,us.credits5h_limit)+'%"></i></div></td>'
        +'<td class="small">'+(us.creditsWeek_used??0)+'/'+(us.creditsWeek_limit??0)+'<div class="'+barCls(us.creditsWeek_used,us.creditsWeek_limit)+'"><i style="width:'+pct(us.creditsWeek_used,us.creditsWeek_limit)+'%"></i></div></td>'
        +'<td class="muted">'+(u.sessions??0)+'</td></tr>';
    }));
    v.querySelectorAll('select[data-plan]').forEach(sel=>sel.onchange=async()=>{sel.disabled=true;try{await api('/api/admin/user-plan',{method:'POST',body:JSON.stringify({userId:sel.dataset.plan,plan:sel.value})});}catch(e){}sel.disabled=false;load();});
  } else if(TAB==='models'){
    v.innerHTML=tbl(['ID','Название','Провайдер','Контекст','×кредит','Мин. тариф','Reasoning'],d.models.map(m=>'<tr><td class="mono small">'+esc(m.id)+'</td><td>'+esc(m.label)+'</td><td><span class="tag">'+esc(m.provider)+'</span></td><td class="muted small">'+((m.ctx/1000|0)||'?')+'K</td><td>'+m.mult+'×</td><td><span class="tag '+(m.minTier==='free'?'aur':'ice')+'">'+esc(m.minTier)+'</span></td><td>'+(m.reasoning?'<span class="tag mag">think</span>':'<span class="muted">—</span>')+'</td></tr>'));
  } else if(TAB==='executors'){
    v.innerHTML=tbl(['','Имя','Тип','Пользователь','ОС','Проект','Активность',''],d.executors.map(e=>'<tr>'
      +'<td><span class="dot '+(e.status==='online'?'on':'off')+'"></span></td><td>'+esc(e.name)+'</td>'
      +'<td><span class="tag '+kindCls(e.kind)+'">'+kindLabel(e.kind)+'</span></td>'
      +'<td class="mono small muted">'+esc(e.userId)+'</td><td class="small muted">'+esc(e.os||'—')+'</td>'
      +'<td class="mono small muted" style="max-width:220px;overflow:hidden;text-overflow:ellipsis">'+esc(e.root||'—')+'</td>'
      +'<td class="muted small">'+ago(e.lastSeen)+'</td>'
      +'<td><button class="danger" data-rev="'+esc(e.id)+'">Отвязать</button></td></tr>'));
    v.querySelectorAll('button[data-rev]').forEach(b=>b.onclick=async()=>{if(!confirm('Отвязать исполнитель?'))return;b.disabled=true;try{await api('/api/admin/executor-revoke',{method:'POST',body:JSON.stringify({executorId:b.dataset.rev})});}catch(e){}load();});
  } else if(TAB==='sessions'){
    v.innerHTML=tbl(['Название','Пользователь','Воркспейс','Модель','Режим','Сообщ.','Обновлено'],d.sessions.recent.map(s=>sesRow(s,true)));
  } else if(TAB==='devices'){
    v.innerHTML='<div style="max-width:560px">'+(d.pending.length?d.pending.map(p=>'<div class="card" style="padding:14px;margin-bottom:10px;display:flex;align-items:center;gap:12px"><b class="mono" style="font-size:18px;letter-spacing:2px">'+esc(p.user_code)+'</b><input placeholder="userId (или owner)" data-code="'+esc(p.user_code)+'" style="flex:1;width:auto"><button data-approve="'+esc(p.user_code)+'">Одобрить</button></div>').join(''):'<div class="empty">Нет ожидающих устройств</div>')+'</div>';
    v.querySelectorAll('button[data-approve]').forEach(b=>b.onclick=async()=>{const inp=v.querySelector('input[data-code="'+b.dataset.approve+'"]');b.disabled=true;try{const r=await api('/api/admin/approve',{method:'POST',body:JSON.stringify({user_code:b.dataset.approve,userId:(inp.value.trim()||'owner')})});b.textContent=r.ok?'✓':'ошибка';if(r.ok)setTimeout(load,600);else b.disabled=false;}catch(e){b.textContent='ошибка';b.disabled=false;}});
  }
}

async function load(){
  try{DATA=await api('/api/admin/overview');renderStats(DATA);renderTabs(DATA);renderView(DATA);}
  catch(e){logout(errMsg(e));}
}
function show(){$('#gate').hidden=true;$('#app').hidden=false;load();}
function logout(msg){TOK='';sessionStorage.removeItem('xip_admin');$('#app').hidden=true;$('#gate').hidden=false;if(msg)$('#gerr').textContent=msg;}
$('#go').onclick=()=>{const t=$('#tok').value.trim();if(!t){$('#gerr').textContent='Введите токен';return;}TOK=t;sessionStorage.setItem('xip_admin',t);$('#gerr').textContent='Проверяю…';$('#go').disabled=true;api('/api/admin/overview',{},m=>{$('#gerr').textContent=m;}).then(()=>{$('#gerr').textContent='';$('#go').disabled=false;show();}).catch(e=>{$('#go').disabled=false;logout(errMsg(e));});};
$('#tok').addEventListener('keydown',e=>{if(e.key==='Enter')$('#go').click();});
$('#refresh').onclick=load;$('#logout').onclick=()=>logout();
setInterval(()=>{const c=$('#clock');if(c)c.textContent=new Date().toLocaleTimeString('ru-RU');},1000);
if(TOK){show();}else{setTimeout(()=>{try{$('#tok').focus();}catch(e){}},50);}
</script></body></html>`;
}
