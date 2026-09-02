import wave
import numpy as np
import torch
from pathlib import Path
from speechbrain.inference.classifiers import EncoderClassifier
from speechbrain.inference.VAD import VAD
from scipy.cluster.hierarchy import linkage, fcluster
from speechbrain.utils.fetching import LocalStrategy

# ============================================================
# Global models
# ============================================================

_speaker_model = None
_vad_model = None

SAMPLE_RATE = 16000

# ECAPA works better with reasonably long speech windows
WINDOW_SECONDS = 2.0

# Overlap between consecutive windows
STEP_SECONDS = 1.0

# Cosine distance threshold
# Lower -> more speakers
# Higher -> fewer speakers
CLUSTER_THRESHOLD = 0.55


# ============================================================
# Load SpeechBrain ECAPA model
# ============================================================

def get_speaker_model():
    """Load SpeechBrain ECAPA speaker model once."""

    global _speaker_model

    if _speaker_model is None:

        print("Loading SpeechBrain speaker model...")

        _speaker_model = EncoderClassifier.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            savedir="pretrained_models/spkrec-ecapa-voxceleb",
            run_opts={"device": "cpu"},
            local_strategy=LocalStrategy.COPY,
        )

        print("SpeechBrain speaker model loaded.")

    return _speaker_model


# ============================================================
# Load SpeechBrain VAD model
# ============================================================

def get_vad_model():
    """Load SpeechBrain VAD model once."""

    global _vad_model

    if _vad_model is None:

        print("Loading SpeechBrain VAD model...")

        _vad_model = VAD.from_hparams(
            source="speechbrain/vad-crdnn-libriparty",
            savedir="pretrained_models/vad-crdnn-libriparty",
            run_opts={"device": "cpu"},
            local_strategy=LocalStrategy.COPY,
        )

        print("SpeechBrain VAD model loaded.")

    return _vad_model


# ============================================================
# WAV loading
# ============================================================

def load_wav(audio_path: str):
    """
    Load WAV without torchaudio/TorchCodec.

    Returns:
        waveform: torch.Tensor [1, samples]
        sample_rate: int
    """

    with wave.open(audio_path, "rb") as wav:

        sample_rate = wav.getframerate()
        channels = wav.getnchannels()
        sample_width = wav.getsampwidth()
        frames = wav.getnframes()

        audio_bytes = wav.readframes(frames)

    # 16-bit PCM
    if sample_width == 2:

        audio = (
            np.frombuffer(
                audio_bytes,
                dtype=np.int16
            ).astype(np.float32)
            / 32768.0
        )

    # 32-bit PCM
    elif sample_width == 4:

        audio = (
            np.frombuffer(
                audio_bytes,
                dtype=np.int32
            ).astype(np.float32)
            / 2147483648.0
        )

    else:

        raise RuntimeError(
            f"Unsupported WAV sample width: "
            f"{sample_width} bytes"
        )

    # Stereo -> mono
    if channels > 1:

        audio = audio.reshape(-1, channels)
        audio = audio.mean(axis=1)

    waveform = (
        torch.from_numpy(audio)
        .float()
        .unsqueeze(0)
    )

    return waveform, sample_rate


# ============================================================
# Resampling
# ============================================================

def resample_audio(
    waveform,
    original_rate,
    target_rate=SAMPLE_RATE
):
    """
    Resample audio using numpy interpolation.

    This avoids torchaudio/TorchCodec completely.
    """

    if original_rate == target_rate:
        return waveform

    audio = waveform.squeeze(0).numpy()

    old_length = len(audio)

    if old_length == 0:
        return waveform

    new_length = max(
        1,
        int(old_length * target_rate / original_rate)
    )

    old_indices = np.linspace(
        0,
        old_length - 1,
        old_length
    )

    new_indices = np.linspace(
        0,
        old_length - 1,
        new_length
    )

    resampled = np.interp(
        new_indices,
        old_indices,
        audio
    )

    return torch.from_numpy(
        resampled.astype(np.float32)
    ).unsqueeze(0)


# ============================================================
# SpeechBrain VAD
# ============================================================

def get_speech_regions(audio_path: str):
    vad = get_vad_model()

    print("Running SpeechBrain VAD...")

    audio_path = Path(audio_path).resolve()

    print(f"VAD audio path: {audio_path}")
    print(f"Exists: {audio_path.exists()}")

    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    # SpeechBrain has path parsing that can cause problems with
    # Windows backslash paths. Convert to forward slashes.
    speechbrain_path = audio_path.as_posix()

    print(f"SpeechBrain path: {speechbrain_path}")

    boundaries = vad.get_speech_segments(speechbrain_path)

    speech_regions = []

    if hasattr(boundaries, "detach"):
        boundaries = boundaries.detach().cpu().numpy()

    boundaries = np.asarray(boundaries)

    if boundaries.size == 0:
        print("Speech regions detected: 0")
        return []

    boundaries = boundaries.reshape(-1, 2)

    for boundary in boundaries:
        start = float(boundary[0])
        end = float(boundary[1])

        if end > start:
            speech_regions.append({
                "start": start,
                "end": end
            })

    print(f"Speech regions detected: {len(speech_regions)}")

    return speech_regions

# ============================================================
# Create speaker windows
# ============================================================

def create_windows(speech_regions):
    """
    Split speech regions into overlapping windows.

    Example:

        speech: 0 -> 8

        windows:

        0 -> 2
        1 -> 3
        2 -> 4
        3 -> 5
        ...
    """

    windows = []

    for region in speech_regions:

        start = region["start"]
        end = region["end"]

        current = start

        while current < end:

            window_end = min(
                current + WINDOW_SECONDS,
                end
            )

            duration = window_end - current

            # Ignore very short pieces
            if duration >= 1.0:

                windows.append({
                    "start": current,
                    "end": window_end
                })

            current += STEP_SECONDS

    return windows


# ============================================================
# Extract ECAPA embeddings
# ============================================================

def extract_embeddings(
    waveform,
    sample_rate,
    windows
):
    """
    Generate ECAPA speaker embeddings.

    IMPORTANT:
    Returns both embeddings and the corresponding
    windows so their indexes can never become misaligned.
    """

    model = get_speaker_model()

    embeddings = []
    used_windows = []

    total_samples = waveform.shape[1]

    for i, window in enumerate(windows):

        start_sample = int(
            window["start"] * sample_rate
        )

        end_sample = int(
            window["end"] * sample_rate
        )

        start_sample = max(
            0,
            start_sample
        )

        end_sample = min(
            total_samples,
            end_sample
        )

        segment = waveform[
            :,
            start_sample:end_sample
        ]

        # Require at least 1 second
        if segment.shape[1] < sample_rate:
            continue

        with torch.no_grad():

            embedding = model.encode_batch(
                segment
            )

        # Usually [1, 1, embedding_dim]
        embedding = embedding.squeeze()

        embedding = (
            embedding
            .detach()
            .cpu()
            .numpy()
        )

        # Normalize embedding
        norm = np.linalg.norm(embedding)

        if norm > 0:

            embedding = embedding / norm

        embeddings.append(embedding)

        # IMPORTANT:
        # Keep the exact window belonging
        # to this embedding.
        used_windows.append(window)

        if (i + 1) % 10 == 0:

            print(
                f"Speaker embeddings: "
                f"{i + 1}/{len(windows)}"
            )

    if not embeddings:

        return np.empty((0,)), []

    return np.asarray(embeddings), used_windows


# ============================================================
# Cluster speakers
# ============================================================

def cluster_speakers(embeddings):
    """
    Cluster ECAPA embeddings using hierarchical
    clustering with cosine distance.
    """

    if len(embeddings) == 0:
        return []

    if len(embeddings) == 1:
        return [0]

    # Cosine distance because embeddings
    # are already normalized.
    distances = 1.0 - np.dot(
        embeddings,
        embeddings.T
    )

    # Numerical stability
    distances = np.clip(
        distances,
        0.0,
        2.0
    )

    # scipy linkage expects condensed matrix
    condensed = distances[
        np.triu_indices(
            len(embeddings),
            k=1
        )
    ]

    linkage_matrix = linkage(
        condensed,
        method="average"
    )

    labels = fcluster(
        linkage_matrix,
        t=CLUSTER_THRESHOLD,
        criterion="distance"
    )

    # Convert 1-based labels -> 0-based
    labels = labels - 1

    return labels.tolist()


# ============================================================
# Build speaker turns
# ============================================================

def build_speaker_turns(
    windows,
    labels
):
    """
    Convert clustered windows into speaker turns.
    """

    if not windows or not labels:
        return []

    turns = []

    for window, label in zip(
        windows,
        labels
    ):

        speaker = (
            f"SPEAKER_{int(label):02d}"
        )

        start = window["start"]
        end = window["end"]

        if not turns:

            turns.append({
                "start": start,
                "end": end,
                "speaker": speaker
            })

            continue

        previous = turns[-1]

        # Merge same speaker when windows
        # overlap or are very close.
        if (
            previous["speaker"] == speaker
            and start <= previous["end"] + 0.2
        ):

            previous["end"] = max(
                previous["end"],
                end
            )

        else:

            turns.append({
                "start": start,
                "end": end,
                "speaker": speaker
            })

    return turns


# ============================================================
# Main diarization
# ============================================================

def diarize_audio(audio_path: str) -> list:
    print("Diarization started...")

    audio_path = Path(audio_path).resolve()

    print(f"Audio path: {audio_path}")
    print(f"Audio exists: {audio_path.exists()}")

    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    speech_regions = get_speech_regions(str(audio_path))

    if not speech_regions:
        print("No speech detected.")
        return []

    windows = create_windows(speech_regions)

    print(f"Created {len(windows)} speaker windows.")

    if not windows:
        return []

    waveform, sample_rate = load_wav(str(audio_path))

    waveform = resample_audio(
        waveform,
        sample_rate,
        SAMPLE_RATE
    )

    sample_rate = SAMPLE_RATE

    embeddings, used_windows = extract_embeddings(
        waveform,
        sample_rate,
        windows
    )

    if len(embeddings) == 0:
        print("No speaker embeddings generated.")
        return []

    print(f"Generated {len(embeddings)} speaker embeddings.")

    labels = cluster_speakers(embeddings)

    number_of_speakers = len(set(labels)) if labels else 0

    print(f"Detected approximately {number_of_speakers} speakers.")

    turns = build_speaker_turns(
        used_windows,
        labels
    )

    print(
        f"Diarization completed: "
        f"{len(turns)} speaker turns detected."
    )

    return turns


# ============================================================
# Overlap utility
# ============================================================

def _overlap(
    a_start,
    a_end,
    b_start,
    b_end
) -> float:

    return max(
        0.0,
        min(a_end, b_end)
        - max(a_start, b_start)
    )


# ============================================================
# Assign speakers to Whisper segments
# ============================================================

def assign_speakers(
    segments: list,
    turns: list
) -> list:
    """
    Assign each Whisper segment to the
    speaker with maximum temporal overlap.
    """

    for seg in segments:

        best_speaker = "UNKNOWN"
        best_overlap = 0.0

        for turn in turns:

            overlap = _overlap(
                seg["start"],
                seg["end"],
                turn["start"],
                turn["end"]
            )

            if overlap > best_overlap:

                best_overlap = overlap

                best_speaker = turn[
                    "speaker"
                ]

        seg["speaker"] = best_speaker

    return segments


# ============================================================
# Build readable speaker transcript
# ============================================================

def build_speaker_transcript(
    segments: list
) -> str:

    lines = []

    for seg in segments:

        speaker = seg.get(
            "speaker"
        )

        prefix = (
            f"[{speaker}] "
            if speaker
            else ""
        )

        lines.append(
            f"{prefix}"
            f"{seg['text'].strip()}"
        )

    return "\n".join(lines)


# ============================================================
# Compatibility functions
# ============================================================

def find_speaker(
    start,
    end,
    speaker_segments
):

    best_speaker = "UNKNOWN"
    best_overlap = 0.0

    for segment in speaker_segments:

        overlap_start = max(
            start,
            segment["start"]
        )

        overlap_end = min(
            end,
            segment["end"]
        )

        overlap = max(
            0.0,
            overlap_end - overlap_start
        )

        if overlap > best_overlap:

            best_overlap = overlap
            best_speaker = segment[
                "speaker"
            ]

    return best_speaker


def create_speaker_transcript(
    transcription_result,
    speaker_segments
):

    speaker_transcript = []

    for segment in transcription_result[
        "segments"
    ]:

        start = segment["start"]
        end = segment["end"]
        text = segment["text"].strip()

        speaker = find_speaker(
            start,
            end,
            speaker_segments
        )

        speaker_transcript.append({
            "start": start,
            "end": end,
            "speaker": speaker,
            "text": text
        })

    return speaker_transcript


def format_speaker_transcript(
    speaker_transcript
):

    lines = []

    for segment in speaker_transcript:

        line = (
            f"[{segment['start']:.2f} - "
            f"{segment['end']:.2f}] "
            f"{segment['speaker']}: "
            f"{segment['text']}"
        )

        lines.append(line)

    return "\n".join(lines)
