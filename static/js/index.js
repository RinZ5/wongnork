document.addEventListener('DOMContentLoaded', () => {
  loadRecommendations();
});

async function loadRecommendations() {
  const summaryRes = await fetchSafeJSON('/api/recommendations/summary');
  const summaryList = document.getElementById('summaryList');
  document.getElementById('summarySpinner').style.display = 'none';

  if (summaryRes.ok && summaryRes.data.summary && summaryRes.data.summary.length > 0) {
    document.getElementById('summarySection').style.display = 'block';
    summaryRes.data.summary.forEach(recipe => {
      summaryList.appendChild(createRecipeCard(recipe));
    });
  } else {
    document.getElementById('summarySection').style.display = 'block';
    document.getElementById('noSummary').style.display = 'block';
  }

  const catRes = await fetchSafeJSON('/api/recommendations/category');
  const catList = document.getElementById('categoryList');
  document.getElementById('categorySpinner').style.display = 'none';

  if (catRes.ok && catRes.data.recipes && catRes.data.recipes.length > 0) {
    document.getElementById('categorySection').style.display = 'block';
    document.getElementById('categoryTitle').textContent = `Featured Folder: ${catRes.data.category_name}`;
    catRes.data.recipes.forEach(recipe => {
      catList.appendChild(createRecipeCard(recipe));
    });
  }

  const randomRes = await fetchSafeJSON('/api/recommendations/random');
  const randomList = document.getElementById('randomList');
  document.getElementById('randomSpinner').style.display = 'none';

  if (randomRes.ok && randomRes.data.random) {
    randomRes.data.random.forEach(recipe => {
      randomList.appendChild(createRecipeCard(recipe));
    });
  }
}