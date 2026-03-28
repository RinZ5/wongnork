let isLoggedIn = false;

checkAuth().then(user => {
    isLoggedIn = !!user;
});

function handleBookmarkClick(recipeId, recipeName, event) {
    if (event) {
        event.stopPropagation();
    }

    if (!isLoggedIn) {
        showToast('Please login to save recipes', 'info');
        setTimeout(() => {
            window.location.href = '/login';
        }, 1000);
        return;
    }

    showToast('Save to folder feature coming soon!', 'info');
}

function getBookmarkIcon(isSaved = false) {
    return `
        <button class="bookmark-btn" onclick="handleBookmarkClick(this.dataset.recipeId, this.dataset.recipeName, event)" data-recipe-id="" data-recipe-name="">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
            </svg>
        </button>
    `;
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth().then(user => {
        isLoggedIn = !!user;
    });
});
