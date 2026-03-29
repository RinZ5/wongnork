async function openBookmarkModal(recipeId, recipeName) {
  document.getElementById('bmRecipeId').value = recipeId;
  document.getElementById('bmRecipeName').textContent = recipeName;
  document.getElementById('bmMessage').textContent = '';

  const folderSelect = document.getElementById('bmFolderSelect');
  folderSelect.innerHTML = '<option value="">Loading folders...</option>';
  document.getElementById('bookmarkModal').style.display = 'flex';

  const response = await fetchSafeJSON('/api/folders');

  folderSelect.innerHTML = '';
  if (!response.ok) {
    folderSelect.innerHTML = '<option value="">Please log in to save recipes.</option>';
    return;
  }

  const folders = response.data.folders || [];
  if (folders.length === 0) {
    folderSelect.innerHTML = '<option value="">No folders found. Create one first!</option>';
  } else {
    folders.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.id;
      opt.textContent = f.name;
      folderSelect.appendChild(opt);
    });
  }
}

function closeBookmarkModal() {
  document.getElementById('bookmarkModal').style.display = 'none';
}

const bookmarkForm = document.getElementById('bookmarkForm');
if (bookmarkForm) {
  bookmarkForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const recipeId = document.getElementById('bmRecipeId').value;
    const folderId = document.getElementById('bmFolderSelect').value;
    const rating = document.getElementById('bmRating').value;
    const msgDiv = document.getElementById('bmMessage');

    if (!folderId) {
      msgDiv.style.color = 'red';
      msgDiv.textContent = 'Please select a folder.';
      return;
    }

    const response = await fetchSafeJSON(`/api/folders/${folderId}/bookmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_id: recipeId, rating: rating })
    });

    if (response.ok) {
      msgDiv.style.color = 'green';
      msgDiv.textContent = 'Saved successfully!';
      setTimeout(closeBookmarkModal, 1200);
    } else {
      msgDiv.style.color = 'red';
      msgDiv.textContent = response.data.error || 'Failed to save';
    }
  });
}