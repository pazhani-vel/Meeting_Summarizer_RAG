from faster_whisper import WhisperModel
import config

_model = None

def get_model():
    global _model
    if _model is None:
        print("Loading Whisper model...")
        _model = WhisperModel(
            config.WHISPER_MODEL_SIZE,
            device=config.WHISPER_DEVICE,
            compute_type=config.WHISPER_COMPUTE_TYPE,
        )
        print("Model loaded.")
    return _model


def transcribe_audio(audio_path: str) -> dict:
    """
    Transcribe audio/video file.
    Returns {"text": full_transcript, "segments": [{"start", "end", "text"}]}
    """
    model = get_model()
    print("Transcription started...")

    segments, info = model.transcribe(audio_path, beam_size=5)

    full_text = ""
    segment_list = []
    for seg in segments:
        full_text += seg.text + " "
        segment_list.append({"start": seg.start, "end": seg.end, "text": seg.text})

    print("Transcription completed.")
    return {"text": full_text.strip(), "segments": segment_list, "language": info.language}