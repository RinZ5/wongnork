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

async function loadFolderRecipes(folderId) {
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('recipeList').innerHTML = '';
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('spinner').style.display = 'block';

    try {
        const res = await fetch(`/api/folders/${folderId}/recipes`);
        const data = await res.json();

        document.getElementById('spinner').style.display = 'none';
        document.getElementById('recipeCount').textContent = `${data.results.length} recipe${data.results.length !== 1 ? 's' : ''}`;

        if (!data.results || data.results.length === 0) {
            document.getElementById('noResults').style.display = 'block';
            return;
        }

        const list = document.getElementById('recipeList');
        data.results.forEach((recipe, i) => {
            const ings = parseArray(recipe.RecipeIngredientParts);
            const ingPreview = ings.slice(0, 5).join(', ') + (ings.length > 5 ? '…' : '');

            const item = document.createElement('a');
            item.className = 'recipe-item';
            item.href = `/recipes/${recipe.index}`;
            item.style.animationDelay = `${i * 40}ms`;
            item.innerHTML = `
                <img class="recipe-thumb" src="${getImage(recipe.Images)}" loading="lazy" alt="${recipe.Name}">
                <div class="recipe-info">
                    <div class="recipe-name">${recipe.Name}</div>
                    <div class="recipe-ingredients"><strong>Ingredients:</strong> ${ingPreview || '—'}</div>
                    <div class="recipe-meta">
                        ${ings.length ? `<span class="badge-ingredients">${ings.length} ingredients</span>` : ''}
                    </div>
                </div>
            `;
            list.appendChild(item);
        });

    } catch (err) {
        document.getElementById('spinner').style.display = 'none';
        document.getElementById('noResults').style.display = 'block';
        console.error(err);
    }
}

async function loadFolderRecommendations(folderId) {
    const spinner = document.getElementById('recommendationSpinner');
    const list = document.getElementById('recommendationList');
    const noResults = document.getElementById('noRecommendations');

    spinner.style.display = 'block';
    list.innerHTML = '';
    noResults.style.display = 'none';

    try {
        const res = await fetch(`/api/folders/${folderId}/recommendations`);
        const data = await res.json();

        spinner.style.display = 'none';

        if (!data.recommendations || data.recommendations.length === 0) {
            noResults.style.display = 'block';
            return;
        }

        data.recommendations.forEach((recipe, i) => {
            const ings = parseArray(recipe.RecipeIngredientParts);
            const ingPreview = ings.slice(0, 5).join(', ') + (ings.length > 5 ? '…' : '');

            const item = document.createElement('a');
            item.className = 'recipe-item';
            item.href = `/recipes/${recipe.index}`;
            item.style.animationDelay = `${i * 40}ms`;
            item.innerHTML = `
                <img class="recipe-thumb" src="${getImage(recipe.Images)}" loading="lazy" alt="${recipe.Name}">
                <div class="recipe-info">
                    <div class="recipe-name">${recipe.Name}</div>
                    <div class="recipe-ingredients"><strong>Ingredients:</strong> ${ingPreview || '—'}</div>
                    <div class="recipe-meta">
                        ${ings.length ? `<span class="badge-ingredients">${ings.length} ingredients</span>` : ''}
                    </div>
                </div>
            `;
            list.appendChild(item);
        });

    } catch (err) {
        spinner.style.display = 'none';
        noResults.style.display = 'block';
        console.error('Error loading recommendations:', err);
    }
}

async function renderFoldersList() {
    const foldersList = document.getElementById('foldersList');
    const noFolders = document.getElementById('noFolders');

    if (!foldersList) return;

    foldersList.innerHTML = '<div class="spinner"><span class="spinner-ring"></span></div>';

    const folders = await loadFolders();

    if (folders.length === 0) {
        foldersList.style.display = 'none';
        noFolders.style.display = 'block';
        return;
    }

    foldersList.style.display = 'block';
    noFolders.style.display = 'none';

    foldersList.innerHTML = folders.map(folder => `
        <div class="folder-item">
            <a href="/folders/${folder.id}" class="folder-link">
                <span class="folder-icon">📁</span>
                <span class="folder-name">${folder.name}</span>
            </a>
            <button class="folder-delete-btn" onclick="deleteFolder(${folder.id}, '${folder.name}', event)" aria-label="Delete folder">
                ✕
            </button>
        </div>
    `).join('');
}

function updateFolderDropdown() {
    const authButtons = document.querySelector('.auth-buttons');
    if (!authButtons) return;

    checkAuth().then(async user => {
        if (user) {
            const folders = await loadFolders();
            const maxFolders = folders.slice(0, 5);

            let dropdownHTML = `
                <div class="user-menu">
                    <span class="user-name">${user.username}</span>
                    <div class="dropdown">
                        <button class="dropdown-toggle" onclick="toggleFolderDropdown(event)">
                            My Folders
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>
                        <div class="dropdown-menu" id="folderDropdown" style="display: none;">
            `;

            if (folders.length === 0) {
                dropdownHTML += `
                            <div class="dropdown-empty">No folders yet</div>
                            <a href="/folders/new" class="dropdown-action">Create one</a>
                `;
            } else {
                maxFolders.forEach(folder => {
                    dropdownHTML += `
                            <a href="/folders/${folder.id}" class="dropdown-item">
                                <span class="folder-icon-small">📁</span>
                                ${folder.name}
                            </a>
                    `;
                });

                if (folders.length > 5) {
                    dropdownHTML += `
                            <a href="/folders" class="dropdown-item dropdown-view-all">View All →</a>
                    `;
                }

                dropdownHTML += `
                            <div class="dropdown-divider"></div>
                            <a href="/folders/new" class="dropdown-action">Create Folder</a>
                `;
            }

            dropdownHTML += `
                        </div>
                    </div>
                    <button onclick="handleLogout()" class="btn btn-secondary btn-logout">Logout</button>
                </div>
            `;

            authButtons.innerHTML = dropdownHTML;
        }
    });
}

function toggleFolderDropdown(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('folderDropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
}

async function deleteFolder(folderId, folderName, event) {
    if (event) {
        event.stopPropagation();
    }

    const confirmed = confirm(`Are you sure you want to delete the folder "${folderName}"?`);
    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(`/api/folders/${folderId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast(`Folder "${folderName}" deleted successfully!`);
            renderFoldersList();
        } else {
            const data = await response.json();
            showToast(data.error || 'Failed to delete folder', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateFolderDropdown();

    const createFolderBtn = document.getElementById('createFolderBtn');
    if (createFolderBtn) {
        createFolderBtn.href = '/folders/new';
    }

    if (document.getElementById('foldersList')) {
        renderFoldersList();
    }

    document.addEventListener('click', () => {
        const dropdown = document.getElementById('folderDropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    });

    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.addEventListener('click', (e) => e.stopPropagation());
    });
});
