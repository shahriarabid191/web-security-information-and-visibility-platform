// role guard
(async () => {
  const r = await fetch('/api/me');
  if (!r.ok) { window.location.href = '/login.html'; return; }
  const me = await r.json();
  if (me.user.role !== 'customer') { window.location.href = '/it-dashboard.html'; }
})();

async function api(method, url, body){
  try{
    const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
    const data=await res.json().catch(()=>({}));
    return {ok:res.ok,status:res.status,data};
  }catch(e){ return {ok:false,status:0,data:{message:'Network error'}}}
}

/* top-right balance */
async function loadBalance(){
  const el = document.getElementById('navBalance');
  if (!el) return;
  const { ok, data } = await api('GET', '/api/customer/overview');
  el.textContent = ok ? `Balance: ${Number(data.account.balance).toFixed(2)}` : 'Balance: --';
}

/* sections */
function showSection(id){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('show'));
  const el=document.getElementById(id); if(el) el.classList.add('show');
  if(el) el.scrollIntoView({behavior:'smooth',block:'start'});
}

/* account info */
async function loadAccountInfo(){
  showSection('secAccount');
  const info=document.getElementById('acctInfo'); info.textContent='Loading…';
  const {ok,data}=await api('GET','/api/customer/account-info');
  if(!ok){ info.textContent=data.message||'Failed to load'; return; }
  const a=data.account,p=data.profile;
  info.innerHTML=`
    <div><strong>Name:</strong> ${p.fName} ${p.lName}</div>
    <div><strong>Email:</strong> ${p.uEmail}</div>
    <div><strong>Phone:</strong> ${p.uPhone||'-'}</div>
    <div><strong>Address:</strong> ${p.cAddress||'-'}</div>
    <div><strong>NID:</strong> ${p.cNID}</div>
    <div class="muted" style="margin-top:6px;">Account #${a.accountNo} • ${a.accountType} • Balance: ${Number(a.balance).toFixed(2)}</div>
  `;
  await loadBalance();
}

/* modal (no password field) */
const modal=document.getElementById('modal');
const modalTitle=document.getElementById('modalTitle');
const modalAmount=document.getElementById('modalAmount');
const modalMsg=document.getElementById('modalMsg');
let currentAction=null;

function openModal(action){
  currentAction=action; modalTitle.textContent= action==='deposit'?'Deposit':'Withdraw';
  modalAmount.value=''; modalMsg.textContent=''; modalMsg.className='msg';
  modal.classList.add('show'); modalAmount.focus();
}
function closeModal(){ modal.classList.remove('show'); }
document.getElementById('openDeposit').addEventListener('click',()=>openModal('deposit'));
document.getElementById('openWithdraw').addEventListener('click',()=>openModal('withdraw'));
document.getElementById('modalCancel').addEventListener('click',closeModal);
modal.addEventListener('click',(e)=>{ if(e.target===modal) closeModal(); });
document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') closeModal(); });

document.getElementById('modalConfirm').addEventListener('click', async ()=>{
  const amount=Number(modalAmount.value);
  if(!Number.isFinite(amount)||amount<=0){ modalMsg.textContent='Enter a positive amount'; modalMsg.className='msg err'; modalAmount.focus(); return; }

  const endpoint=currentAction==='deposit'?'/api/customer/deposit':'/api/customer/withdraw';
  const {ok,data}=await api('POST',endpoint,{amount});
  if(ok){
    modalMsg.textContent = `${data.message}. New balance: ${Number(data.balance).toFixed(2)}`;
    modalMsg.className='msg ok';
    await loadBalance();
    if(document.getElementById('secAccount').classList.contains('show')) await loadAccountInfo();
    setTimeout(closeModal,700);
  }else{
    modalMsg.textContent = data.message||'Request failed';
    modalMsg.className='msg err';
  }
});

/* update password only */
document.getElementById('btnToggleUpdate').addEventListener('click',()=>{
  const el=document.getElementById('updateWrap');
  el.style.display = el.style.display==='none' ? 'block' : 'none';
});
document.getElementById('btnChangePassword').addEventListener('click', async ()=>{
  const cur=document.getElementById('curPass').value;
  const npw=document.getElementById('newPass').value;
  const msg=document.getElementById('updateMsg');
  const {ok,data}=await api('PATCH','/api/customer/password',{currentPassword:cur,newPassword:npw});
  msg.textContent = ok?(data.message||'Password updated'):(data.message||'Password change failed');
  msg.className = ok?'msg ok':'msg err';
  if(ok){ document.getElementById('curPass').value=''; document.getElementById('newPass').value=''; }
});

/* top links */
document.getElementById('linkAccount').addEventListener('click',loadAccountInfo);

/* logout */
document.getElementById('logoutBtn').addEventListener('click', async ()=>{
  await fetch('/api/logout'); window.location.href='/login.html';
});

/* initial */
loadBalance();
