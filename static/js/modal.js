function openModal(recipe) {
    document.getElementById('modalTitle').textContent = recipe.Name;
    document.getElementById('modalImg').src = getImage(recipe.Images);
    document.getElementById('modalIngredients').innerHTML =
        parseArray(recipe.RecipeIngredientParts).map(i => `<li>${i}</li>`).join('') || '<li>—</li>';
    document.getElementById('modalInstructions').innerHTML =
        parseArray(recipe.RecipeInstructions).map(s => `<li>${s}</li>`).join('') || '<li>—</li>';
    document.getElementById('recipeModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('recipeModal').style.display = 'none';
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
});

document.getElementById('recipeModal').addEventListener('click', e => {
    if (e.target.id === 'recipeModal') closeModal();
});
