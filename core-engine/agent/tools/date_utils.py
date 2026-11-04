"""Indian relative date parsing utility for IST appointment scheduling."""

from datetime import datetime, timedelta, timezone
import re

IST_OFFSET = timezone(timedelta(hours=5, minutes=30))

DAY_NAME_MAP = {
    # English
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6,
    # Hindi (Latin & Devanagari)
    "somwar": 0, "mangalwar": 1, "budhwar": 2, "guruwar": 3, "shukrawar": 4, "shaniwar": 5, "raviwar": 6,
    "सोमवार": 0, "मंगलवार": 1, "बुधवार": 2, "गुरुवार": 3, "शुक्रवार": 4, "शनिवार": 5, "रविवार": 6,
    # Marathi (Latin & Devanagari)
    "somvar": 0, "mangalvar": 1, "budhvar": 2, "guruvar": 3, "shukravar": 4, "shanivar": 5, "ravivar": 6,
    "सोमवार": 0, "मंगळवार": 1, "बुधवार": 2, "गुरुवार": 3, "शुक्रवार": 4, "शनिवार": 5, "रविवार": 6,
}


def parse_relative_date(date_str: str) -> str:
    """Resolve relative dates (kal, parso, tomorrow, etc.) into ISO YYYY-MM-DD in IST.
    
    If unrecognized or already formatted (YYYY-MM-DD), returns the cleaned date string.
    """
    if not date_str:
        now_ist = datetime.now(timezone.utc).astimezone(IST_OFFSET).date()
        return (now_ist + timedelta(days=1)).isoformat()

    clean = date_str.strip().lower()

    # Check for direct YYYY-MM-DD
    if re.match(r"^\d{4}-\d{2}-\d{2}$", clean):
        return clean

    now_ist = datetime.now(timezone.utc).astimezone(IST_OFFSET).date()

    # Today / Aaj
    if clean in ("today", "aaj", "आज", "aajcha", "आजचा"):
        return now_ist.isoformat()

    # Tomorrow / Kal / Udya
    if clean in ("tomorrow", "kal", "कल", "udya", "उद्या"):
        return (now_ist + timedelta(days=1)).isoformat()

    # Day after tomorrow / Parso / Parva
    if clean in ("day after tomorrow", "parso", "परसों", "parva", "परवा"):
        return (now_ist + timedelta(days=2)).isoformat()

    # Days of the week (e.g. "next monday", "somwar", "सोमवार")
    for name, target_weekday in DAY_NAME_MAP.items():
        if name in clean:
            days_ahead = target_weekday - now_ist.weekday()
            if days_ahead <= 0:  # Target day already happened this week
                days_ahead += 7
            if "next" in clean and days_ahead < 7:
                days_ahead += 7
            return (now_ist + timedelta(days=days_ahead)).isoformat()

    return clean
