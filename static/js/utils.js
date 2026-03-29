async function fetchSafeJSON(url, options = {}) {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    const cleanText = text.replace(/:\s*NaN/g, ': null');
    return { ok: res.ok, status: res.status, data: JSON.parse(cleanText) };
  } catch (err) {
    return { ok: false, data: { error: "Failed to load data" } };
  }
}

function parseArray(str) {
  if (!str || str === 'character(0)' || str === 'NaN') return [];
  try {
    const matches = [...str.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)];
    return matches.map(m => m[1].replace(/\\"/g, '"'));
  } catch (e) { return []; }
}

function getImage(imgString) {
  if (!imgString || imgString === 'character(0)') return '/static/images/no-image.jpg';
  const match = imgString.match(/"(https?:\/\/[^"]+)"/);
  return match ? `/api/img-proxy?url=${encodeURIComponent(match[1])}` : '/static/images/no-image.jpg';
}

function createRecipeCard(recipe) {
  const card = document.createElement('div');
  card.className = 'recipe-item';

  const rating = recipe.AggregatedRating ? recipe.AggregatedRating.toFixed(1) : '—';
  const safeName = recipe.Name.replace(/'/g, "\\'").replace(/"/g, '&quot;');

  card.onclick = () => openModal(recipe);

  card.innerHTML = `
        <img class="recipe-thumb" src="${getImage(recipe.Images)}" loading="lazy" alt="${safeName}">
        <div class="recipe-info">
            <div class="recipe-name">${recipe.Name}</div>
            <div class="recipe-meta">
                <span class="badge-score">⭐ ${rating}</span>
                <button class="bookmark-btn" onclick="event.stopPropagation(); openBookmarkModal(${recipe.RecipeId}, '${safeName}')">
                    ⭐ Save
                </button>
            </div>
        </div>
    `;
  return card;
}

function openModal(recipe) {
  document.getElementById('modalTitle').textContent = recipe.Name;
  document.getElementById('modalImg').src = getImage(recipe.Images);
  document.getElementById('modalIngredients').innerHTML =
    parseArray(recipe.RecipeIngredientParts).map(i => `<li>${i}</li>`).join('') || '<li>—</li>';
  document.getElementById('modalInstructions').innerHTML =
    parseArray(recipe.RecipeInstructions).map(s => `<li>${s}</li>`).join('') || '<li>—</li>';

  const modalBtn = document.getElementById('modalBookmarkBtn');
  if (modalBtn) {
    modalBtn.onclick = () => {
      closeModal();
      openBookmarkModal(recipe.RecipeId, recipe.Name);
    };
  }

  document.getElementById('recipeModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('recipeModal').style.display = 'none';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

const recipeModalElement = document.getElementById('recipeModal');
if (recipeModalElement) {
  recipeModalElement.addEventListener('click', e => {
    if (e.target.id === 'recipeModal') closeModal();
  });
}