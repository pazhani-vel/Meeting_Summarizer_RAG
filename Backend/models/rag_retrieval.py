class RAGRetriever:
    def __init__(self, vector_store, embedding_manager):
        self.vector_store = vector_store
        self.embedding_manager = embedding_manager
        print("The retrival model loaded")

    def retrieve(self, query: str, top_k: int = 4, filter: dict = None):
        """
        Retrieve top_k most relevant chunks for the query.
        filter: optional Chroma 'where' clause, e.g. {"video_id": "abc123"}
        """
        query_embedding = self.embedding_manager.generate_embeddings([query])[0]

        results = self.vector_store.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=filter,   # None = search everything, dict = scoped search
        )

        if not results or not results.get("documents") or not results["documents"][0]:
            return []

        docs = results["documents"][0]
        metadatas = results["metadatas"][0]

        return [
            {"content": doc, "metadata": meta}
            for doc, meta in zip(docs, metadatas)
        ]