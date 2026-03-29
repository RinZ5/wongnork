from flask import Flask, request, jsonify, render_template, send_file, redirect, session
import pickle
import numpy as np
import os
import hashlib
import requests
import sqlite3
import random
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
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

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

with open("resources/recipe_recommendation_model.pkl", "rb") as f:
    ml_data = pickle.load(f)
    lgbm_model = ml_data["model"]
    X_final = ml_data["X_final"]

df_ml = pd.read_csv("data/raw/recipes.csv")
df_ml = df_ml.dropna(subset=["AggregatedRating"]).reset_index(drop=True)

recipe_id_to_idx = pd.Series(df_ml.index, index=df_ml["RecipeId"]).to_dict()
idx_to_recipe_id = pd.Series(df_ml["RecipeId"], index=df_ml.index).to_dict()

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "fallback-secret-key-for-dev")

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
    username, password = data.get("username"), data.get("password")
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
    username, password = data.get("username"), data.get("password")

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


@app.route("/search", methods=["GET"])
def search_page():
    return render_template("search.html", query=request.args.get("q", ""))


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

    results_df = results_df.where(pd.notnull(results_df), None)
    clean_results = results_df.to_dict(orient="records")

    return jsonify(
        {
            "original_query": query,
            "has_typo": has_typo,
            "suggested_query": suggested_query if has_typo else "",
            "results": clean_results,
        }
    )


@app.route("/api/recipes/<int:recipe_id>", methods=["GET"])
def get_recipe(recipe_id):
    results_df = searcher.get_by_ids([recipe_id])
    if results_df.empty:
        return jsonify({"error": "Recipe not found"}), 404

    results_df = results_df.where(pd.notnull(results_df), None)
    recipe_data = results_df.iloc[0].to_dict()
    return jsonify({"recipe": recipe_data}), 200


@app.route("/api/folders", methods=["POST", "GET"])
@login_required
def handle_folders():
    conn = get_db_connection()

    if request.method == "POST":
        folder_name = request.get_json().get("folder_name")
        if not folder_name:
            return jsonify({"error": "Folder name is required"}), 400

        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO Folders (UserId, FolderName) VALUES (?, ?)",
            (current_user.id, folder_name),
        )
        conn.commit()
        folder_id = cursor.lastrowid
        conn.close()
        return jsonify(
            {"message": f"Folder '{folder_name}' created!", "folder_id": folder_id}
        ), 201

    else:
        folders = conn.execute(
            "SELECT FolderId, FolderName FROM Folders WHERE UserId = ?",
            (current_user.id,),
        ).fetchall()
        conn.close()
        return jsonify(
            {
                "folders": [
                    {"id": f["FolderId"], "name": f["FolderName"]} for f in folders
                ]
            }
        ), 200


@app.route("/api/folders/<int:folder_id>", methods=["DELETE"])
@login_required
def delete_folder(folder_id):
    conn = get_db_connection()
    folder = conn.execute(
        "SELECT * FROM Folders WHERE FolderId = ? AND UserId = ?",
        (folder_id, current_user.id),
    ).fetchone()
    if not folder:
        conn.close()
        return jsonify({"error": "Folder not found or access denied"}), 404

    conn.execute("DELETE FROM Folders WHERE FolderId = ?", (folder_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Folder deleted successfully"}), 200


@app.route("/api/folders/<int:folder_id>/recipes", methods=["GET"])
@login_required
def get_folder_recipes(folder_id):
    conn = get_db_connection()
    folder = conn.execute("SELECT FolderId, FolderName FROM Folders WHERE FolderId = ? AND UserId = ?",
                          (folder_id, current_user.id)).fetchone()
    if not folder:
        conn.close()
        return jsonify({"error": "Folder not found"}), 404

    bookmarks = conn.execute(
        "SELECT RecipeId, UserRating FROM Bookmarks WHERE FolderId = ?", (folder_id,)).fetchall()
    conn.close()

    recipe_ids = [b["RecipeId"] for b in bookmarks]
    if not recipe_ids:
        return jsonify({"folder_name": folder["FolderName"], "results": []}), 200

    user_ratings = {b["RecipeId"]: b["UserRating"] for b in bookmarks}

    results_df = searcher.get_by_ids(recipe_ids)
    results_df = results_df.where(pd.notnull(results_df), None)
    results = results_df.to_dict(orient="records")

    for recipe in results:
        recipe["UserRating"] = user_ratings.get(recipe["RecipeId"])

    return jsonify({"folder_name": folder["FolderName"], "results": results}), 200


@app.route("/api/folders/<int:folder_id>/bookmarks", methods=["POST", "GET"])
@login_required
def handle_bookmarks(folder_id):
    conn = get_db_connection()
    folder = conn.execute(
        "SELECT * FROM Folders WHERE FolderId = ? AND UserId = ?",
        (folder_id, current_user.id),
    ).fetchone()
    if not folder:
        conn.close()
        return jsonify({"error": "Folder not found or access denied"}), 404

    if request.method == "POST":
        data = request.get_json()
        recipe_id, user_rating = data.get("recipe_id"), data.get("rating")
        if not recipe_id or not user_rating:
            return jsonify(
                {"error": "Both recipe_id and rating (1-5) are required"}
            ), 400

        try:
            conn.execute(
                "INSERT INTO Bookmarks (FolderId, RecipeId, UserRating) VALUES (?, ?, ?)",
                (folder_id, int(recipe_id), int(user_rating)),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify(
                {"error": "Recipe is already bookmarked in this folder"}
            ), 409

        conn.close()
        return jsonify({"message": "Saved successfully!"}), 201

    else:
        bookmarks = conn.execute(
            "SELECT RecipeId, UserRating FROM Bookmarks WHERE FolderId = ? ORDER BY UserRating DESC",
            (folder_id,),
        ).fetchall()
        conn.close()
        return jsonify(
            {
                "folder_id": folder_id,
                "bookmarks": [
                    {"recipe_id": b["RecipeId"], "rating": b["UserRating"]}
                    for b in bookmarks
                ],
            }
        ), 200


@app.route("/api/recipes/<int:recipe_id>/bookmark", methods=["DELETE"])
@login_required
def remove_bookmark(recipe_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "DELETE FROM Bookmarks WHERE RecipeId = ? AND FolderId IN (SELECT FolderId FROM Folders WHERE UserId = ?)",
        (recipe_id, current_user.id),
    )
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()

    if rows_affected > 0:
        return jsonify({"message": "Bookmark removed successfully"}), 200
    return jsonify({"error": "Bookmark not found or access denied"}), 404


@app.route("/api/recipes/<int:recipe_id>/bookmark_status", methods=["GET"])
@login_required
def check_bookmark_status(recipe_id):
    conn = get_db_connection()
    bookmark = conn.execute(
        """
        SELECT b.FolderId, b.UserRating, f.FolderName 
        FROM Bookmarks b JOIN Folders f ON b.FolderId = f.FolderId
        WHERE f.UserId = ? AND b.RecipeId = ?
    """,
        (current_user.id, recipe_id),
    ).fetchone()
    conn.close()

    if bookmark:
        return jsonify(
            {
                "is_bookmarked": True,
                "folder_id": bookmark["FolderId"],
                "folder_name": bookmark["FolderName"],
                "rating": bookmark["UserRating"],
            }
        ), 200
    return jsonify({"is_bookmarked": False}), 200


@app.route("/api/recommendations/summary", methods=["GET"])
@login_required
def get_summary_recommendations():
    conn = get_db_connection()
    all_bookmarks = conn.execute(
        "SELECT RecipeId FROM Bookmarks WHERE FolderId IN (SELECT FolderId FROM Folders WHERE UserId = ?)",
        (current_user.id,),
    ).fetchall()
    conn.close()

    user_recipe_ids = [b["RecipeId"] for b in all_bookmarks]
    if not user_recipe_ids:
        return jsonify({"summary": []}), 200

    indices = [
        recipe_id_to_idx[rid] for rid in user_recipe_ids if rid in recipe_id_to_idx
    ]
    if not indices:
        return jsonify({"summary": []}), 200

    user_profile = X_final[indices].mean(axis=0)
    similarity_scores = np.asarray(X_final @ user_profile.T).flatten()
    predicted_ratings = lgbm_model.predict(X_final)

    scaler = MinMaxScaler()
    normalized_similarity = scaler.fit_transform(
        similarity_scores.reshape(-1, 1)
    ).flatten()
    normalized_ratings = scaler.fit_transform(
        predicted_ratings.reshape(-1, 1)
    ).flatten()
    final_scores = (normalized_similarity * 0.7) + (normalized_ratings * 0.3)
    final_scores[indices] = -1

    top_indices = final_scores.argsort()[::-1][:6]
    recommended_ids = [idx_to_recipe_id[idx] for idx in top_indices]

    results_df = searcher.get_by_ids(recommended_ids)
    results_df = results_df.where(pd.notnull(results_df), None)
    return jsonify({"summary": results_df.to_dict(orient="records")}), 200


@app.route("/api/recommendations/category", methods=["GET"])
@login_required
def get_category_recommendations():
    conn = get_db_connection()
    folders = conn.execute(
        "SELECT FolderId, FolderName FROM Folders WHERE UserId = ?", (
            current_user.id,)
    ).fetchall()

    category_list, category_name = [], "Your Folders"
    if folders:
        chosen_folder = random.choice(folders)
        category_name = chosen_folder["FolderName"]
        folder_bookmarks = conn.execute(
            "SELECT RecipeId FROM Bookmarks WHERE FolderId = ? LIMIT 6",
            (chosen_folder["FolderId"],),
        ).fetchall()

        cat_ids = [b["RecipeId"] for b in folder_bookmarks]
        if cat_ids:
            results_df = searcher.get_by_ids(cat_ids)
            results_df = results_df.where(pd.notnull(results_df), None)
            category_list = results_df.to_dict(orient="records")

    conn.close()
    return jsonify({"category_name": category_name, "recipes": category_list}), 200


@app.route("/api/recommendations/random", methods=["GET"])
def get_random_recommendations():
    random_ids = df_ml.sample(6)["RecipeId"].tolist()
    results_df = searcher.get_by_ids(random_ids)
    results_df = results_df.where(pd.notnull(results_df), None)
    return jsonify({"random": results_df.to_dict(orient="records")}), 200


@app.route("/api/folders/<int:folder_id>/recommendations", methods=["GET"])
@login_required
def get_folder_recommendations(folder_id):
    conn = get_db_connection()
    folder = conn.execute(
        "SELECT 1 FROM Folders WHERE FolderId=? AND UserId=?",
        (folder_id, current_user.id),
    ).fetchone()
    if not folder:
        conn.close()
        return jsonify({"error": "Unauthorized"}), 403

    bookmarks = conn.execute(
        "SELECT RecipeId FROM Bookmarks WHERE FolderId = ?", (folder_id,)
    ).fetchall()
    conn.close()

    user_recipe_ids = [b["RecipeId"] for b in bookmarks]
    if not user_recipe_ids:
        return jsonify({"recommendations": []}), 200

    indices = [
        recipe_id_to_idx[rid] for rid in user_recipe_ids if rid in recipe_id_to_idx
    ]
    if not indices:
        return jsonify({"recommendations": []}), 200

    user_profile = X_final[indices].mean(axis=0)
    similarity_scores = np.asarray(X_final @ user_profile.T).flatten()
    predicted_ratings = lgbm_model.predict(X_final)

    scaler = MinMaxScaler()
    normalized_similarity = scaler.fit_transform(
        similarity_scores.reshape(-1, 1)
    ).flatten()
    normalized_ratings = scaler.fit_transform(
        predicted_ratings.reshape(-1, 1)
    ).flatten()
    final_scores = (normalized_similarity * 0.7) + (normalized_ratings * 0.3)
    final_scores[indices] = -1

    top_indices = final_scores.argsort()[::-1][:10]
    recommended_ids = [idx_to_recipe_id[idx] for idx in top_indices]

    results_df = searcher.get_by_ids(recommended_ids)
    results_df = results_df.where(pd.notnull(results_df), None)
    return jsonify({"recommendations": results_df.to_dict(orient="records")}), 200


if __name__ == "__main__":
    app.run(debug=True, port=5001)
