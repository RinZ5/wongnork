document.addEventListener('DOMContentLoaded', async () => {
  const meRes = await fetchSafeJSON('/api/me');
  if (meRes.ok) {
    document.querySelectorAll('a[href="/login"], a[href="/register"]').forEach(el => el.style.display = 'none');
    document.getElementById('navFoldersBtn').style.display = 'inline-block';
    document.getElementById('navLogoutBtn').style.display = 'inline-block';
  }

  const logoutBtn = document.getElementById('navLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/';
    });
  }

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('loginMessage');
      msg.textContent = 'Logging in...';
      msg.style.color = 'var(--text-dark)';

      const payload = {
        username: document.getElementById('loginUsername').value,
        password: document.getElementById('loginPassword').value
      };

      const res = await fetchSafeJSON('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        window.location.href = '/folders';
      } else {
        msg.style.color = 'red';
        msg.textContent = res.data.error || 'Login failed';
      }
    });
  }

  const regForm = document.getElementById('registerForm');
  if (regForm) {
    regForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('regMessage');
      msg.textContent = 'Creating account...';
      msg.style.color = 'var(--text-dark)';

      const payload = {
        username: document.getElementById('regUsername').value,
        password: document.getElementById('regPassword').value
      };

      const res = await fetchSafeJSON('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        msg.style.color = 'green';
        msg.textContent = 'Success! Redirecting to login...';
        setTimeout(() => window.location.href = '/login', 1500);
      } else {
        msg.style.color = 'red';
        msg.textContent = res.data.error || 'Registration failed';
      }
    });
  }
});