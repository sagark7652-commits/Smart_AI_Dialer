"""Tool to schedule and book dental appointments in SQLite with conflict detection."""

from typing import Any, Dict
from agent.db import get_db
from agent.tools.base import BaseTool
from agent.tools.date_utils import parse_relative_date


class BookAppointmentTool(BaseTool):
    name = "book_appointment"
    description = "Book a dental appointment for a patient and save it to the system."
    parameters = {
        "type": "object",
        "properties": {
            "caller_name": {"type": "string", "description": "Full name of the patient"},
            "phone_number": {"type": "string", "description": "10-digit phone number with country code"},
            "date": {"type": "string", "description": "Appointment date (YYYY-MM-DD or relative like tomorrow, kal, parso)"},
            "time_slot": {"type": "string", "description": "Preferred time slot (e.g. 10:30 AM, 4:00 PM)"},
            "service": {"type": "string", "description": "Requested dental procedure (e.g. Root Canal, Consultation, Cleaning)"},
        },
        "required": ["caller_name", "phone_number", "date", "time_slot", "service"],
    }

    async def execute(self, **kwargs) -> Dict[str, Any]:
        raw_date = kwargs.get("date", "tomorrow")
        parsed_date = parse_relative_date(raw_date)
        time_slot = kwargs["time_slot"]
        caller_name = kwargs["caller_name"]
        phone_number = kwargs["phone_number"]
        service = kwargs.get("service", "Consultation")

        try:
            db = get_db()
            # 1. Conflict detection (no double booking)
            has_conflict = await db.check_appointment_conflict(parsed_date, time_slot)
            if has_conflict:
                return {
                    "success": False,
                    "error": "conflict",
                    "message": (
                        f"Slot conflict: The time slot {time_slot} on {raw_date} ({parsed_date}) is already booked. "
                        "Please select another slot."
                    ),
                }

            # 2. Persist appointment in SQLite
            appt_id = await db.create_appointment(
                caller_name=caller_name,
                phone_number=phone_number,
                date=parsed_date,
                time_slot=time_slot,
                service=service,
            )

            # 3. Confirmation read-back message
            return {
                "success": True,
                "appointment_id": appt_id,
                "date": parsed_date,
                "time_slot": time_slot,
                "message": f"Appointment booked successfully for {caller_name} on {raw_date} at {time_slot}.",
                "confirmation_readback": f"Main aapka appointment {raw_date} ko {time_slot} baje confirm kar rahi hoon.",
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
