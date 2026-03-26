async function executeSearch(query) {
    if (!query.trim()) return;

    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('headerSearchInput').value = query;
    document.getElementById('queryLabel').textContent = `"${query}"`;
    document.getElementById('recipeList').innerHTML = '';
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('typoAlert').style.display = 'none';
    document.getElementById('spinner').style.display = 'block';

    try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();

        document.getElementById('spinner').style.display = 'none';

        if (data.has_typo) {
            const alert = document.getElementById('typoAlert');
            const link = document.getElementById('suggestedLink');
            link.textContent = data.suggested_query;
            link.onclick = (e) => { e.preventDefault(); executeSearch(data.suggested_query); };
            alert.style.display = 'block';
        }

        const list = document.getElementById('recipeList');

        if (!data.results || data.results.length === 0) {
            document.getElementById('noResults').style.display = 'block';
            document.getElementById('resultsCount').textContent = '0 results';
            return;
        }

        document.getElementById('resultsCount').textContent = `${data.results.length} result${data.results.length !== 1 ? 's' : ''}`;

        data.results.forEach((recipe, i) => {
            const ings = parseArray(recipe.RecipeIngredientParts);
            const ingPreview = ings.slice(0, 5).join(', ') + (ings.length > 5 ? '…' : '');

            const item = document.createElement('div');
            item.className = 'recipe-item';
            item.style.animationDelay = `${i * 40}ms`;
            item.onclick = () => openModal(recipe);
            item.innerHTML = `
                <img class="recipe-thumb" src="${getImage(recipe.Images)}" loading="lazy" alt="${recipe.Name}">
                <div class="recipe-info">
                    <div class="recipe-name">${recipe.Name}</div>
                    <div class="recipe-ingredients"><strong>Ingredients:</strong> ${ingPreview || '—'}</div>
                    <div class="recipe-meta">
                        <span class="badge-score">⭐ ${recipe.Score.toFixed(2)}</span>
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

document.getElementById('headerSearchForm').addEventListener('submit', e => {
    e.preventDefault();
    executeSearch(document.getElementById('headerSearchInput').value);
});
