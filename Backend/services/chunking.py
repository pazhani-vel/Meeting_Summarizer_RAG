from langchain_text_splitters import RecursiveCharacterTextSplitter
import config

def chunk_transcript(text: str, video_id: str, filename: str):
    print("chuncking....")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE,
        chunk_overlap=config.CHUNK_OVERLAP,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )

    raw_chunks = splitter.split_text(text)

    # Wrap as simple dicts (not LangChain Document objects, since we have no PDF metadata)
    chunks = [
        {
            "content": chunk,
            "metadata": {"video_id": video_id, "source_file": filename, "chunk_index": i},
        }
        for i, chunk in enumerate(raw_chunks)
    ]

    print(f"{filename}: transcript → {len(chunks)} chunks")
    return chunks