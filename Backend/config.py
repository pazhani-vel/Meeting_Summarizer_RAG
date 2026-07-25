import os
from dotenv import load_dotenv

load_dotenv()

UPLOAD_FOLDER = "./data/uploaded_videos"
VECTOR_STORE_DIR = "./data/vector_store"
OUTPUT_FOLDER = "./outputs"
COLLECTION_NAME = "lecture_transcripts"

EMBEDDING_MODEL = "all-MiniLM-L6-v2"
WHISPER_MODEL_SIZE = "tiny"          # or "small", "base"
WHISPER_DEVICE = "cpu"
WHISPER_COMPUTE_TYPE = "int8"

GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

CHUNK_SIZE = 800          # characters, since transcript has no page boundaries like PDFs
CHUNK_OVERLAP = 150
TOP_K = 4

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(VECTOR_STORE_DIR, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)