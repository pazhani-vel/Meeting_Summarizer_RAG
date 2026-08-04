import config
from pyannote.audio import Pipeline

_pipeline = None


def get_pipeline():
    """
    Lazily load the pyannote diarization pipeline (singleton, like the Whisper model).
    """
    global _pipeline
    if _pipeline is None:
        if not config.HF_TOKEN:
            raise RuntimeError(
                "HF_TOKEN is not set. Diarization requires a HuggingFace token with "
                "access to 'pyannote/speaker-diarization-3.1' (accept the model's "
                "terms on huggingface.co, then set HF_TOKEN in your .env)."
            )
        

        print("Loading diarization pipeline...")
        _pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=config.HF_TOKEN,
        )
        print("Diarization pipeline loaded.")
    return _pipeline


def diarize_audio(audio_path: str) -> list:
    """
    Run speaker diarization on an audio file.
    Returns a list of {"start": float, "end": float, "speaker": str} turns,
    e.g. [{"start": 0.0, "end": 4.5, "speaker": "SPEAKER_00"}, ...]
    """
    pipeline = get_pipeline()
    print("Diarization started...")
    diarization = pipeline(audio_path)

    turns = [
        {"start": turn.start, "end": turn.end, "speaker": speaker}
        for turn, _, speaker in diarization.itertracks(yield_label=True)
    ]
    print(f"Diarization completed: {len(turns)} speaker turns detected.")
    return turns


def _overlap(a_start, a_end, b_start, b_end) -> float:
    """Length of overlap between two time intervals (0 if none)."""
    return max(0.0, min(a_end, b_end) - max(a_start, b_start))


def assign_speakers(segments: list, turns: list) -> list:
    """
    Tag each Whisper segment with the speaker whose diarization turn
    overlaps it the most in time. Mutates and returns `segments`.

    segments: [{"start", "end", "text"}, ...]  (from transcription.transcribe_audio)
    turns:    [{"start", "end", "speaker"}, ...] (from diarize_audio)
    """
    for seg in segments:
        best_speaker = "UNKNOWN"
        best_overlap = 0.0
        for turn in turns:
            ov = _overlap(seg["start"], seg["end"], turn["start"], turn["end"])
            if ov > best_overlap:
                best_overlap = ov
                best_speaker = turn["speaker"]
        seg["speaker"] = best_speaker
    return segments


def build_speaker_transcript(segments: list) -> str:
    """
    Render speaker-tagged segments as readable text, e.g.:
        [SPEAKER_00] Let's get started.
        [SPEAKER_01] Sure, go ahead.
    Used for summarization and chunking so downstream LLM calls see who said what.
    """
    lines = []
    for seg in segments:
        speaker = seg.get("speaker")
        prefix = f"[{speaker}] " if speaker else ""
        lines.append(f"{prefix}{seg['text'].strip()}")
    return "\n".join(lines)