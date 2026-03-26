import os
import uuid
from datetime import datetime

_store_instance = None

def get_knowledge_store() -> "KnowledgeStore":
    global _store_instance
    if _store_instance is None:
        _store_instance = KnowledgeStore()
    return _store_instance


class KnowledgeStore:
    """
    Vector knowledge base for team documents (READMEs, configs, scripts).
    Uses ChromaDB with Google Generative AI embeddings for semantic retrieval.
    Injected as context into the AutomationEngine prompt pipeline.
    """

    def __init__(self):
        from langchain_chroma import Chroma
        from langchain_google_genai import GoogleGenerativeAIEmbeddings

        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key or api_key == "your_gemini_api_key_here":
            raise ValueError("GOOGLE_API_KEY not set — Knowledge Store unavailable.")

        persist_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "..", "..", "chroma_db"
        )

        self._embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
        self._vectorstore = Chroma(
            collection_name="team_knowledge",
            embedding_function=self._embeddings,
            persist_directory=persist_dir,
        )

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def add_document(self, content: str, filename: str, doc_type: str = "doc") -> str:
        from langchain_core.documents import Document

        doc_id = str(uuid.uuid4())
        doc = Document(
            page_content=content,
            metadata={
                "id": doc_id,
                "filename": filename,
                "type": doc_type,
                "added_at": datetime.now().isoformat(),
            },
        )
        self._vectorstore.add_documents([doc], ids=[doc_id])
        return doc_id

    def delete_document(self, doc_id: str) -> None:
        self._vectorstore.delete([doc_id])

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def query(self, query_text: str, n_results: int = 3) -> list[str]:
        """Return top-k relevant document chunks for a given query."""
        try:
            results = self._vectorstore.similarity_search(query_text, k=n_results)
            return [doc.page_content for doc in results]
        except Exception as e:
            print(f"[KnowledgeStore] Query error: {e}")
            return []

    def list_documents(self) -> list[dict]:
        """Return metadata for all stored documents."""
        try:
            col = self._vectorstore._collection
            data = col.get(include=["metadatas"])
            docs = []
            for i, doc_id in enumerate(data.get("ids", [])):
                meta = (data.get("metadatas") or [{}])[i]
                docs.append(
                    {
                        "id": doc_id,
                        "filename": meta.get("filename", "Unknown"),
                        "type": meta.get("type", "doc"),
                        "added_at": meta.get("added_at", ""),
                    }
                )
            return docs
        except Exception as e:
            print(f"[KnowledgeStore] List error: {e}")
            return []
