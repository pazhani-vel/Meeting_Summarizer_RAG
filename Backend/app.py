import os
import sys
import uuid
import json
import time
import traceback
import io
from pathlib import Path

# Fix Windows console encoding for Unicode characters (e.g. from langchain output)
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        elif hasattr(sys.stdout, "buffer"):
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8")
        elif hasattr(sys.stderr, "buffer"):
            sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

from flask import Flask, g, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

import config
from services import transcription, chunking, summarizer, diarization
from services.speaker_transcript import create_speaker_transcript
from services.speaker_transcript import format_speaker_transcript
from services.auth_decorator import require_auth
from db.repositories import (
    create_meeting,
    update_meeting_status,
    get_meeting_by_id,
    list_user_meetings,
    delete_meeting_docs,
    insert_segments,
    get_segments,
    delete_segments,
    upsert_summary,
    get_summary as db_get_summary,
    delete_summary,
    insert_chat_message,
    get_chat_messages,
    delete_chat_messages,
)
from models.vectorstore import VectorStore
from models.embedding import EmbeddingManager
from models.rag_retrieval import RAGRetriever
from langchain_groq import ChatGroq

from services.audio_extraction import AudioExtractor
from db.mongo import get_client
from db.indexes import ensure_indexes

app = Flask(__name__)
CORS(app)

# -- Rate limiter (shared instance from limiter.py) --
from limiter import limiter
limiter.init_app(app)

try:
    ensure_indexes()
    print("MongoDB indexes ensured.")
except Exception as e:
    print(f"Warning: could not ensure MongoDB indexes: {e}")

# -- Register blueprints --

from routes.auth_routes import auth_bp

app.register_blueprint(auth_bp)

# Rate limits are applied via @limiter.limit decorators in auth_routes.py

# -- Lazy singletons --

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
        _llm,
    )


# =====================================================================
# Upload  (rewritten with status tracking)
# =====================================================================

@app.route("/upload", methods=["POST"])
@require_auth
def upload_video():
    if "video" not in request.files:
        return jsonify({"status": "error", "message": "No 'video' field in request"}), 400

    file = request.files["video"]
    if file.filename == "":
        return jsonify({"status": "error", "message": "Empty filename"}), 400

    user_id = g.user_id
    meeting_id = str(uuid.uuid4())
    filename = secure_filename(file.filename)
    video_path = os.path.join(config.UPLOAD_FOLDER, f"{meeting_id}_{filename}")
    file.save(video_path)

    # Create meeting row with status "pending"
    create_meeting(meeting_id, user_id, filename, video_path)
    print("Video uploaded, meeting row created (pending)")

    try:
        audio_extractor, embedding_manager, vector_store, _, _ = get_components()

        out_dir = os.path.join(config.OUTPUT_FOLDER, meeting_id)
        os.makedirs(out_dir, exist_ok=True)

        # -- extracting --
        update_meeting_status(meeting_id, "extracting")
        print("Extracting the audio..")
        t0 = time.time()
        audio_path = audio_extractor.extract_audio(video_path, out_dir)
        print("Extracting done.")

        # -- transcribing --
        update_meeting_status(meeting_id, "transcribing")
        print("Transcribing audio...")
        result = transcription.transcribe_audio(audio_path)
        transcript_text = result["text"]
        language = result.get("language", "unknown")
        print("Transcription completed.")

        # -- diarizing --
        update_meeting_status(meeting_id, "diarizing")
        print("Detecting speakers...")
        speaker_segments = diarization.diarize_audio(audio_path)
        print("Speaker diarization completed.")

        speaker_transcript = create_speaker_transcript(result, speaker_segments)
        speaker_transcript_text = format_speaker_transcript(speaker_transcript)
        print("Speaker transcript created.")

        # Compute duration from last segment end
        duration_sec = 0.0
        if speaker_transcript:
            duration_sec = speaker_transcript[-1].get("end", 0.0)

        # -- summarizing --
        update_meeting_status(meeting_id, "summarizing")
        chunks = chunking.chunk_transcript(speaker_transcript_text, meeting_id, filename)
        print(f"Created {len(chunks)} chunks.")

        if chunks:
            texts = [chunk["content"] for chunk in chunks]
            metadatas = []
            for chunk in chunks:
                meta = dict(chunk["metadata"])
                meta["user_id"] = user_id
                metadatas.append(meta)

            embeddings = embedding_manager.generate_embeddings(texts)
            vector_store.add_documents(texts, embeddings, metadatas)
        else:
            print("No chunks to embed — skipping vector store.")

        summary = summarizer.summarize_transcript(speaker_transcript_text)
        print("Got the Summary..")

        # Write segments to MongoDB
        seg_docs = [
            {
                "idx": i,
                "start_sec": seg["start"],
                "end_sec": seg["end"],
                "speaker": seg["speaker"],
                "text": seg["text"],
            }
            for i, seg in enumerate(speaker_transcript)
        ]
        insert_segments(meeting_id, seg_docs)

        # Write summary to MongoDB
        upsert_summary(
            meeting_id,
            summary=summary,
            key_topics=summary.get("key_topics", []),
            action_items=summary.get("action_items", []),
            model=config.GROQ_MODEL,
        )

        # Update meeting to "ready"
        update_meeting_status(
            meeting_id,
            "ready",
            duration_sec=duration_sec,
            language=language,
        )

        # -- keep existing file writes for backwards compat --
        with open(os.path.join(out_dir, "transcript.txt"), "w", encoding="utf-8") as f:
            f.write(transcript_text)
        with open(os.path.join(out_dir, "speaker_transcript.txt"), "w", encoding="utf-8") as f:
            f.write(speaker_transcript_text)
        with open(os.path.join(out_dir, "summary.json"), "w", encoding="utf-8") as f:
            json.dump({"video_id": meeting_id, "filename": filename, **summary}, f, indent=4)

        return (
            jsonify({
                "status": "success",
                "meeting_id": meeting_id,
                "filename": filename,
                "diarization": speaker_transcript,
                **summary,
            }),
            200,
        )

    except Exception as e:
        # Log full traceback to stderr for debugging
        tb = traceback.format_exc()
        print(tb, file=sys.stderr, flush=True)
        # Mark as failed with a short error string
        err_msg = str(e)[:500]
        try:
            update_meeting_status(meeting_id, "failed", error=err_msg)
        except Exception:
            pass
        return jsonify({"status": "error", "message": err_msg}), 500


# =====================================================================
# Meeting endpoints  (new, ownership-filtered)
# =====================================================================

@app.route("/meetings", methods=["GET"])
@require_auth
def list_meetings():
    limit = request.args.get("limit", 50, type=int)
    skip = request.args.get("skip", 0, type=int)
    meetings = list_user_meetings(g.user_id, limit=limit, skip=skip)

    # Attach a short summary preview from the summaries collection
    results = []
    for m in meetings:
        mid = m["meeting_id"]
        s = db_get_summary(mid)
        preview = {}
        if s:
            # summary field may be a dict (the full summary object) or a plain string
            raw_summary = s.get("summary", "")
            if isinstance(raw_summary, dict):
                full_text = raw_summary.get("summary", "")
            else:
                full_text = raw_summary or ""
            preview = {
                "summary_preview": full_text[:200] + ("..." if len(full_text) > 200 else ""),
                "key_topics": s.get("key_topics", [])[:5],
            }
        results.append({
            "meeting_id": mid,
            "filename": m["filename"],
            "status": m["status"],
            "duration_sec": m["duration_sec"],
            "created_at": m["created_at"],
            **preview,
        })

    return jsonify({"status": "success", "meetings": results}), 200


@app.route("/meetings/<meeting_id>", methods=["GET"])
@require_auth
def get_meeting_detail(meeting_id):
    meeting = get_meeting_by_id(meeting_id, g.user_id)
    if meeting is None:
        return jsonify({"status": "error", "message": "Meeting not found"}), 404

    summary_doc = db_get_summary(meeting_id)
    return jsonify({
        "status": "success",
        "meeting": {
            "meeting_id": meeting["meeting_id"],
            "filename": meeting["filename"],
            "status": meeting["status"],
            "duration_sec": meeting["duration_sec"],
            "language": meeting["language"],
            "error": meeting.get("error"),
            "created_at": meeting["created_at"],
            "completed_at": meeting.get("completed_at"),
        },
        "summary": summary_doc,
    }), 200


@app.route("/meetings/<meeting_id>/transcript", methods=["GET"])
@require_auth
def get_meeting_transcript(meeting_id):
    meeting = get_meeting_by_id(meeting_id, g.user_id)
    if meeting is None:
        return jsonify({"status": "error", "message": "Meeting not found"}), 404

    segments = get_segments(meeting_id)
    return jsonify({"status": "success", "segments": segments}), 200


@app.route("/meetings/<meeting_id>/video", methods=["GET"])
@require_auth
def get_meeting_video(meeting_id):
    meeting = get_meeting_by_id(meeting_id, g.user_id)
    if meeting is None:
        return jsonify({"status": "error", "message": "Meeting not found"}), 404

    video_path = meeting.get("video_path", "")
    if not video_path or not os.path.isfile(video_path):
        return jsonify({"status": "error", "message": "Video file not found"}), 404

    return send_file(video_path, conditional=True)


@app.route("/meetings/<meeting_id>/chat", methods=["GET"])
@require_auth
def get_meeting_chat(meeting_id):
    meeting = get_meeting_by_id(meeting_id, g.user_id)
    if meeting is None:
        return jsonify({"status": "error", "message": "Meeting not found"}), 404

    messages = get_chat_messages(meeting_id, g.user_id)
    return jsonify({"status": "success", "messages": messages}), 200


@app.route("/meetings/<meeting_id>", methods=["DELETE"])
@require_auth
def delete_meeting(meeting_id):
    meeting = get_meeting_by_id(meeting_id, g.user_id)
    if meeting is None:
        return jsonify({"status": "error", "message": "Meeting not found"}), 404

    video_path = meeting.get("video_path", "")

    # 1. Delete from MongoDB across all four collections
    delete_meeting_docs(meeting_id)
    delete_segments(meeting_id)
    delete_summary(meeting_id)
    delete_chat_messages(meeting_id)

    # 2. Delete vectors from ChromaDB
    try:
        _, _, vector_store, _, _ = get_components()
        vector_store.delete_video(meeting_id)
    except Exception:
        pass  # best-effort — vector store may not be initialised

    # 3. Unlink the video file
    if video_path and os.path.isfile(video_path):
        try:
            os.unlink(video_path)
        except OSError:
            pass  # best-effort

    return jsonify({"status": "success"}), 200


# =====================================================================
# Legacy /summary endpoint (backwards compat)
# =====================================================================

@app.route("/summary/<video_id>", methods=["GET"])
@require_auth
def get_summary(video_id):
    meeting = get_meeting_by_id(video_id, g.user_id)
    if meeting is None:
        return jsonify({"status": "error", "message": "Not found"}), 404

    path = os.path.join(config.OUTPUT_FOLDER, video_id, "summary.json")
    if not os.path.exists(path):
        return jsonify({"status": "error", "message": "Not found"}), 404
    with open(path) as f:
        return jsonify(json.load(f)), 200


# =====================================================================
# Chat  (now persists both sides)
# =====================================================================

@app.route("/chat", methods=["POST"])
@require_auth
def chat():
    data = request.get_json() or {}
    meeting_id = data.get("video_id") or data.get("meeting_id")
    question = data.get("question", "").strip()

    if not meeting_id or not question:
        return jsonify({"status": "error", "message": "video_id and question are required"}), 400

    meeting = get_meeting_by_id(meeting_id, g.user_id)
    if meeting is None:
        return jsonify({"status": "error", "message": "Not found"}), 404

    # Persist user message
    insert_chat_message(meeting_id, g.user_id, "user", question)

    _, _, _, retriever, llm = get_components()

    results = retriever.retrieve(
        question,
        top_k=config.TOP_K,
        filter={"video_id": meeting_id, "user_id": g.user_id},
    )

    if not results:
        answer = "No relevant content found for this video."
        sources = []
    else:
        context = "\n\n".join(r["content"] for r in results)
        prompt = (
            "Use the following lecture transcript excerpts to answer the question. "
            "If the answer isn't in the excerpts, say you don't know. "
            "After Give your answer if you have."
            "And also give the confidence level for you answer out of 100. \n\n"
            f"Context:\n{context}\n\nQuestion: {question}\n\nAnswer:"
        )
        try:
            response = llm.invoke(prompt)
            answer = response.content
        except Exception as e:
            print(f"Warning: LLM chat failed: {e}")
            answer = "The AI service is temporarily unavailable. Please try again later."
        sources = [
            {"chunk_index": r["metadata"].get("chunk_index"), "text": r["content"][:200]}
            for r in results
        ]

    # Persist assistant message
    insert_chat_message(meeting_id, g.user_id, "assistant", answer, sources)

    return jsonify({"answer": answer, "sources": sources}), 200


# =====================================================================
# Static file serving (legacy)
# =====================================================================

@app.route("/uploads/<filename>", methods=["GET"])
def serve_upload(filename):
    return send_from_directory(config.UPLOAD_FOLDER, filename)


# =====================================================================
# Health (public)
# =====================================================================

@app.route("/health", methods=["GET"])
def health():
    mongo_status = "ok"
    try:
        get_client().admin.command("ping")
    except Exception:
        mongo_status = "unreachable"

    try:
        _, _, vector_store, _, _ = get_components()
        chunk_count = vector_store.collection.count()
    except Exception:
        chunk_count = 0

    return jsonify({
        "status": "ok",
        "indexed_chunks": chunk_count,
        "mongo": mongo_status,
    }), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=False)
