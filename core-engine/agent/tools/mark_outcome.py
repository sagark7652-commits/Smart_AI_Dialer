"""Tool for explicitly recording disposition outcome label and call summary."""

from typing import Any, Dict, Optional
from agent.logger import setup_logger
from agent.tools.base import BaseTool

logger = setup_logger("tools.mark_outcome")


class MarkOutcomeTool(BaseTool):
    """Tool to record final call outcome label (e.g. interested, not_interested, dnc, booked)."""

    name = "mark_outcome"
    description = "Tag the conversational outcome disposition (e.g. interested, booked, not_interested, callback_requested, dnc, resolved)."
    parameters = {
        "type": "object",
        "properties": {
            "outcome": {
                "type": "string",
                "enum": [
                    "interested",
                    "not_interested",
                    "booked",
                    "callback_requested",
                    "do_not_call",
                    "resolved",
                    "escalated",
                    "voicemail",
                ],
                "description": "Standardized disposition label.",
            },
            "notes": {
                "type": "string",
                "description": "Summary notes or reason for this outcome.",
            },
        },
        "required": ["outcome"],
    }

    async def execute(self, outcome: str, notes: Optional[str] = None, **kwargs: Any) -> Dict[str, Any]:
        logger.info(f"Marked call outcome: '{outcome}' (Notes: {notes})")
        return {
            "success": True,
            "outcome": outcome,
            "notes": notes or "",
            "message": f"Outcome marked as {outcome}.",
        }
