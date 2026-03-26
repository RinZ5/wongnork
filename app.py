from flask import Flask, request, jsonify
import pickle
import numpy as np

from models import spell_preprocessor, CustomPreprocessor, SpellChecker, RecipeSearchEngine

app = Flask(__name__)

with open('resources/recipe_search_engine.pkl', 'rb') as f:
    searcher = pickle.load(f)

with open('resources/spell_checker.pkl', 'rb') as f:
    spell_checker = pickle.load(f)


@app.route('/search', methods=['GET'])
def search():
    query = request.args.get('q', '').lower()
    query_words = query.split()

    corrected_words = []
    has_typo = False

    for word in query_words:
        corrected = spell_checker.correction(word)
        if corrected != word:
            has_typo = True
        corrected_words.append(corrected)

    suggested_query = " ".join(corrected_words)

    results_df = searcher.search(query)
    results = results_df.to_dict(orient='records')

    return jsonify({
        "original_query": query,
        "has_typo": has_typo,
        "suggested_query": suggested_query if has_typo else "",
        "results": results
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)
