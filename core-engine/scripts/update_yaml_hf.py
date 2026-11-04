"""Add huggingface block to agent_config.yaml."""
from pathlib import Path
import yaml

cfg_path = Path("agent_config.yaml")
with open(cfg_path, "r", encoding="utf-8") as f:
    data = yaml.safe_load(f)

if "huggingface" not in data.get("agent", {}):
    data["agent"]["huggingface"] = {
        "enabled": True,
        "llm": {
            "model": "meta-llama/Llama-3.1-8B-Instruct",
            "temperature": 0.3,
            "max_tokens": 150,
        },
        "tts": {
            "english_model": "facebook/mms-tts-eng",
            "hindi_model": "facebook/mms-tts-hin",
        },
        "sentiment": {
            "model": "distilbert/distilbert-base-uncased-finetuned-sst-2-english",
            "escalation_threshold": 0.75,
        },
        "rag_embeddings": {
            "model": "sentence-transformers/all-MiniLM-L6-v2",
        },
    }
    with open(cfg_path, "w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, sort_keys=False, allow_unicode=True)
    print("agent_config.yaml updated with huggingface block")
