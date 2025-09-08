 async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(signupForm);
    const payload = {
      fName: form.get('fName'),
      lName: form.get('lName'),
      email: form.get('email'),
      phone: form.get('phone'),
      nid: form.get('nid'),
      address: form.get('address'),
      password: form.get('password')
    };
    const { ok, data } = await postJSON('/api/signup', payload);
    const msg = document.getElementById('msg');
    msg.textContent = ok ? (data.message || 'Signup successful') : (data.message || 'Signup failed');
    if (ok) setTimeout(() => { window.location.href = '/login.html'; }, 700);
  });
}

const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData(loginForm);
    const payload = { email: form.get('email'), password: form.get('password') };
    const { ok, data } = await postJSON('/api/login', payload);
    const msg = document.getElementById('msg');
    if (!ok) { msg.textContent = data.message || 'Login failed'; return; }

    // Redirect by role
    if (data.role === 'customer') {
      window.location.href = '/dashboard.html';
    } else if (data.role === 'IT_expert') {
      window.location.href = '/it-dashboard.html';
    } else {
      msg.textContent = 'Unsupported role';
    }
  });
}
