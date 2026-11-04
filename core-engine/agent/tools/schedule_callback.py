"""Tool for scheduling a return call with preferred date/time window."""

from typing import Any, Dict, Optional
from agent.logger import setup_logger
from agent.tools.base import BaseTool

logger = setup_logger("tools.schedule_callback")


class ScheduleCallbackTool(BaseTool):
    """Tool to schedule a callback when prospect is busy, requests later contact, or needs verification."""

    name = "schedule_callback"
    description = "Schedule a return phone call at customer's preferred date, time window, or convenience."
    parameters = {
        "type": "object",
        "properties": {
            "phone_number": {
                "type": "string",
                "description": "Phone number to reach the customer.",
            },
            "preferred_time": {
                "type": "string",
                "description": "Requested date or time (e.g., 'tomorrow morning', 'after 5 PM', 'Monday 2 PM').",
            },
            "reason": {
                "type": "string",
                "description": "Topic to discuss or reason for callback.",
            },
        },
        "required": ["preferred_time"],
    }

    async def execute(
        self,
        preferred_time: str,
        phone_number: Optional[str] = None,
        reason: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        caller_phone = phone_number or kwargs.get("caller_number") or "+919800000000"
        prev_call_id = kwargs.get("call_id") or kwargs.get("previous_call_id")
        caller_name = kwargs.get("caller_name")

        from agent.callback_scheduler import get_callback_scheduler
        scheduler = get_callback_scheduler()

        try:
            res = await scheduler.schedule(
                phone_number=caller_phone,
                preferred_time_str=preferred_time,
                reason=reason,
                previous_call_id=prev_call_id,
                caller_name=caller_name,
            )
            return res
        except Exception as e:
            logger.error(f"Error persisting callback: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": "We could not schedule the callback automatically, our reception will assist you.",
            }
