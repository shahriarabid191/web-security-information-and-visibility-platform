async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// Analyst login -> POST /login
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(loginForm);
    const payload = { email: f.get('email'), password: f.get('password') };
    const { ok, data } = await postJSON('/login', payload);
    const msg = document.getElementById('msg');
    if (!ok) { msg.textContent = data.message || 'Login failed'; return; }
    if (data.role === 'Analyst') {
      window.location.href = '/dashboard.html';
    } else {
      msg.textContent = 'Unsupported role';
    }
  });
}

// Bank signup -> POST /api/bank/signup
const bankSignupForm = document.getElementById('bankSignupForm');
if (bankSignupForm) {
  bankSignupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(bankSignupForm);
    const payload = {
      bName: f.get('bName'),
      bLocation: f.get('bLocation'),
      bEstablishedDate: f.get('bEstablishedDate'),
      email: f.get('email'),
      phone: f.get('phone'),
      password: f.get('password')
    };
    const { ok, data } = await postJSON('/api/bank/signup', payload);
    const msg = document.getElementById('msg');
    msg.textContent = data.message || (ok ? 'Signup successful' : 'Signup failed');
    if (ok) setTimeout(() => { window.location.href = '/login.html'; }, 800);
  });
}
