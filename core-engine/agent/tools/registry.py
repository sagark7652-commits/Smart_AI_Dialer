"""Tool registry managing tool definitions, schemas, and async execution."""

import asyncio
from typing import Any, Dict, List, Optional
from agent.logger import setup_logger
from agent.tools.base import BaseTool
from agent.tools.book_appointment import BookAppointmentTool
from agent.tools.capture_lead import CaptureLeadTool
from agent.tools.check_availability import CheckAvailabilityTool
from agent.tools.mark_outcome import MarkOutcomeTool
from agent.tools.schedule_callback import ScheduleCallbackTool
from agent.tools.send_payment_link import SendPaymentLinkTool
from agent.tools.send_sms import SendSMSTool
from agent.tools.transfer_call import TransferCallTool
from agent.tools.webhook_tool import WebhookTool

logger = setup_logger("tools.registry")


class ToolRegistry:
    """Registry managing available tools and their OpenAI/Groq schemas."""

    def __init__(self) -> None:
        self._tools: Dict[str, BaseTool] = {}
        # Register core suite of tools
        self.register(BookAppointmentTool())
        self.register(CheckAvailabilityTool())
        self.register(CaptureLeadTool())
        self.register(ScheduleCallbackTool())
        self.register(MarkOutcomeTool())
        self.register(TransferCallTool())
        self.register(SendSMSTool())  # Disabled by default in mode config
        self.register(SendPaymentLinkTool(enabled=False))  # Disabled by default
        self.register(WebhookTool())

    def register(self, tool: BaseTool) -> None:
        """Register a new tool instance."""
        self._tools[tool.name] = tool
        logger.debug(f"Registered tool: {tool.name}")

    def get_tool(self, name: str) -> Optional[BaseTool]:
        """Look up tool by name."""
        return self._tools.get(name)

    def get_schemas(self, enabled_names: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Return OpenAI-compatible function calling tool schemas."""
        if enabled_names is None:
            return [tool.to_schema() for tool in self._tools.values()]
        return [
            self._tools[name].to_schema()
            for name in enabled_names
            if name in self._tools
        ]

    async def execute(self, name: str, args: Dict[str, Any], timeout_sec: float = 6.0) -> Dict[str, Any]:
        """Execute tool by name with timeout and error handling."""
        tool = self.get_tool(name)
        if not tool:
            logger.error(f"Attempted to execute unregistered tool: {name}")
            return {"success": False, "error": f"Tool '{name}' not found."}

        try:
            logger.info(f"Executing tool '{name}' with args: {args}")
            result = await asyncio.wait_for(tool.execute(**args), timeout=timeout_sec)
            logger.info(f"Tool '{name}' completed successfully: {result}")
            return result
        except asyncio.TimeoutError:
            logger.error(f"Tool '{name}' timed out after {timeout_sec}s")
            return {"success": False, "error": f"Tool '{name}' timed out. Please try again."}
        except Exception as e:
            logger.error(f"Error executing tool '{name}': {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    def get_filler_phrase(language: str = "hi") -> str:
        """Return conversational filler line to speak while tool is running."""
        lang = language.lower()
        if "mr" in lang:
            return "एक सेकंद, मी माहिती तपासून सांगते..."
        elif "hi" in lang:
            return "एक सेकंड, मैं चेक करके बताती हूँ..."
        return "One moment please, let me check that for you..."


_global_registry = ToolRegistry()


def get_tool_registry() -> ToolRegistry:
    """Return default tool registry singleton."""
    return _global_registry
