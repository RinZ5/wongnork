import numpy as np
import re
import unicodedata


def spell_preprocessor(s):
    s = str(s).lower()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("utf-8")
    s = re.sub(r"[^a-z\s]", " ", s)
    return s


class CustomPreprocessor:
    def __init__(self, stop_dict, stem_cache):
        self.stop_dict = stop_dict
        self.stem_cache = stem_cache

    def __call__(self, s):
        s = str(s).lower()
        s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("utf-8")
        s = re.sub(r"[^a-z\s]", " ", s)
        tokens = s.split()
        tokens = [w for w in tokens if w not in self.stop_dict and len(w) > 2]
        tokens = [self.stem_cache.get(w, w) for w in tokens]
        return " ".join(tokens)


class SpellChecker:
    def __init__(self, word_freqs):
        self.WORDS = word_freqs
        self.N = sum(word_freqs.values())

    def P(self, word):
        return self.WORDS.get(word, 0) / self.N

    def correction(self, word):
        return max(self.candidates(word), key=self.P)

    def candidates(self, word):
        return (
            self.known([word])
            or self.known(self.edits1(word))
            or self.known(self.edits2(word))
            or [word]
        )

    def known(self, words):
        return set(w for w in words if w in self.WORDS)

    def edits1(self, word):
        letters = "abcdefghijklmnopqrstuvwxyz"
        splits = [(word[:i], word[i:]) for i in range(len(word) + 1)]
        deletes = [L + R[1:] for L, R in splits if R]
        transposes = [L + R[1] + R[0] + R[2:] for L, R in splits if len(R) > 1]
        replaces = [L + c + R[1:] for L, R in splits if R for c in letters]
        inserts = [L + c + R for L, R in splits for c in letters]
        return set(deletes + transposes + replaces + inserts)

    def edits2(self, word):
        return (e2 for e1 in self.edits1(word) for e2 in self.edits1(e1))


class RecipeSearchEngine:
    def __init__(self, vectorizer, bm25_matrix, df):
        self.vectorizer = vectorizer
        self.bm25_matrix = bm25_matrix
        self.df = df

    def search(self, query, top_k=5):
        query_vec = self.vectorizer.transform([query])
        scores = self.bm25_matrix.dot(query_vec.T).toarray().flatten()
        rank = np.argsort(scores)[::-1]

        results = self.df.iloc[rank[:top_k]].copy()
        results["Score"] = scores[rank[:top_k]]
        return results

    def get_by_ids(self, recipe_ids):
        mask = self.df.index.isin(recipe_ids)
        results = self.df[mask].copy()
        results["Score"] = 0.0
        return results
