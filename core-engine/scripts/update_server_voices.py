from pathlib import Path

p = Path("server.py")
content = p.read_text(encoding="utf-8")

old_snippet_1 = """    calling_languages: Optional[List[str]] = Field(default_factory=lambda: ["hi", "en", "mr", "hinglish"])
    voice_provider: Optional[str] = "cartesia"
    voice_id: Optional[str] = None
    llm_model: Optional[str] = "llama-3.3-70b-versatile\""""

new_snippet_1 = """    calling_languages: Optional[List[str]] = Field(default_factory=lambda: ["hi", "en", "mr", "hinglish"])
    # Voice selection removed in Part H2: voice is locked internally per language (mr, hi, en)
    llm_model: Optional[str] = "llama-3.3-70b-versatile\""""

old_snippet_2 = """    default_language: Optional[str] = None
    voice_provider: Optional[str] = None
    voice_id: Optional[str] = None
    llm_model: Optional[str] = None"""

new_snippet_2 = """    default_language: Optional[str] = None
    llm_model: Optional[str] = None"""

# Normalize \r\n to \n for replacement
has_crlf = "\r\n" in content
content_norm = content.replace("\r\n", "\n")

if old_snippet_1 in content_norm and old_snippet_2 in content_norm:
    content_norm = content_norm.replace(old_snippet_1, new_snippet_1)
    content_norm = content_norm.replace(old_snippet_2, new_snippet_2)
    if has_crlf:
        content_norm = content_norm.replace("\n", "\r\n")
    p.write_text(content_norm, encoding="utf-8")
    print("SUCCESS: server.py updated cleanly!")
else:
    print("WARNING: snippets not found in server.py")
