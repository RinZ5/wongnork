async function executeSearch(query) {
  if (!query.trim()) return;

  document.getElementById('resultsSection').style.display = 'block';
  document.getElementById('queryLabel').textContent = `"${query}"`;
  const list = document.getElementById('recipeList');
  list.innerHTML = '';

  document.getElementById('noResults').style.display = 'none';
  document.getElementById('typoAlert').style.display = 'none';
  document.getElementById('spinner').style.display = 'block';

  const response = await fetchSafeJSON(`/api/search?q=${encodeURIComponent(query)}`);
  document.getElementById('spinner').style.display = 'none';

  if (!response.ok) {
    document.getElementById('noResults').style.display = 'block';
    return;
  }

  const data = response.data;

  if (data.has_typo) {
    const alert = document.getElementById('typoAlert');
    const link = document.getElementById('suggestedLink');
    link.textContent = data.suggested_query;
    link.onclick = (e) => { e.preventDefault(); executeSearch(data.suggested_query); };
    alert.style.display = 'block';
  }

  if (!data.results || data.results.length === 0) {
    document.getElementById('noResults').style.display = 'block';
    document.getElementById('resultsCount').textContent = '0 results';
    return;
  }

  document.getElementById('resultsCount').textContent = `${data.results.length} result(s)`;

  data.results.forEach((recipe) => {
    list.appendChild(createRecipeCard(recipe));
  });
}