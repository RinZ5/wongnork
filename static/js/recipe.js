async function checkBookmarkStatus(recipeId) {
    try {
        const res = await fetch(`/api/recipes/${recipeId}/bookmark_status`);
        const data = await res.json();

        if (res.ok && data.is_bookmarked) {
            const bookmarkButton = document.getElementById('bookmarkButton');
            const bookmarkStatus = document.getElementById('bookmarkStatus');

            bookmarkButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
            `;
            bookmarkButton.classList.add('bookmarked');

            const ratingText = data.rating > 0 ? ` ⭐ ${data.rating}` : '';
            bookmarkStatus.textContent = `Saved to ${data.folder_name}${ratingText}`;
            bookmarkStatus.style.display = 'block';
        }
    } catch (err) {
        console.error('Error checking bookmark status:', err);
    }
}

async function loadRecipe(recipeId) {
    const spinner = document.getElementById('spinner');
    const errorSection = document.getElementById('errorSection');
    const recipeContent = document.getElementById('recipeContent');

    try {
        const res = await fetch(`/api/recipes/${recipeId}`);
        const data = await res.json();

        spinner.style.display = 'none';

        if (!res.ok || !data.recipe) {
            errorSection.style.display = 'block';
            return;
        }

        const recipe = data.recipe;

        document.getElementById('recipeImage').src = getImage(recipe.Images);
        document.getElementById('recipeImage').alt = recipe.Name;
        document.getElementById('recipeTitle').textContent = recipe.Name;

        const ingredientsList = document.getElementById('ingredientsList');
        const ingredients = parseArray(recipe.RecipeIngredientParts);
        ingredientsList.innerHTML = ingredients.length > 0
            ? ingredients.map(i => `<li>${i}</li>`).join('')
            : '<li>—</li>';

        const instructionsList = document.getElementById('instructionsList');
        const instructions = parseArray(recipe.RecipeInstructions);
        instructionsList.innerHTML = instructions.length > 0
            ? instructions.map(s => `<li>${s}</li>`).join('')
            : '<li>—</li>';

        recipeContent.style.display = 'block';

        await checkBookmarkStatus(recipeId);

    } catch (err) {
        spinner.style.display = 'none';
        errorSection.style.display = 'block';
        console.error(err);
    }
}

async function removeBookmark() {
    const bookmarkButton = document.getElementById('bookmarkButton');
    const bookmarkStatus = document.getElementById('bookmarkStatus');

    bookmarkButton.disabled = true;

    try {
        const response = await fetch(`/api/recipes/${recipeId}/bookmark`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            bookmarkButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
            `;
            bookmarkButton.classList.remove('bookmarked');
            bookmarkStatus.style.display = 'none';
            showToast('Recipe removed from bookmarks');
        } else {
            showToast(data.error || 'Failed to remove bookmark', 'error');
        }
    } catch (error) {
        showToast('Network error. Please try again.', 'error');
    } finally {
        bookmarkButton.disabled = false;
    }
}

function handleBookmarkClick() {
    const bookmarkButton = document.getElementById('bookmarkButton');
    const isBookmarked = bookmarkButton.classList.contains('bookmarked');

    if (isBookmarked) {
        if (confirm('Remove this recipe from your saved recipes?')) {
            removeBookmark();
        }
    } else {
        window.location.href = `/recipes/${recipeId}/bookmark`;
    }
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
    if (typeof recipeId !== 'undefined') {
        loadRecipe(recipeId);
    }
});
