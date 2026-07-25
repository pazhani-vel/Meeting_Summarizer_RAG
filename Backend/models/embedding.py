from sentence_transformers import SentenceTransformer


class EmbeddingManager:
    def __init__(self, model_name="all-MiniLM-L6-v2"):
        """
        Initialize the embedding model.

        Default Model:
            all-MiniLM-L6-v2
            - 384-dimensional embeddings
            - Fast
            - Good for semantic search
        """
        self.model = SentenceTransformer(model_name)
        print("The embedding model loaded")

    def generate_embedding(self, text: str):
        """
        Generate embedding for a single piece of text.

        Args:
            text (str)

        Returns:
            list[float]
        """
        embedding = self.model.encode(
            text,
            convert_to_numpy=True,
            normalize_embeddings=True
        )

        return embedding.tolist()

    def generate_embeddings(self, texts: list[str]):
        """
        Generate embeddings for multiple texts.

        Args:
            texts (list[str])

        Returns:
            list[list[float]]
        """
        embeddings = self.model.encode(
            texts,
            convert_to_numpy=True,
            normalize_embeddings=True
        )

        return embeddings.tolist()