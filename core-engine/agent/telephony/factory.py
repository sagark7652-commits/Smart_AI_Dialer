"""Factory to instantiate the configured Telephony provider."""

from typing import Optional
from agent.config import get_settings
from agent.telephony.base import BaseTelephonyProvider
from agent.telephony.twilio_provider import TwilioProvider
from agent.telephony.exotel_provider import ExotelProvider


def get_telephony_provider(provider_name: Optional[str] = None) -> BaseTelephonyProvider:
    """Instantiate and return the configured Telephony adapter."""
    settings = get_settings()
    name = (provider_name or settings.telephony_provider).lower()

    if name == "exotel":
        return ExotelProvider()
    elif name == "twilio":
        return TwilioProvider()
    else:
        # Default to Twilio
        return TwilioProvider()
