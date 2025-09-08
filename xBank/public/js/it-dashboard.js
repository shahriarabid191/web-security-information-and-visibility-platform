// Role-guard: IT only
(async () => {
  const r = await fetch('/api/me');
  if (!r.ok) { window.location.href = '/login.html'; return; }
  const { user } = await r.json();
  if (user.role !== 'IT_expert') { window.location.href = '/dashboard.html'; }
})();

async function api(method, url, body){
  try{
    const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    const data=await res.json().catch(()=>({}));
    return {ok:res.ok,status:res.status,data};
  }catch(e){ return {ok:false,status:0,data:{message:'Network error'}}}
}

function showSection(id){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('show'));
  const el=document.getElementById(id); if(el) el.classList.add('show');
}

/* ---------- EVENTS ---------- */
let eventsCache = [];
function pretty(jsonStr){ try { return JSON.stringify(JSON.parse(jsonStr||'{}'), null, 2); } catch { return jsonStr || ''; } }
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

async function loadEvents() {
  showSection('secEvents');
  const body=document.getElementById('eventsBody');
  body.innerHTML = `<tr><td colspan="7" class="muted">Loading…</td></tr>`;

  const {ok,data}=await api('GET','/api/it/events?limit=100');
  if(!ok){ body.innerHTML=`<tr><td colspan="7" class="msg err">Failed to load events</td></tr>`; return; }

  eventsCache = data.events || [];
  if(!eventsCache.length){ body.innerHTML=`<tr><td colspan="7" class="muted">No events</td></tr>`; return; }

  body.innerHTML = eventsCache.map((ev, i) => {
    let typeField = '-';
    try { typeField = JSON.parse(ev.eventData || '{}').type || '-'; } catch{}
    const when = ev.uActionTime ? new Date(ev.uActionTime).toLocaleString() : '-';
    return `
      <tr>
        <td>${ev.eventID}</td>
        <td>${when}</td>
        <td>${typeField}</td>
        <td>${ev.cID ?? '-'}</td>
        <td>${ev.uID ?? '-'}</td>
        <td>${ev.txnID ?? '-'}</td>
        <td><button class="btn small view-btn" data-idx="${i}">View</button></td>
      </tr>
    `;
  }).join('');

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-idx'));
      openEventModal(eventsCache[idx]);
    });
  });
}

/* Modal controls */
const modal = document.getElementById('eventModal');
const evTitle = document.getElementById('evTitle');
const evMeta = document.getElementById('evMeta');
const evJson = document.getElementById('evJson');

function openEventModal(ev){
  const obj = (() => { try { return JSON.parse(ev.eventData || '{}'); } catch { return {}; } })();
  const when = ev.uActionTime ? new Date(ev.uActionTime).toLocaleString() : '-';
  evTitle.textContent = `Event #${ev.eventID} — ${obj.type || '-'}`;
  evMeta.innerHTML = `
    <span class="chip">When: ${when}</span>
    <span class="chip">cID: ${ev.cID ?? '-'}</span>
    <span class="chip">uID: ${ev.uID ?? '-'}</span>
    <span class="chip">txnID: ${ev.txnID ?? '-'}</span>
  `;
  evJson.innerHTML = escapeHtml(pretty(ev.eventData));
  modal.classList.add('show');
}
function closeEventModal(){ modal.classList.remove('show'); }
document.getElementById('btnCloseEv').addEventListener('click', closeEventModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeEventModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeEventModal(); });

document.getElementById('btnReload').addEventListener('click', loadEvents);
document.getElementById('linkEvents').addEventListener('click', loadEvents);

/* ---------- LOCK / UNLOCK BY cID ---------- */
document.getElementById('linkLock').addEventListener('click', () => showSection('secLock'));
document.getElementById('btnFind').addEventListener('click', findCustomerByCID);
document.getElementById('btnLock').addEventListener('click', lockByCID);
document.getElementById('btnUnlock').addEventListener('click', unlockByCID);

async function findCustomerByCID(){
  const cID = Number(document.getElementById('inputCID').value);
  const out = document.getElementById('custInfo');
  const box = document.getElementById('lockBox');
  const msg = document.getElementById('lockMsg');
  out.textContent='Searching...'; box.style.display='none'; msg.textContent='';

  const {ok,data}=await api('GET','/api/it/customer-by-id?cID='+encodeURIComponent(cID));
  if(!ok){ out.textContent = data.message || 'Lookup failed'; return; }

  const c = data.customer; // { cID, cAccStatus, cRiskScore }
  out.innerHTML = `
    <div><strong>cID:</strong> ${c.cID}</div>
    <div><strong>Status:</strong> ${c.cAccStatus}</div>
    <div><strong>Risk:</strong> ${c.cRiskScore}</div>
  `;
  box.style.display = 'block';

  const isLocked = String(c.cAccStatus).toLowerCase() === 'locked';
  document.getElementById('btnLock').disabled = isLocked;
  document.getElementById('btnUnlock').disabled = !isLocked;
}

async function lockByCID(){
  const cID = Number(document.getElementById('inputCID').value);
  const reason = document.getElementById('lockReason').value.trim();
  const msg = document.getElementById('lockMsg');

  const {ok,data}=await api('POST','/api/it/lock',{ cID, reason });
  msg.textContent = ok ? (data.message || 'Locked') : (data.message || 'Failed to lock');
  msg.className = ok ? 'msg ok' : 'msg err';
  if(ok){ await findCustomerByCID(); }
}

async function unlockByCID(){
  const cID = Number(document.getElementById('inputCID').value);
  const msg = document.getElementById('lockMsg');

  const {ok,data}=await api('POST','/api/it/unlock',{ cID });
  msg.textContent = ok ? (data.message || 'Unlocked') : (data.message || 'Failed to unlock');
  msg.className = ok ? 'msg ok' : 'msg err';
  if(ok){ await findCustomerByCID(); }
}

/* ---------- Logout ---------- */
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout'); window.location.href = '/login.html';
});

/* initial */
loadEvents();
