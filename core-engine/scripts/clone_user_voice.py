"""Script to clone user audio clip using Cartesia or ElevenLabs Instant Voice Cloning."""

import os
import sys
from pathlib import Path

# Insert project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from agent.config import get_settings
from agent.logger import setup_logger

logger = setup_logger("voice.clone")

AUDIO_PATH = Path("C:/Users/Bhagwat/.gemini/antigravity/brain/5470f1b6-c83c-4786-abbb-9dae4ca68457/.user_uploaded/uploaded_media_1793624284619.m4a")


def clone_with_cartesia(api_key: str, audio_path: Path):
    from cartesia import Cartesia
    print(f"Connecting to Cartesia API with audio: {audio_path.name}...")
    client = Cartesia(api_key=api_key)

    with open(audio_path, "rb") as f:
        voice = client.voices.clone(
            clip=f,
            language="en",
            name="custom-english-lady-voice",
            description="Custom cloned young Indian female voice from user recording (warm, enthusiastic, sweet)",
        )
    print(f"SUCCESS: Cartesia Voice Cloned successfully!")
    print(f"Voice ID: {voice.id}")
    print(f"Voice Name: {voice.name}")
    return voice.id


def clone_with_elevenlabs(api_key: str, audio_path: Path):
    import httpx
    print(f"Connecting to ElevenLabs API with audio: {audio_path.name}...")
    url = "https://api.elevenlabs.io/v1/voices/add"
    headers = {"xi-api-key": api_key}
    data = {
        "name": "custom-english-lady-voice",
        "description": "Custom cloned young Indian female voice from user recording (warm, enthusiastic, sweet)",
    }
    with open(audio_path, "rb") as f:
        files = [("files", (audio_path.name, f, "audio/mp4"))]
        resp = httpx.post(url, headers=headers, data=data, files=files, timeout=60.0)
    if resp.status_code != 200:
        raise RuntimeError(f"ElevenLabs error {resp.status_code}: {resp.text}")
    res = resp.json()
    voice_id = res.get("voice_id")
    print(f"SUCCESS: ElevenLabs Voice Cloned successfully!")
    print(f"Voice ID: {voice_id}")
    return voice_id


def update_config_with_voice(voice_id: str, provider: str):
    import yaml
    cfg_file = Path("agent_config.yaml")
    with open(cfg_file, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    data["agent"]["voices"]["english"]["female"] = "custom_cloned"
    data["agent"]["voices"]["english"]["voice_identifier"] = voice_id
    data["agent"]["voices"]["english"]["provider"] = provider
    data["agent"]["voices"]["english"]["status"] = "locked"

    with open(cfg_file, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, sort_keys=False)
    print(f"Updated agent_config.yaml with {provider} voice_id: {voice_id}")


def main():
    settings = get_settings()
    if not AUDIO_PATH.exists():
        print(f"ERROR: Audio file not found at {AUDIO_PATH}")
        sys.exit(1)

    print(f"Found user audio clip: {AUDIO_PATH} ({AUDIO_PATH.stat().st_size} bytes)")

    if settings.cartesia_api_key:
        voice_id = clone_with_cartesia(settings.cartesia_api_key, AUDIO_PATH)
        update_config_with_voice(voice_id, "cartesia")
    elif settings.elevenlabs_api_key:
        voice_id = clone_with_elevenlabs(settings.elevenlabs_api_key, AUDIO_PATH)
        update_config_with_voice(voice_id, "elevenlabs")
    else:
        print("NO_KEY: Please provide CARTESIA_API_KEY or ELEVENLABS_API_KEY in .env to perform instant cloning.")
        sys.exit(2)


if __name__ == "__main__":
    main()
