"""Tool for sending secure digital payment links (disabled by default)."""

from typing import Any, Dict, Optional
from agent.logger import setup_logger
from agent.tools.base import BaseTool

logger = setup_logger("tools.send_payment_link")


class SendPaymentLinkTool(BaseTool):
    """Tool to dispatch a secure payment link via SMS/WhatsApp. Disabled by default."""

    name = "send_payment_link"
    description = "Send a secure official payment link to the customer via SMS/WhatsApp. Never collects card or PIN directly."
    parameters = {
        "type": "object",
        "properties": {
            "phone_number": {
                "type": "string",
                "description": "Recipient phone number.",
            },
            "amount": {
                "type": "number",
                "description": "Payment amount due in INR.",
            },
            "purpose": {
                "type": "string",
                "description": "Invoice, bill, or service description.",
            },
        },
        "required": ["phone_number", "amount"],
    }

    def __init__(self, enabled: bool = False) -> None:
        self.enabled = enabled

    async def execute(
        self,
        phone_number: str,
        amount: float,
        purpose: Optional[str] = "Bill Payment",
        **kwargs: Any,
    ) -> Dict[str, Any]:
        if not self.enabled:
            logger.warning("Attempted to execute send_payment_link tool, but it is disabled by policy.")
            return {
                "success": False,
                "error": "Payment link gateway is currently disabled in agent security configuration.",
            }

        logger.info(f"Dispatched payment link to {phone_number} for ₹{amount:.2f}")
        return {
            "success": True,
            "link_id": f"PAY_{abs(hash(phone_number + str(amount))) % 100000:05d}",
            "amount": amount,
            "message": f"Secure payment link for ₹{amount:.2f} sent to {phone_number}.",
        }
