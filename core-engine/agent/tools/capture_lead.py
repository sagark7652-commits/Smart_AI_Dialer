"""Tool for capturing qualified leads, collected fields, and interest score."""

from typing import Any, Dict, Optional
from agent.logger import setup_logger
from agent.tools.base import BaseTool

logger = setup_logger("tools.capture_lead")


class CaptureLeadTool(BaseTool):
    """Tool to record qualified leads with customer details and interest level."""

    name = "capture_lead"
    description = "Store customer contact details, collected requirements, and interest level for sales and qualification."
    parameters = {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "Customer or contact person full name.",
            },
            "phone_number": {
                "type": "string",
                "description": "Primary phone number.",
            },
            "email": {
                "type": "string",
                "description": "Customer email address if provided.",
            },
            "interest_level": {
                "type": "string",
                "enum": ["high", "medium", "low", "unqualified"],
                "description": "Assessed prospect interest level.",
            },
            "notes": {
                "type": "string",
                "description": "Specific requirements, budget, or preferred plan details.",
            },
        },
        "required": ["name", "phone_number"],
    }

    async def execute(
        self,
        name: str,
        phone_number: str,
        email: Optional[str] = None,
        interest_level: str = "medium",
        notes: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        logger.info(f"Captured lead: {name} ({phone_number}), Interest: {interest_level}")
        return {
            "success": True,
            "lead_id": f"LEAD_{abs(hash(phone_number)) % 100000:05d}",
            "name": name,
            "phone_number": phone_number,
            "interest_level": interest_level,
            "message": f"Lead for {name} captured successfully.",
        }
