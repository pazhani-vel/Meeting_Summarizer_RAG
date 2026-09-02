import os
import uuid
import json
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

import config
from services import transcription, chunking, summarizer, diarization
from services.speaker_transcript import create_speaker_transcript
from services.speaker_transcript import format_speaker_transcript
from models.vectorstore import VectorStore
from models.embedding import EmbeddingManager
from models.rag_retrieval import RAGRetriever
from langchain_groq import ChatGroq

from services.audio_extraction import AudioExtractor

app = Flask(__name__)
CORS(app)

# ── lazy singletons ──
_embedding_manager = None
_vector_store = None
_retriever = None
_llm = None
_audio_extractor = None

def get_components():
    global _embedding_manager, _vector_store, _retriever, _llm, _audio_extractor
    if _audio_extractor is None:
        _audio_extractor = AudioExtractor()
    if _embedding_manager is None:
        _embedding_manager = EmbeddingManager()
    if _vector_store is None:
        _vector_store = VectorStore()
    if _retriever is None:
        _retriever = RAGRetriever(_vector_store, _embedding_manager)
    if _llm is None:
        _llm = ChatGroq(
            groq_api_key=config.GROQ_API_KEY,
            model_name=config.GROQ_MODEL,
            temperature=0.1,
            max_tokens=1024,
        )
    return (
    _audio_extractor,
    _embedding_manager,
    _vector_store,
    _retriever,
    _llm
    )

@app.route("/upload", methods=["POST"])
def upload_video():
    if "video" not in request.files:
        return jsonify({"status": "error", "message": "No 'video' field in request"}), 400

    file = request.files["video"]
    if file.filename == "":
        return jsonify({"status": "error", "message": "Empty filename"}), 400

    video_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    video_path = os.path.join(config.UPLOAD_FOLDER, f"{video_id}_{filename}")
    file.save(video_path)

    print("Video uploaded successfully")

    try:
        audio_extractor, embedding_manager, vector_store, _, _ = get_components()

        out_dir = os.path.join(config.OUTPUT_FOLDER, video_id)
        os.makedirs(out_dir, exist_ok=True)

        print("Extracting the audio..")

        audio_path = audio_extractor.extract_audio(
        video_path,
        out_dir
        )

        print("Transcribing audio...")

        result = transcription.transcribe_audio(audio_path)

        transcript_text = result["text"]

        print("Transcription completed.")

        # ---------------------------------------
        # Speaker diarization
        # ---------------------------------------

        print("Detecting speakers...")

        speaker_segments = diarization.diarize_audio(audio_path)

        print("Speaker diarization completed.")

        # ---------------------------------------
        # Combine Whisper + Pyannote
        # ---------------------------------------

        speaker_transcript = create_speaker_transcript(
            result,
            speaker_segments
        )

        speaker_transcript_text = format_speaker_transcript(
            speaker_transcript
        )

        print(speaker_transcript)

        print("Speaker transcript created.")

        # ---------------------------------------
        # Chunk speaker-aware transcript
        # ---------------------------------------

        chunks = chunking.chunk_transcript(
            speaker_transcript_text,
            video_id,
            filename
        )

        print(f"Created {len(chunks)} chunks.")

        # Documents for ChromaDB
        texts = [
            chunk["content"]
            for chunk in chunks
        ]

        # Metadata for ChromaDB
        metadatas = [
            chunk["metadata"]
            for chunk in chunks
        ]

        # Generate embeddings
        embeddings = embedding_manager.generate_embeddings(texts)

        # Store in ChromaDB
        vector_store.add_documents(
            texts,
            embeddings,
            metadatas
        )

        # 3. Summarize
        summary = summarizer.summarize_transcript(speaker_transcript_text)

        print("Got the Summary..")

        # 4. Save output (transcript + summary) to a flat file
        # Save transcript
        with open(
            os.path.join(out_dir, "transcript.txt"),
            "w",
            encoding="utf-8"
        ) as f:
            f.write(transcript_text)

        # Save speaker-aware transcript
        with open(
            os.path.join(out_dir, "speaker_transcript.txt"),
            "w",
            encoding="utf-8"
        ) as f:
            f.write(speaker_transcript_text)

        # Save summary
        with open(
            os.path.join(out_dir, "summary.json"),
            "w",
            encoding="utf-8"
        ) as f:
            json.dump(
            {
            "video_id": video_id,
            "filename": filename,
            **summary
            },f,indent=4)

        return jsonify({
            "status": "success",
            "video_id": video_id,
            "filename": filename,
            "diarization": speaker_transcript,
            **summary
        }), 200

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/summary/<video_id>", methods=["GET"])
def get_summary(video_id):
    print("Getting the video path\n")
    path = os.path.join(config.OUTPUT_FOLDER, video_id, "summary.json")
    if not os.path.exists(path):
        return jsonify({"status": "error", "message": "Not found"}), 404
    with open(path) as f:
        return jsonify(json.load(f)), 200


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    video_id = data.get("video_id")
    question = data.get("question", "").strip()

    if not video_id or not question:
        return jsonify({"status": "error", "message": "video_id and question are required"}), 400

    _, _, _, retriever, llm = get_components()
    results = retriever.retrieve(question, top_k=config.TOP_K, filter={"video_id": video_id})

    if not results:
        return jsonify({"answer": "No relevant content found for this video.", "sources": []}), 200

    context = "\n\n".join(r["content"] for r in results)
    prompt = (
        "Use the following lecture transcript excerpts to answer the question. "
        "If the answer isn't in the excerpts, say you don't know. After Give your answer if you have.And also give the confidence level for you answer out of 100. \n\n"
        f"Context:\n{context}\n\nQuestion: {question}\n\nAnswer:"
    )
    response = llm.invoke(prompt)

    sources = [{"chunk_index": r["metadata"].get("chunk_index"), "text": r["content"][:200]} for r in results]
    return jsonify({"answer": response.content, "sources": sources}), 200


@app.route("/health", methods=["GET"])
def health():
    try:
        _, _, vector_store, _, _ = get_components()
        return jsonify({"status": "ok", "indexed_chunks": vector_store.collection.count()}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)