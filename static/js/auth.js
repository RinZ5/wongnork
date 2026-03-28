async function checkAuth() {
    try {
        const response = await fetch('/api/me');
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
    }
    return null;
}

async function handleLogin(event) {
    event.preventDefault();
    
    const form = event.target;
    const username = form.username.value;
    const password = form.password.value;
    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');
    const alertEl = document.getElementById('loginAlert');
    const successEl = document.getElementById('loginSuccess');
    
    alertEl.style.display = 'none';
    successEl.style.display = 'none';
    
    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline-block';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            successEl.textContent = 'Login successful! Redirecting...';
            successEl.style.display = 'block';
            
            setTimeout(() => {
                window.location.href = '/';
            }, 800);
        } else {
            alertEl.textContent = data.error || 'Login failed. Please try again.';
            alertEl.style.display = 'block';
        }
    } catch (error) {
        alertEl.textContent = 'Network error. Please try again.';
        alertEl.style.display = 'block';
    } finally {
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
        submitBtn.disabled = false;
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const form = event.target;
    const username = form.username.value;
    const password = form.password.value;
    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');
    const alertEl = document.getElementById('registerAlert');
    const successEl = document.getElementById('registerSuccess');
    
    alertEl.style.display = 'none';
    successEl.style.display = 'none';
    
    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline-block';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            successEl.textContent = 'Account created successfully! Redirecting to login...';
            successEl.style.display = 'block';
            
            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);
        } else {
            alertEl.textContent = data.error || 'Registration failed. Please try again.';
            alertEl.style.display = 'block';
        }
    } catch (error) {
        alertEl.textContent = 'Network error. Please try again.';
        alertEl.style.display = 'block';
    } finally {
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
        submitBtn.disabled = false;
    }
}

async function handleLogout() {
    try {
        await fetch('/api/logout', {
            method: 'POST'
        });
        window.location.href = '/';
    } catch (error) {
    }
}

function updateHeaderAuth() {
    const authButtons = document.querySelector('.auth-buttons');
    if (!authButtons) return;
    
    checkAuth().then(user => {
        if (user) {
            authButtons.innerHTML = `
                <div class="user-menu">
                    <span class="user-name">${user.username}</span>
                    <button onclick="handleLogout()" class="btn btn-secondary btn-logout">Logout</button>
                </div>
            `;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    updateHeaderAuth();
});
