async function handleCreateFolder(event) {
    event.preventDefault();

    const form = event.target;
    const folderName = form.folderName.value.trim();
    const errorMessage = document.getElementById('errorMessage');
    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnSpinner = submitBtn.querySelector('.btn-spinner');

    if (!folderName) {
        errorMessage.textContent = 'Please enter a folder name';
        errorMessage.style.display = 'block';
        return;
    }

    errorMessage.style.display = 'none';
    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline-block';
    submitBtn.disabled = true;

    try {
        const response = await fetch('/api/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder_name: folderName })
        });

        const data = await response.json();

        if (response.ok) {
            const urlParams = new URLSearchParams(window.location.search);
            const redirect = urlParams.get('redirect');
            window.location.href = redirect || '/folders';
        } else {
            errorMessage.textContent = data.error || 'Failed to create folder';
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        errorMessage.textContent = 'Network error. Please try again.';
        errorMessage.style.display = 'block';
    } finally {
        btnText.style.display = 'inline';
        btnSpinner.style.display = 'none';
        submitBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('createFolderForm');
    if (form) {
        form.addEventListener('submit', handleCreateFolder);
    }
});
