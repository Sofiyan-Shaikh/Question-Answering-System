"""PDF processing and Retrieval-Augmented QA service"""
import io
import re
import time
from typing import Dict, List, Any, Optional
from pypdf import PdfReader
from rank_bm25 import BM25Okapi

from .predictor import predictor


class PDFService:
    """Service to parse PDF documents, chunk pages, retrieve candidates, and answer questions."""

    @staticmethod
    def extract_pdf_pages(file_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Extract text from PDF bytes page by page.
        Returns a list of dicts with page_number (1-indexed), text, and char_count.
        """
        reader = PdfReader(io.BytesIO(file_bytes))
        pages_data = []

        for idx, page in enumerate(reader.pages):
            raw_text = page.extract_text() or ""
            # Clean up whitespace and non-printable characters
            cleaned = re.sub(r"[ \t]+", " ", raw_text)
            cleaned = re.sub(r"\n\s*\n+", "\n\n", cleaned).strip()
            pages_data.append({
                "page_number": idx + 1,
                "text": cleaned,
                "char_count": len(cleaned)
            })

        return pages_data

    @staticmethod
    def chunk_document(
        pages_data: List[Dict[str, Any]],
        chunk_size_words: int = 140,
        overlap_words: int = 35
    ) -> List[Dict[str, Any]]:
        """
        Chunk document pages into overlapping passages while retaining page numbers.
        """
        chunks = []
        chunk_id = 0

        for p_info in pages_data:
            page_num = p_info["page_number"]
            text = p_info["text"]
            if not text:
                continue

            words = text.split()
            if len(words) <= chunk_size_words:
                chunks.append({
                    "chunk_id": chunk_id,
                    "page_number": page_num,
                    "text": text
                })
                chunk_id += 1
            else:
                step = max(1, chunk_size_words - overlap_words)
                for start_idx in range(0, len(words), step):
                    chunk_words = words[start_idx:start_idx + chunk_size_words]
                    chunk_text = " ".join(chunk_words)
                    chunks.append({
                        "chunk_id": chunk_id,
                        "page_number": page_num,
                        "text": chunk_text
                    })
                    chunk_id += 1
                    if start_idx + chunk_size_words >= len(words):
                        break

        return chunks

    @staticmethod
    def retrieve_top_chunks(
        chunks: List[Dict[str, Any]],
        question: str,
        top_n: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Retrieve the top-n most relevant text chunks using BM25.
        """
        if not chunks:
            return []

        # Tokenize corpus and query
        tokenized_corpus = [
            re.findall(r"\w+", c["text"].lower()) for c in chunks
        ]
        # Avoid empty token lists for BM25
        tokenized_corpus = [tokens if tokens else ["empty"] for tokens in tokenized_corpus]

        bm25 = BM25Okapi(tokenized_corpus)
        query_tokens = re.findall(r"\w+", question.lower())
        if not query_tokens:
            query_tokens = ["what"]

        doc_scores = bm25.get_scores(query_tokens)

        # Pair chunks with scores and sort descending
        scored_chunks = list(zip(chunks, doc_scores))
        scored_chunks.sort(key=lambda x: x[1], reverse=True)

        # Select top-n
        return [c for c, _ in scored_chunks[:min(top_n, len(scored_chunks))]]

    def answer_question_from_pdf(
        self,
        file_bytes: bytes,
        filename: str,
        question: str,
        top_k: int = 1
    ) -> Dict[str, Any]:
        """
        End-to-end PDF QA pipeline:
        1. Extract text and page numbers
        2. Chunk document into passages
        3. Retrieve candidate passages with BM25
        4. Run BERT model on candidates
        5. Return top answer with page citation
        """
        start_time = time.time()
        pages = self.extract_pdf_pages(file_bytes)
        total_pages = len(pages)

        # Check for empty or unscannable PDF
        total_chars = sum(p["char_count"] for p in pages)
        if total_pages == 0 or total_chars == 0:
            exec_time = (time.time() - start_time) * 1000
            return {
                "answer": "",
                "descriptive_answer": None,
                "answers": [],
                "is_answerable": False,
                "confidence_score": 0.0,
                "page_number": None,
                "total_pages": total_pages,
                "matched_passage": None,
                "filename": filename,
                "model_version": predictor.model_version,
                "execution_time_ms": round(exec_time, 2)
            }

        chunks = self.chunk_document(pages)
        if not chunks:
            exec_time = (time.time() - start_time) * 1000
            return {
                "answer": "",
                "descriptive_answer": None,
                "answers": [],
                "is_answerable": False,
                "confidence_score": 0.0,
                "page_number": None,
                "total_pages": total_pages,
                "matched_passage": None,
                "filename": filename,
                "model_version": predictor.model_version,
                "execution_time_ms": round(exec_time, 2)
            }

        # If document is small (1 page and <= 1000 chars), evaluate directly
        if total_pages == 1 and total_chars <= 1200:
            candidate_chunks = [{"chunk_id": 0, "page_number": 1, "text": pages[0]["text"]}]
        else:
            candidate_chunks = self.retrieve_top_chunks(chunks, question, top_n=3)

        # Evaluate candidate chunks with the QA predictor
        best_result = None
        best_confidence = -1.0
        best_page = None
        best_passage = None

        for cand in candidate_chunks:
            chunk_context = cand["text"]
            qa_res = predictor.predict(
                context=chunk_context,
                question=question,
                top_k=top_k
            )

            if qa_res.get("is_answerable"):
                conf = qa_res.get("confidence_score", 0.0)
                if conf > best_confidence:
                    best_confidence = conf
                    best_result = qa_res
                    best_page = cand["page_number"]
                    best_passage = chunk_context

        exec_time = (time.time() - start_time) * 1000

        if best_result and best_result.get("is_answerable"):
            return {
                "answer": best_result.get("answer", ""),
                "descriptive_answer": best_result.get("descriptive_answer", None),
                "answers": best_result.get("answers", []),
                "is_answerable": True,
                "confidence_score": best_result.get("confidence_score", 0.0),
                "page_number": best_page,
                "total_pages": total_pages,
                "matched_passage": best_passage,
                "filename": filename,
                "model_version": predictor.model_version,
                "execution_time_ms": round(exec_time, 2)
            }

        # If unanswerable
        return {
            "answer": "",
            "descriptive_answer": None,
            "answers": [],
            "is_answerable": False,
            "confidence_score": 0.0,
            "page_number": None,
            "total_pages": total_pages,
            "matched_passage": None,
            "filename": filename,
            "model_version": predictor.model_version,
            "execution_time_ms": round(exec_time, 2)
        }


pdf_service = PDFService()
