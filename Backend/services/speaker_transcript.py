def find_speaker(start, end, speaker_segments):
    """
    Find the speaker with the maximum overlap
    with the Whisper transcript segment.
    """

    best_speaker = "UNKNOWN"
    best_overlap = 0

    for segment in speaker_segments:

        speaker_start = segment["start"]
        speaker_end = segment["end"]

        overlap_start = max(start, speaker_start)
        overlap_end = min(end, speaker_end)

        overlap = max(0, overlap_end - overlap_start)

        if overlap > best_overlap:
            best_overlap = overlap
            best_speaker = segment["speaker"]

    return best_speaker


def create_speaker_transcript(transcription_result, speaker_segments):

    speaker_transcript = []

    for segment in transcription_result["segments"]:

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


def format_speaker_transcript(speaker_transcript):

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