document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('foldersList')) {
    loadFolderGrid();

    document.getElementById('createFolderForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('newFolderName');
      const res = await fetchSafeJSON('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_name: nameInput.value })
      });
      if (res.ok) {
        nameInput.value = '';
        loadFolderGrid();
      } else {
        alert(res.data.error || 'Failed to create folder');
      }
    });
  }

  const folderIdInput = document.getElementById('currentFolderId');
  if (folderIdInput) {
    const folderId = folderIdInput.value;
    loadFolderContents(folderId);

    document.getElementById('deleteFolderBtn').addEventListener('click', async () => {
      if (confirm('Are you sure you want to delete this folder? All bookmarks inside will be lost.')) {
        const res = await fetchSafeJSON(`/api/folders/${folderId}`, { method: 'DELETE' });
        if (res.ok) window.location.href = '/folders';
      }
    });
  }
});

async function loadFolderGrid() {
  const res = await fetchSafeJSON('/api/folders');
  document.getElementById('foldersSpinner').style.display = 'none';
  const list = document.getElementById('foldersList');
  list.innerHTML = '';

  if (res.ok && res.data.folders.length > 0) {
    res.data.folders.forEach(f => {
      const card = document.createElement('a');
      card.className = 'folder-card';
      card.href = `/folders/${f.id}`;
      card.textContent = f.name;
      list.appendChild(card);
    });
  } else {
    document.getElementById('noFoldersMessage').style.display = 'block';
  }
}

async function loadFolderContents(folderId) {
  const savedRes = await fetchSafeJSON(`/api/folders/${folderId}/recipes`);
  document.getElementById('savedSpinner').style.display = 'none';
  const savedList = document.getElementById('savedList');

  if (savedRes.ok && savedRes.data.results.length > 0) {
    savedRes.data.results.forEach(recipe => {
      savedList.appendChild(createRecipeCard(recipe));
    });
  } else {
    document.getElementById('noSavedMessage').style.display = 'block';
  }

  const mlRes = await fetchSafeJSON(`/api/folders/${folderId}/recommendations`);
  document.getElementById('mlSpinner').style.display = 'none';
  const mlList = document.getElementById('mlList');

  if (mlRes.ok && mlRes.data.recommendations && mlRes.data.recommendations.length > 0) {
    mlRes.data.recommendations.forEach(recipe => {
      mlList.appendChild(createRecipeCard(recipe));
    });
  } else {
    mlList.innerHTML = '<p style="color: var(--text-muted);">Save some recipes first to get smart suggestions!</p>';
  }
}