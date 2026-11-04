"""Application configuration loaded from environment variables."""

from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for the calling agent engine."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # General
    app_env: str = "development"
    log_level: str = "INFO"
    port: int = 8000
    public_url: str = "http://localhost:8000"
    database_url: str = "sqlite:///./calling_agent.db"
    api_key_secret: str = "default-insecure-secret"

    # Provider selections
    stt_provider: str = "deepgram"
    llm_provider: str = "openai"
    tts_provider: str = "openai"
    telephony_provider: str = "twilio"

    # LLM Settings
    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    groq_api_key: Optional[str] = None
    llm_model: str = "gpt-4o-mini"
    huggingface_api_key: Optional[str] = None
    huggingface_llm_model: str = "meta-llama/Llama-3.1-8B-Instruct"
    huggingface_tts_model: str = "facebook/mms-tts-eng"
    huggingface_sentiment_model: str = "distilbert/distilbert-base-uncased-finetuned-sst-2-english"

    # STT Settings
    deepgram_api_key: Optional[str] = None
    deepgram_model: str = "nova-3"
    sarvam_api_key: Optional[str] = None

    # TTS Settings
    cartesia_api_key: Optional[str] = None
    cartesia_voice_id: Optional[str] = None
    cartesia_model_id: str = "sonic-3.6"
    sarvam_model: str = "bulbul:v3"
    sarvam_speaker: str = "meera"
    elevenlabs_api_key: Optional[str] = None
    elevenlabs_voice_id: Optional[str] = "cgSgspJ2msm6clMCkdW9"

    # Language Policy
    language_policy: str = "strict"  # strict | follow_caller
    default_language: str = "hi"

    # Audio Engine & DSP
    use_soxr_resampler: bool = True

    # Telephony: Twilio
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_phone_number: Optional[str] = None

    # Telephony: Exotel
    exotel_account_sid: Optional[str] = None
    exotel_api_key: Optional[str] = None
    exotel_api_token: Optional[str] = None
    exotel_subdomain: Optional[str] = None
    exotel_caller_id: Optional[str] = None

    # Webhooks & Security
    webhook_secret: str = "calling-agent-hmac-secret-key"

    # Concurrency & Scaling
    max_concurrent_calls: int = 3
    max_overload_queue_size: int = 10

    # Usage Cost Calculation Rates (USD)
    rate_stt_per_minute: float = 0.0043
    rate_llm_input_1k: float = 0.00059
    rate_llm_output_1k: float = 0.00079
    rate_tts_1k_chars: float = 0.015
    rate_telephony_per_minute: float = 0.014

    # Cost Controls & Financial Guards
    max_call_duration_sec: int = 3600
    max_call_cost_inr: float = 500.00
    usd_to_inr_rate: float = 83.0
    max_call_cost_usd: float = 6.00
    enable_cost_guard: bool = False


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
