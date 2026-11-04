"""Tool to send appointment confirmation or clinic address via SMS."""

from typing import Any, Dict
from agent.telephony.sms import get_sms_provider
from agent.tools.base import BaseTool


class SendSMSTool(BaseTool):
    name = "send_sms"
    description = "Send an SMS text message (e.g. appointment confirmation or clinic address) to the caller's phone."
    parameters = {
        "type": "object",
        "properties": {
            "phone_number": {"type": "string", "description": "Destination phone number with country code"},
            "message": {"type": "string", "description": "Content of the SMS to send"},
        },
        "required": ["phone_number", "message"],
    }

    async def execute(self, **kwargs) -> Dict[str, Any]:
        phone_number = kwargs["phone_number"]
        message = kwargs["message"]

        sms_provider = get_sms_provider()
        ok = await sms_provider.send_sms(to_number=phone_number, message=message)
        if ok:
            return {"success": True, "message": f"SMS sent to {phone_number}."}
        else:
            return {"success": False, "error": "Failed to deliver SMS via provider."}
