"""Human operator / agent call transfer tool with callback request fallback."""

from typing import Any, Dict, Optional
from agent.db import get_db
from agent.logger import setup_logger
from agent.tools.base import BaseTool

logger = setup_logger("tools.transfer")


class TransferCallTool(BaseTool):
    name = "transfer_call"
    description = "Transfer the caller to a human doctor, receptionist, or support specialist when requested or needed."
    parameters = {
        "type": "object",
        "properties": {
            "destination": {"type": "string", "description": "Phone number or queue identifier to forward the call to"},
            "reason": {"type": "string", "description": "Reason for the transfer (e.g. caller requested human, complex query, emergency)"},
            "caller_phone": {"type": "string", "description": "Caller's phone number for fallback callback"},
        },
        "required": ["destination"],
    }

    def __init__(self, telephony_provider=None, call_id: Optional[str] = None):
        self.telephony_provider = telephony_provider
        self.call_id = call_id

    async def execute(self, **kwargs) -> Dict[str, Any]:
        destination = kwargs["destination"]
        reason = kwargs.get("reason", "Operator assistance requested")
        caller_phone = kwargs.get("caller_phone", destination)

        success = False
        if self.telephony_provider:
            success = await self.telephony_provider.transfer_call(
                call_id=self.call_id or "", destination=destination
            )
        else:
            # Simulated environment
            success = True

        if success:
            return {
                "success": True,
                "message": f"Transferring your call to our specialist at {destination}. Please stay on the line.",
            }
        else:
            # Fallback: Save callback request
            db = get_db()
            cb_id = await db.create_callback(
                phone_number=caller_phone,
                caller_name=kwargs.get("caller_name", "Caller"),
                reason=reason,
            )
            return {
                "success": False,
                "fallback_callback_id": cb_id,
                "message": (
                    "I am sorry, our line is currently busy. "
                    "I have recorded a priority callback request, and our staff will call you shortly."
                ),
            }
