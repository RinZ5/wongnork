from flask import Flask, request, jsonify, render_template, send_file, redirect, session
import pickle
import numpy as np
import os
import hashlib
import requests
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import (
    LoginManager,
    UserMixin,
    login_user,
    logout_user,
    login_required,
    current_user,
)
from dotenv import load_dotenv

from models import (
    spell_preprocessor,
    CustomPreprocessor,
    SpellChecker,
    RecipeSearchEngine,
)

load_dotenv()

CACHE_DIR = "image_cache"
os.makedirs(CACHE_DIR, exist_ok=True)

with open("resources/recipe_search_engine.pkl", "rb") as f:
    searcher = pickle.load(f)

with open("resources/spell_checker.pkl", "rb") as f:
    spell_checker = pickle.load(f)

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY")
if not app.secret_key:
    raise ValueError("SECRET_KEY environment variable not set. Add it to .env file.")

login_manager = LoginManager()
login_manager.init_app(app)


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "You must be logged in to access this."}), 401


def get_db_connection():
    conn = sqlite3.connect("database.db")
    conn.row_factory = sqlite3.Row
    return conn


class User(UserMixin):
    def __init__(self, id, username):
        self.id = id
        self.username = username


@login_manager.user_loader
def load_user(user_id):
    conn = get_db_connection()
    user_row = conn.execute(
        "SELECT * FROM Users WHERE UserId = ?", (user_id,)
    ).fetchone()
    conn.close()

    if user_row:
        return User(id=user_row["UserId"], username=user_row["Username"])
    return None


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    hashed_pw = generate_password_hash(password)
    conn = get_db_connection()

    try:
        conn.execute(
            "INSERT INTO Users (Username, PasswordHash) VALUES (?, ?)",
            (username, hashed_pw),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Username already exists"}), 409

    conn.close()
    return jsonify({"message": "User registered successfully"}), 201


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")

    conn = get_db_connection()
    user_row = conn.execute(
        "SELECT * FROM Users WHERE Username = ?", (username,)
    ).fetchone()
    conn.close()

    if user_row and check_password_hash(user_row["PasswordHash"], password):
        user = User(id=user_row["UserId"], username=user_row["Username"])
        login_user(user)

        return jsonify({"message": "Logged in successfully", "user_id": user.id}), 200

    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/api/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"}), 200


@app.route("/api/me", methods=["GET"])
@login_required
def me():
    return jsonify({"user_id": current_user.id, "username": current_user.username}), 200


@app.route("/", methods=["GET"])
def home():
    return render_template("index.html")


@app.route("/login", methods=["GET"])
def login_page():
    return render_template("login.html")


@app.route("/register", methods=["GET"])
def register_page():
    return render_template("register.html")


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
