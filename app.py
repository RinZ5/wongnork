from flask import Flask, request, jsonify, render_template, send_file, redirect, session
import pickle
import numpy as np
import os
import hashlib
import requests
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

load_dotenv()

from models import (
    spell_preprocessor,
    CustomPreprocessor,
    SpellChecker,
    RecipeSearchEngine,
)

CACHE_DIR = "image_cache"
os.makedirs(CACHE_DIR, exist_ok=True)

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY")
if not app.secret_key:
    raise ValueError("SECRET_KEY environment variable not set. Add it to .env file.")

with open("resources/recipe_search_engine.pkl", "rb") as f:
    searcher = pickle.load(f)

with open("resources/spell_checker.pkl", "rb") as f:
    spell_checker = pickle.load(f)


@app.route("/", methods=["GET"])
def home():
    return render_template("index.html")


@app.route("/api/img-proxy", methods=["GET"])
def img_proxy():
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "No URL provided"}), 400

    url_hash = hashlib.md5(url.encode("utf-8")).hexdigest()
    file_path = os.path.join(CACHE_DIR, f"{url_hash}.jpg")

    if os.path.exists(file_path):
        return send_file(file_path, mimetype="image/jpeg")

    try:
        response = requests.get(url, stream=True, timeout=5)
        response.raise_for_status()

        with open(file_path, "wb") as f:
            for chunk in response.iter_content(1024):
                f.write(chunk)

        return send_file(file_path, mimetype="image/jpeg")
    except Exception:
        return redirect("/static/images/no-image.jpg")


@app.route("/search", methods=["GET"])
def search_page():
    query = request.args.get("q", "")
    return render_template("search.html", query=query)


@app.route("/api/search", methods=["GET"])
def search():
    query = request.args.get("q", "").lower()

    if not query:
        return jsonify(
            {
                "original_query": "",
                "has_typo": False,
                "suggested_query": "",
                "results": [],
            }
        )

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
    results_df = results_df[results_df["Score"] > 0.0]
    results = results_df.to_dict(orient="records")

    return jsonify(
        {
            "original_query": query,
            "has_typo": has_typo,
            "suggested_query": suggested_query if has_typo else "",
            "results": results,
        }
    )


if __name__ == "__main__":
    app.run(debug=True, port=5000)
