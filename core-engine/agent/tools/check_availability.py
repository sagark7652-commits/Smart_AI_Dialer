"""Tool to query available appointment slots for a given date in SQLite."""

from typing import Any, Dict
from agent.db import get_db
from agent.tools.base import BaseTool
from agent.tools.date_utils import parse_relative_date


class CheckAvailabilityTool(BaseTool):
    name = "check_availability"
    description = "Check doctor consultation availability and open appointment slots for a given date."
    parameters = {
        "type": "object",
        "properties": {
            "date": {"type": "string", "description": "Date to query availability for (e.g. today, tomorrow, kal, YYYY-MM-DD)"},
        },
        "required": ["date"],
    }

    ALL_CLINIC_SLOTS = ["10:30 AM", "12:00 PM", "3:30 PM", "6:00 PM", "7:30 PM"]

    async def execute(self, **kwargs) -> Dict[str, Any]:
        raw_date = kwargs.get("date", "tomorrow")
        target_date = parse_relative_date(raw_date)

        try:
            db = get_db()
            booked = await db.get_appointments_for_date(target_date)
            booked_slots = {b.time_slot for b in booked}
            open_slots = [s for s in self.ALL_CLINIC_SLOTS if s not in booked_slots]
        except Exception:
            open_slots = list(self.ALL_CLINIC_SLOTS)

        if not open_slots:
            return {
                "success": True,
                "date": raw_date,
                "parsed_date": target_date,
                "available_slots": [],
                "message": f"{raw_date} ({target_date}) ko sabhi slots booked hain. Kripya koi doosri taareekh chunein.",
            }

        return {
            "success": True,
            "date": raw_date,
            "parsed_date": target_date,
            "available_slots": open_slots,
            "message": f"On {raw_date}, Dr. Sharma has open slots at: {', '.join(open_slots)}.",
        }
