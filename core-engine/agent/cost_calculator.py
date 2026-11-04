"""Per-Call Cost and Component Usage Calculator."""

from dataclasses import dataclass
from typing import Dict
from agent.config import get_settings


@dataclass
class CallCostBreakdown:
    call_id: str
    duration_sec: float
    stt_seconds: float
    llm_prompt_tokens: int
    llm_completion_tokens: int
    tts_characters: int
    stt_cost_usd: float
    llm_cost_usd: float
    tts_cost_usd: float
    telephony_cost_usd: float
    total_cost_usd: float

    def to_dict(self) -> Dict[str, float]:
        return {
            "call_id": self.call_id,
            "duration_sec": self.duration_sec,
            "stt_cost_usd": round(self.stt_cost_usd, 5),
            "llm_cost_usd": round(self.llm_cost_usd, 5),
            "tts_cost_usd": round(self.tts_cost_usd, 5),
            "telephony_cost_usd": round(self.telephony_cost_usd, 5),
            "total_cost_usd": round(self.total_cost_usd, 5),
        }


class CostCalculator:
    """Calculates component-level and aggregate operational cost in USD."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def calculate_call_cost(
        self,
        call_id: str,
        duration_sec: float,
        stt_seconds: float,
        prompt_tokens: int,
        completion_tokens: int,
        tts_chars: int,
    ) -> CallCostBreakdown:
        stt_cost = (stt_seconds / 60.0) * self.settings.rate_stt_per_minute
        llm_in_cost = (prompt_tokens / 1000.0) * self.settings.rate_llm_input_1k
        llm_out_cost = (completion_tokens / 1000.0) * self.settings.rate_llm_output_1k
        llm_cost = llm_in_cost + llm_out_cost
        tts_cost = (tts_chars / 1000.0) * self.settings.rate_tts_1k_chars
        telephony_cost = (duration_sec / 60.0) * self.settings.rate_telephony_per_minute

        total_cost = stt_cost + llm_cost + tts_cost + telephony_cost

        return CallCostBreakdown(
            call_id=call_id,
            duration_sec=duration_sec,
            stt_seconds=stt_seconds,
            llm_prompt_tokens=prompt_tokens,
            llm_completion_tokens=completion_tokens,
            tts_characters=tts_chars,
            stt_cost_usd=stt_cost,
            llm_cost_usd=llm_cost,
            tts_cost_usd=tts_cost,
            telephony_cost_usd=telephony_cost,
            total_cost_usd=total_cost,
        )
