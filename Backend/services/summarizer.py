import json
from langchain_groq import ChatGroq
import config

_llm = None

def get_llm():
    global _llm
    if _llm is None:
        if not config.GROQ_API_KEY:
            raise EnvironmentError("GROQ_API_KEY not set in .env")
        _llm = ChatGroq(
            groq_api_key=config.GROQ_API_KEY,
            model_name=config.GROQ_MODEL,
            temperature=0.2,
            max_tokens=1024,
        )
    return _llm


SUMMARY_PROMPT = """You are an academic assistant. Given this lecture transcript, output:
1. A concise summary (150-200 words)
2. Key topics/concepts covered (bullet list)
3. Action items or things the student should revise/follow up on

Respond ONLY in valid JSON with keys: summary, key_topics, action_items.

Transcript:
{transcript}
"""

def summarize_transcript(transcript: str) -> dict:
    llm = get_llm()

    # crude word-count gate for map-reduce; ~10k words ≈ full hour lecture
    word_count = len(transcript.split())
    if word_count <= 3000:
        return _summarize_single(transcript, llm)
    else:
        return _summarize_map_reduce(transcript, llm)


def _summarize_single(transcript: str, llm) -> dict:
    prompt = SUMMARY_PROMPT.format(transcript=transcript)
    response = llm.invoke(prompt)
    return _parse_json_response(response.content)


def _summarize_map_reduce(transcript: str, llm) -> dict:
    words = transcript.split()
    part_size = 3000
    parts = [" ".join(words[i:i + part_size]) for i in range(0, len(words), part_size)]

    partial_summaries = []
    for part in parts:
        prompt = SUMMARY_PROMPT.format(transcript=part)
        response = llm.invoke(prompt)
        partial_summaries.append(_parse_json_response(response.content))

    merged_text = "\n\n".join(
        f"Summary: {p['summary']}\nTopics: {p['key_topics']}\nActions: {p['action_items']}"
        for p in partial_summaries
    )
    merge_prompt = f"""Merge these partial lecture summaries into ONE coherent final summary.
Remove repetition. Respond ONLY in valid JSON with keys: summary, key_topics, action_items.

{merged_text}
"""
    response = llm.invoke(merge_prompt)
    return _parse_json_response(response.content)


def _parse_json_response(raw: str) -> dict:
    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"summary": cleaned, "key_topics": [], "action_items": []}