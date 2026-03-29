async function loadLandingRecommendations() {
    const summarySection = document.getElementById('summarySection');
    const summaryList = document.getElementById('summaryList');
    const summarySpinner = document.getElementById('summarySpinner');
    const noSummary = document.getElementById('noSummary');
    const randomList = document.getElementById('randomList');
    const randomSpinner = document.getElementById('randomSpinner');

    const user = await checkAuth();

    if (user) {
        summarySection.style.display = 'block';
        summarySpinner.style.display = 'block';
        
        try {
            const res = await fetch('/api/recommendations/summary');
            const data = await res.json();
            
            summarySpinner.style.display = 'none';
            
            if (!data.summary || data.summary.length === 0) {
                noSummary.style.display = 'block';
            } else {
                data.summary.forEach((recipe, i) => {
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
                                <button class="bookmark-btn" onclick="handleBookmarkClick('${recipe.index}', '${recipe.Name.replace(/'/g, "\\'")}', event)" aria-label="Bookmark recipe">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    `;
                    summaryList.appendChild(item);
                });
            }
        } catch (err) {
            summarySpinner.style.display = 'none';
            console.error('Error loading summary:', err);
        }
    }

    randomSpinner.style.display = 'block';
    
    try {
        const res = await fetch('/api/recommendations/random');
        const data = await res.json();
        
        randomSpinner.style.display = 'none';
        
        if (data.random && data.random.length > 0) {
            data.random.forEach((recipe, i) => {
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
                            <button class="bookmark-btn" onclick="handleBookmarkClick('${recipe.index}', '${recipe.Name.replace(/'/g, "\\'")}', event)" aria-label="Bookmark recipe">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
                `;
                randomList.appendChild(item);
            });
        }
    } catch (err) {
        randomSpinner.style.display = 'none';
        console.error('Error loading random recipes:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadLandingRecommendations();
});
