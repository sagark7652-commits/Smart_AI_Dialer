"""Patch factory.py and engine.py to support Hugging Face."""
from pathlib import Path

# 1. Patch factory.py
factory_path = Path("agent/tts/factory.py")
content = factory_path.read_text(encoding="utf-8")
target = "    elif provider == \"elevenlabs\":\n        return ElevenLabsTTS(voice_id=voice)"
if target not in content:
    target = "    elif provider == \"elevenlabs\":\r\n        return ElevenLabsTTS(voice_id=voice)"

replacement = target + "\r\n    elif provider in (\"huggingface\", \"hf\"):\r\n        from agent.tts.huggingface_tts import HuggingFaceTTS\r\n        return HuggingFaceTTS(language=lang)"

if target in content and "HuggingFaceTTS" not in content:
    content = content.replace(target, replacement, 1)
    factory_path.write_text(content, encoding="utf-8")
    print("factory.py updated")

# 2. Patch engine.py
engine_path = Path("agent/engine.py")
eng_content = engine_path.read_text(encoding="utf-8")
eng_target = "        # LLM selection: Groq if key available, otherwise MockLLM"
eng_replace = """        # LLM selection: HuggingFace / Groq / MockLLM
        if settings.llm_provider in ("huggingface", "hf") and settings.huggingface_api_key:
            from agent.llm.huggingface_llm import HuggingFaceLLM
            llm = HuggingFaceLLM()
        elif settings.groq_api_key:"""

if "from agent.llm.huggingface_llm import HuggingFaceLLM" not in eng_content:
    if "        if settings.groq_api_key:" in eng_content:
        eng_content = eng_content.replace(
            "        if settings.groq_api_key:",
            """        if (getattr(settings, "llm_provider", "") in ("huggingface", "hf") and getattr(settings, "huggingface_api_key", None)) or (not settings.groq_api_key and getattr(settings, "huggingface_api_key", None)):
            from agent.llm.huggingface_llm import HuggingFaceLLM
            llm = HuggingFaceLLM()
        elif settings.groq_api_key:""",
            1
        )
        engine_path.write_text(eng_content, encoding="utf-8")
        print("engine.py updated")
