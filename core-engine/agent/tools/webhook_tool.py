"""Generic webhook tool that posts payload to a configured external URL."""

from typing import Any, Dict, Optional
import httpx
from agent.tools.base import BaseTool


class WebhookTool(BaseTool):
    name = "trigger_webhook"
    description = "Trigger an external HTTP webhook API with JSON payload."
    parameters = {
        "type": "object",
        "properties": {
            "endpoint_url": {"type": "string", "description": "The destination HTTP/HTTPS endpoint URL"},
            "payload": {"type": "object", "description": "Arbitrary key-value JSON data to post"},
        },
        "required": ["endpoint_url", "payload"],
    }

    async def execute(self, **kwargs) -> Dict[str, Any]:
        url = kwargs["endpoint_url"]
        payload = kwargs.get("payload", {})
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.post(url, json=payload)
                return {
                    "success": res.status_code in (200, 201, 202, 204),
                    "status_code": res.status_code,
                    "response": res.text[:200],
                }
        except Exception as e:
            return {"success": False, "error": f"Webhook execution error: {e}"}
