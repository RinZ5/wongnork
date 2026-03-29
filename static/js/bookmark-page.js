async function loadFolders() {
    try {
        const response = await fetch('/api/folders');
        if (response.ok) {
            const data = await response.json();
            return data.folders || [];
        }
    } catch (error) {
        console.error('Error loading folders:', error);
    }
    return [];
}

async function populateFolderDropdown() {
    const folderSelect = document.getElementById('folderSelect');
    const folders = await loadFolders();

    if (folders.length === 0) {
        folderSelect.innerHTML = `
            <option value="create_new">+ Create New Folder</option>
        `;
        folderSelect.value = 'create_new';
    } else {
        let options = '<option value="">Select a folder</option>';
        folders.forEach(folder => {
            options += `<option value="${folder.id}">${folder.name}</option>`;
        });
        options += '<option value="create_new">+ Create New Folder</option>';
        folderSelect.innerHTML = options;
    }
}

function handleFolderChange() {
    const folderSelect = document.getElementById('folderSelect');
    if (folderSelect.value === 'create_new') {
        const redirectUrl = `/folders/new?redirect=/recipes/${recipeId}/bookmark`;
        window.location.href = redirectUrl;
    }
}

async function handleBookmarkSubmit(event) {
    event.preventDefault();
    
    const folderSelect = document.getElementById('folderSelect');
    const ratingSelect = document.getElementById('ratingSelect');
    const errorMessage = document.getElementById('errorMessage');
    const form = document.getElementById('bookmarkForm');
    const btnText = form.querySelector('.btn-text');
    const btnSpinner = form.querySelector('.btn-spinner');

    const folderId = folderSelect.value;
    const rating = parseInt(ratingSelect.value);

    if (!folderId || folderId === 'create_new') {
        showError('Please select a folder');
        return;
    }

    errorMessage.style.display = 'none';
    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline-block';
    form.disabled = true;

    try {
        const response = await fetch(`/api/folders/${folderId}/bookmarks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipe_id: recipeId,
                rating: rating
            })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Recipe saved successfully!');
            setTimeout(() => {
                window.location.href = `/recipes/${recipeId}`;
            }, 1000);
        } else {
            btnText.style.display = 'inline';
            btnSpinner.style.display = 'none';
            form.disabled = false;
            showError(data.error || 'Failed to save recipe');
        }
    } catch (error) {
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
        form.disabled = false;
        showError('Network error. Please try again.');
    }
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
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
    populateFolderDropdown();

    document.getElementById('folderSelect').addEventListener('change', handleFolderChange);
    document.getElementById('bookmarkForm').addEventListener('submit', handleBookmarkSubmit);
    document.getElementById('backButton').addEventListener('click', () => {
        window.location.href = `/recipes/${recipeId}`;
    });
});
