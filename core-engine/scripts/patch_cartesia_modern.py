"""Update CartesiaTTS to use modern generate API with en-IN locale and happy emotion."""
from pathlib import Path

p = Path("agent/tts/cartesia_tts.py")
text = p.read_text(encoding="utf-8")

old_code = """        lang_code = (language or "en").lower()
        if "hi" in lang_code:
            cartesia_lang = "hi"
        elif "mr" in lang_code:
            cartesia_lang = "hi"  # Cartesia Sonic supports Hindi/Indic phonetics
        else:
            cartesia_lang = "en"

        try:
            audio_stream = await self.client.tts.bytes(
                model_id=self.model_id,
                transcript=normalized_text,
                voice={"mode": "id", "id": self.voice_id},
                output_format={
                    "container": "raw",
                    "encoding": "pcm_s16le",
                    "sample_rate": self.sample_rate,
                },
                language=cartesia_lang,
            )

            async for chunk in audio_stream:
                if chunk:
                    frame_size = 2048
                    for i in range(0, len(chunk), frame_size):
                        yield chunk[i : i + frame_size]

        except Exception as e:
            logger.error(f"Cartesia TTS error: {e}")
            raise e"""

new_code = """        lang_code = (language or "en").lower()
        call_kwargs = {
            "model_id": self.model_id,
            "transcript": normalized_text,
            "voice": {"mode": "id", "id": self.voice_id},
            "output_format": {
                "container": "raw",
                "encoding": "pcm_s16le",
                "sample_rate": self.sample_rate,
            },
            "generation_config": {"emotion": "happy", "speed": 1.0},
        }

        if "en" in lang_code:
            call_kwargs["locale"] = "en-IN"
        elif "hi" in lang_code or "mr" in lang_code:
            call_kwargs["language"] = "hi"
        else:
            call_kwargs["language"] = "en"

        try:
            res = await self.client.tts.generate(**call_kwargs)
            audio_bytes = await res.read()
            if audio_bytes:
                frame_size = 2048
                for i in range(0, len(audio_bytes), frame_size):
                    yield audio_bytes[i : i + frame_size]
        except Exception as e:
            logger.warning(f"Cartesia generate API fallback to bytes(): {e}")
            try:
                fallback_lang = "hi" if ("hi" in lang_code or "mr" in lang_code) else "en"
                audio_stream = await self.client.tts.bytes(
                    model_id=self.model_id,
                    transcript=normalized_text,
                    voice={"mode": "id", "id": self.voice_id},
                    output_format={
                        "container": "raw",
                        "encoding": "pcm_s16le",
                        "sample_rate": self.sample_rate,
                    },
                    language=fallback_lang,
                )
                async for chunk in audio_stream:
                    if chunk:
                        frame_size = 2048
                        for i in range(0, len(chunk), frame_size):
                            yield chunk[i : i + frame_size]
            except Exception as ex2:
                logger.error(f"Cartesia TTS fatal error: {ex2}")
                raise ex2"""

text_norm = text.replace("\r\n", "\n")
old_code_norm = old_code.replace("\r\n", "\n")
new_code_norm = new_code.replace("\r\n", "\n")

assert old_code_norm in text_norm
text_norm = text_norm.replace(old_code_norm, new_code_norm, 1)

p.write_text(text_norm.replace("\n", "\r\n"), encoding="utf-8")
print("cartesia_tts.py updated with en-IN locale and happy natural emotion!")
