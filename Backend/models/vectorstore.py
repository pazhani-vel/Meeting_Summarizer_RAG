import chromadb
from chromadb.config import Settings


class VectorStore:
    def __init__(
        self,
        persist_directory="data/vector_store",
        collection_name="lecture_chunks"
    ):
        """
        Initialize ChromaDB persistent client.
        """

        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=Settings(anonymized_telemetry=False)
        )

        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"}
        )

    def add_documents(self, chunks, embeddings, metadatas):
        """
        Store transcript chunks in ChromaDB.

        Args:
            chunks      : List[str]
            embeddings  : List[List[float]]
            metadatas   : List[dict]
        """

        ids = [
            f"{metadata['video_id']}_{i}"
            for i, metadata in enumerate(metadatas)
        ]

        self.collection.add(
            ids=ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas
        )

        print("The document added..")

    def search(self, query_embedding, video_id, top_k=5):
        """
        Retrieve similar chunks from a specific video.
        """

        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where={"video_id": video_id}
        )

        return results

    def delete_video(self, video_id):
        """
        Delete all chunks belonging to a video.
        """

        self.collection.delete(
            where={"video_id": video_id}
        )

    def count(self):
        """
        Total number of stored chunks.
        """

        return self.collection.count()