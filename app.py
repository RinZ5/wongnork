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
    raise ValueError(
        "SECRET_KEY environment variable not set. Add it to .env file.")

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


@app.route("/folders", methods=["GET"])
@login_required
def folders_page():
    return render_template("folders.html")


@app.route("/folders/<int:folder_id>", methods=["GET"])
@login_required
def folder_view_page(folder_id):
    conn = get_db_connection()
    folder = conn.execute(
        "SELECT FolderId, FolderName FROM Folders WHERE FolderId = ? AND UserId = ?",
        (folder_id, current_user.id),
    ).fetchone()
    conn.close()

    if not folder:
        return redirect("/folders")

    return render_template(
        "folder-view.html", folder_id=folder_id, folder_name=folder["FolderName"]
    )


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


@app.route("/api/folders", methods=["POST"])
@login_required
def create_folder():
    data = request.get_json()
    folder_name = data.get("folder_name")

    if not folder_name:
        return jsonify({"error": "Folder name is required"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO Folders (UserId, FolderName) VALUES (?, ?)",
        (current_user.id, folder_name),
    )
    conn.commit()
    new_folder_id = cursor.lastrowid
    conn.close()

    return jsonify(
        {"message": f"Folder '{folder_name}' created!", "folder_id": new_folder_id}
    ), 201


@app.route("/api/folders", methods=["GET"])
@login_required
def get_folders():
    conn = get_db_connection()
    folders = conn.execute(
        "SELECT FolderId, FolderName FROM Folders WHERE UserId = ?", (
            current_user.id,)
    ).fetchall()
    conn.close()

    folder_list = [{"id": f["FolderId"], "name": f["FolderName"]}
                   for f in folders]

    return jsonify({"folders": folder_list}), 200


@app.route('/api/folders/<int:folder_id>', methods=['DELETE'])
@login_required
def delete_folder(folder_id):
    conn = get_db_connection()
    folder = conn.execute('SELECT * FROM Folders WHERE FolderId = ? AND UserId = ?',
                          (folder_id, current_user.id)).fetchone()

    if not folder:
        conn.close()
        return jsonify({"error": "Folder not found or access denied"}), 404

    conn.execute('DELETE FROM Folders WHERE FolderId = ?', (folder_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "Folder deleted successfully"}), 200


@app.route("/api/folders/<int:folder_id>/recipes", methods=["GET"])
@login_required
def get_folder_recipes(folder_id):
    conn = get_db_connection()

    folder = conn.execute(
        "SELECT FolderId, FolderName FROM Folders WHERE FolderId = ? AND UserId = ?",
        (folder_id, current_user.id),
    ).fetchone()

    if not folder:
        conn.close()
        return jsonify({"error": "Folder not found"}), 404

    bookmarks = conn.execute(
        "SELECT RecipeId FROM Bookmarks WHERE FolderId = ?", (folder_id,)
    ).fetchall()
    conn.close()

    recipe_ids = [b["RecipeId"] for b in bookmarks]

    if not recipe_ids:
        return jsonify({"folder_name": folder["FolderName"], "results": []}), 200

    results_df = searcher.get_by_ids(recipe_ids)
    results = results_df.to_dict(orient="records")

    return jsonify({"folder_name": folder["FolderName"], "results": results}), 200


if __name__ == "__main__":
    app.run(debug=True, port=5001)
