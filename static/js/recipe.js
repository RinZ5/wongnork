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

    } catch (err) {
        spinner.style.display = 'none';
        errorSection.style.display = 'block';
        console.error(err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof recipeId !== 'undefined') {
        loadRecipe(recipeId);
    }
});
