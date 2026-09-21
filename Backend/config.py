import os
from dotenv import load_dotenv

load_dotenv()

UPLOAD_FOLDER = "./data/uploaded_videos"
VECTOR_STORE_DIR = "./data/vector_store"
OUTPUT_FOLDER = "./outputs"

EMBEDDING_MODEL = "all-MiniLM-L6-v2"
WHISPER_MODEL_SIZE = "tiny"          # or "small", "base"
WHISPER_DEVICE = "cpu"
WHISPER_COMPUTE_TYPE = "int8"

GROQ_MODEL = "openai/gpt-oss-120b"
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

CHUNK_SIZE = 800          # characters, since transcript has no page boundaries like PDFs
CHUNK_OVERLAP = 150
TOP_K = 4

HF_TOKEN = os.getenv("HF_TOKEN")

# Authentication
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET environment variable is required. "
        "Set it before starting the application."
    )
JWT_ACCESS_TTL_MIN = int(os.getenv("JWT_ACCESS_TTL_MIN", "60"))
JWT_REFRESH_TTL_DAYS = int(os.getenv("JWT_REFRESH_TTL_DAYS", "7"))

# MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "meeting_summarizer")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(VECTOR_STORE_DIR, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)