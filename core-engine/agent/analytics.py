"""Post-Call Analysis: Summarization, Sentiment Analysis, Outcome Categorization, and Entity Extraction."""

from datetime import datetime
import json
import re
from typing import Any, Dict, List, Optional
from agent.db import get_db
from agent.llm.base import BaseLLM, ChatMessage
from agent.llm.groq_llm import GroqLLM
from agent.logger import setup_logger

logger = setup_logger("analytics")

VALID_OUTCOMES = [
    "booked",
    "not_interested",
    "callback",
    "transferred",
    "info_provided",
    "failed",
]

ANALYSIS_SYSTEM_PROMPT = """You are an expert conversational AI telephony quality analyst.
Analyze the following phone call transcript between an AI Voice Agent and a Caller.
Return ONLY a valid JSON object with the following exact keys:
{
  "summary": "1 to 2 sentences summarizing the call interaction and purpose",
  "outcome": "Must be strictly one of: 'booked', 'not_interested', 'callback', 'transferred', 'info_provided', 'failed'",
  "sentiment": "Must be strictly one of: 'positive', 'neutral', 'negative'",
  "extracted_data": {
    "caller_name": "Name of caller if mentioned, else null",
    "phone_number": "Phone number if mentioned, else null",
    "appointment_date": "Date if mentioned, else null",
    "appointment_time": "Time slot if mentioned, else null",
    "service": "Service requested if mentioned, else null",
    "notes": "Any other key details"
  }
}
Do not include any explanation or markdown tags outside the JSON.
"""


class PostCallAnalyzer:
    """Performs asynchronous post-call intelligence and persists outcomes."""

    def __init__(self, llm: Optional[BaseLLM] = None) -> None:
        self.llm = llm or GroqLLM()
        self.db = get_db()

    def _fallback_heuristic_analysis(self, transcript_text: str) -> Dict[str, Any]:
        """Fast offline rule-based fallback analysis."""
        lower = transcript_text.lower()
        if not transcript_text.strip():
            return {
                "summary": "Call ended with no spoken interaction.",
                "outcome": "failed",
                "sentiment": "neutral",
                "extracted_data": {},
            }

        # Outcome detection
        if "booked" in lower or "appointment has been booked" in lower or "confirm" in lower:
            outcome = "booked"
        elif "transfer" in lower or "operator" in lower:
            outcome = "transferred"
        elif "call back" in lower or "callback" in lower:
            outcome = "callback"
        elif "not interested" in lower or "no thanks" in lower or "don't call" in lower:
            outcome = "not_interested"
        else:
            outcome = "info_provided"

        # Sentiment detection
        if any(w in lower for w in ["thank", "great", "excellent", "dhanyavaad", "shukriya", "accha"]):
            sentiment = "positive"
        elif any(w in lower for w in ["bad", "terrible", "useless", "stupid", "bakwaas", "gussa"]):
            sentiment = "negative"
        else:
            sentiment = "neutral"

        # Entity extraction heuristics
        extracted = {}
        phone_match = re.search(r"(\+?91[\s-]?)?[6-9]\d{9}", transcript_text)
        if phone_match:
            extracted["phone_number"] = phone_match.group(0).replace(" ", "")

        summary = f"Caller inquired about clinic services. Outcome categorized as {outcome}."
        return {
            "summary": summary,
            "outcome": outcome,
            "sentiment": sentiment,
            "extracted_data": extracted,
        }

    @staticmethod
    def compute_call_flags(
        transcript_turns: List[Dict[str, Any]],
        duration_sec: float,
        all_latencies: Optional[List[Dict[str, Any]]] = None,
        silence_prompt_count: int = 0,
        tool_results: Optional[List[Dict[str, Any]]] = None,
        injection_flags: Optional[List[str]] = None,
        sentiment: Optional[str] = None,
        configured_languages: Optional[List[str]] = None,
        stt_confidences: Optional[List[Optional[float]]] = None,
    ) -> List[str]:
        """Compute post-call review flags based on conversation heuristics and anomalies."""
        import difflib
        flags = []

        # 1. Loop detected: repeated replies by the agent
        agent_turns = [
            t.get("text", "").strip()
            for t in transcript_turns
            if (t.get("speaker") or t.get("role")) == "agent" and len(t.get("text", "").strip().split()) > 3
        ]
        loop_found = False
        for i in range(len(agent_turns)):
            for j in range(i + 1, len(agent_turns)):
                ratio = difflib.SequenceMatcher(None, agent_turns[i], agent_turns[j]).ratio()
                if ratio > 0.82:
                    flags.append("loop_detected")
                    loop_found = True
                    break
            if loop_found:
                break

        # 2. Many reprompts (>= 3 silence reprompts)
        if silence_prompt_count >= 3:
            flags.append("many_reprompts")

        # 3. Long silence (> 10s gap between turns)
        if len(transcript_turns) >= 2:
            try:
                for idx in range(len(transcript_turns) - 1):
                    t1_str = transcript_turns[idx].get("timestamp")
                    t2_str = transcript_turns[idx + 1].get("timestamp")
                    if t1_str and t2_str:
                        dt1 = datetime.strptime(t1_str, "%Y-%m-%d %H:%M:%S")
                        dt2 = datetime.strptime(t2_str, "%Y-%m-%d %H:%M:%S")
                        if abs((dt2 - dt1).total_seconds()) > 10.0:
                            flags.append("long_silence")
                            break
            except Exception:
                pass

        # 4. Low STT confidence (if provider gives it; else mark as NOT MEASURED)
        if stt_confidences:
            valid_confs = [c for c in stt_confidences if c is not None]
            if valid_confs and any(c < 0.65 for c in valid_confs):
                flags.append("low_stt_confidence")
        else:
            # Note: Provider didn't supply confidence stream -> NOT MEASURED
            pass

        # 5. High latency turns (turn latency > 2.5s / 2500ms)
        if all_latencies:
            for lat in all_latencies:
                first_audio = lat.get("first_audio_ms") or lat.get("latency_ms") or 0.0
                if first_audio > 2500.0:
                    flags.append("high_latency_turns")
                    break

        # 6. Caller hung up early (< 15s on answered call)
        if 0 < duration_sec < 15.0 and len(transcript_turns) >= 1:
            flags.append("caller_hung_up_early")

        # 7. Tool error
        if tool_results:
            for tr in tool_results:
                if isinstance(tr, dict) and (tr.get("success") is False or "error" in tr):
                    flags.append("tool_error")
                    break

        # 8. Negative sentiment
        if sentiment == "negative":
            flags.append("negative_sentiment")

        # 9. Transfer requested
        combined_text = " ".join(t.get("text", "") for t in transcript_turns).lower()
        if any(w in combined_text for w in ["transfer", "human agent", "insan se", "manager se", "senior se"]):
            flags.append("transfer_requested")

        # 10. Wrong language
        for t in transcript_turns:
            if (t.get("speaker") or t.get("role")) in ("caller", "user"):
                txt = t.get("text", "")
                # Check for other Indic / foreign scripts outside Devanagari and Latin
                if any(
                    ("\u0A80" <= c <= "\u0AFF") or  # Gujarati
                    ("\u0980" <= c <= "\u09FF") or  # Bengali
                    ("\u0B80" <= c <= "\u0BFF") or  # Tamil
                    ("\u0C00" <= c <= "\u0C7F") or  # Telugu
                    ("\u0C80" <= c <= "\u0CFF") or  # Kannada
                    ("\u0D00" <= c <= "\u0D7F")     # Malayalam
                    for c in txt
                ):
                    flags.append("wrong_language")
                    break

                # Common phrases in unconfigured languages (e.g. Gujarati, Punjabi, Tamil romanized)
                lower_txt = txt.lower()
                unconfigured_markers = [
                    "tamaru naam", "shu che", "tame kya", "kem cho", "maja ma",
                    "ki khobor", "kemon acho", "tumi kothay", "ami bhalo",
                    "epdi irukeenga", "vanakkam", "enna panreenga",
                    "ela unnaru", "bagunnara",
                    "kiddan", "tussi ki",
                ]
                if any(m in lower_txt for m in unconfigured_markers):
                    flags.append("wrong_language")
                    break

        # 11. Injection attempt
        if injection_flags:
            flags.extend([f for f in injection_flags if f not in flags])

        # Deduplicate while preserving order
        seen = set()
        unique_flags = []
        for f in flags:
            if f not in seen:
                seen.add(f)
                unique_flags.append(f)

        return unique_flags

    async def analyze_call(
        self,
        call_id: str,
        transcript_turns: List[Dict[str, Any]],
        duration_sec: float = 0.0,
        all_latencies: Optional[List[Dict[str, Any]]] = None,
        silence_prompt_count: int = 0,
        tool_results: Optional[List[Dict[str, Any]]] = None,
        injection_flags: Optional[List[str]] = None,
        configured_languages: Optional[List[str]] = None,
        stt_confidences: Optional[List[Optional[float]]] = None,
    ) -> Dict[str, Any]:
        """Analyze full conversation transcript turns, compute quality review flags, and persist to database."""
        if not transcript_turns:
            result = self._fallback_heuristic_analysis("")
            flags = self.compute_call_flags(
                transcript_turns=[],
                duration_sec=duration_sec,
                silence_prompt_count=silence_prompt_count,
            )
            await self.db.save_post_call_analysis(
                call_id=call_id,
                summary=result["summary"],
                outcome=result["outcome"],
                sentiment=result["sentiment"],
                extracted_data=result["extracted_data"],
                needs_review=len(flags) > 0,
                flag_reasons=flags,
            )
            result["needs_review"] = len(flags) > 0
            result["flag_reasons"] = flags
            return result

        formatted_dialogue = "\n".join(
            [f"{turn.get('speaker', turn.get('role', 'unknown')).upper()}: {turn.get('text', '')}"
             for turn in transcript_turns]
        )

        try:
            prompt_message = ChatMessage(
                role="user",
                content=f"Call Transcript:\n\n{formatted_dialogue}",
            )
            raw_response = ""
            async for token in self.llm.generate_stream(
                messages=[prompt_message],
                system_prompt=ANALYSIS_SYSTEM_PROMPT,
            ):
                if isinstance(token, str):
                    raw_response += token

            clean_json = raw_response.strip()
            # Strip markdown code blocks if model wrapped it
            if clean_json.startswith("```"):
                clean_json = re.sub(r"^```(?:json)?\n?", "", clean_json)
                clean_json = re.sub(r"\n?```$", "", clean_json)

            data = json.loads(clean_json)
            summary = data.get("summary", "Call completed.")
            outcome = data.get("outcome", "info_provided")
            if outcome not in VALID_OUTCOMES:
                outcome = "info_provided"
            sentiment = data.get("sentiment", "neutral")
            extracted_data = data.get("extracted_data", {})

            result = {
                "summary": summary,
                "outcome": outcome,
                "sentiment": sentiment,
                "extracted_data": extracted_data,
            }

        except Exception as e:
            logger.warning(f"LLM post-call analysis failed for {call_id}: {e}. Using heuristics.")
            result = self._fallback_heuristic_analysis(formatted_dialogue)

        # Compute quality review flags
        flags = self.compute_call_flags(
            transcript_turns=transcript_turns,
            duration_sec=duration_sec,
            all_latencies=all_latencies,
            silence_prompt_count=silence_prompt_count,
            tool_results=tool_results,
            injection_flags=injection_flags,
            sentiment=result.get("sentiment"),
            configured_languages=configured_languages,
            stt_confidences=stt_confidences,
        )
        needs_review = len(flags) > 0
        result["needs_review"] = needs_review
        result["flag_reasons"] = flags

        # Persist to database
        try:
            await self.db.save_post_call_analysis(
                call_id=call_id,
                summary=result["summary"],
                outcome=result["outcome"],
                sentiment=result["sentiment"],
                extracted_data=result["extracted_data"],
                needs_review=needs_review,
                flag_reasons=flags,
            )
            logger.info(
                f"Post-call analysis persisted for {call_id}: outcome={result['outcome']}, "
                f"sentiment={result['sentiment']}, needs_review={needs_review}, flags={flags}"
            )
        except Exception as e:
            logger.error(f"Failed to persist post-call analysis for {call_id}: {e}")

        return result
