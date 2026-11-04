"""Provider-agnostic SMS dispatch interface (Twilio & Exotel)."""

from abc import ABC, abstractmethod
from typing import Optional
import httpx
from agent.config import get_settings
from agent.logger import setup_logger

logger = setup_logger("telephony.sms")


class BaseSMSProvider(ABC):
    @abstractmethod
    async def send_sms(self, to_number: str, message: str) -> bool:
        pass


class TwilioSMSProvider(BaseSMSProvider):
    def __init__(self, account_sid: Optional[str] = None, auth_token: Optional[str] = None, from_number: Optional[str] = None):
        settings = get_settings()
        self.account_sid = account_sid or settings.twilio_account_sid
        self.auth_token = auth_token or settings.twilio_auth_token
        self.from_number = from_number or settings.twilio_phone_number

    async def send_sms(self, to_number: str, message: str) -> bool:
        if not self.account_sid or not self.auth_token or not self.from_number:
            logger.warning("Twilio SMS credentials not set. Simulating SMS dispatch.")
            return True

        api_url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}/Messages.json"
        auth = (self.account_sid, self.auth_token)
        payload = {"To": to_number, "From": self.from_number, "Body": message}

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(api_url, auth=auth, data=payload)
                return res.status_code in (200, 201)
        except Exception as e:
            logger.error(f"Twilio SMS error: {e}")
            return False


class ExotelSMSProvider(BaseSMSProvider):
    def __init__(self, account_sid: Optional[str] = None, api_key: Optional[str] = None, api_token: Optional[str] = None, subdomain: Optional[str] = None, caller_id: Optional[str] = None):
        settings = get_settings()
        self.account_sid = account_sid or settings.exotel_account_sid
        self.api_key = api_key or settings.exotel_api_key
        self.api_token = api_token or settings.exotel_api_token
        self.subdomain = subdomain or settings.exotel_subdomain or "api.exotel.com"
        self.caller_id = caller_id or settings.exotel_caller_id

    async def send_sms(self, to_number: str, message: str) -> bool:
        if not self.account_sid or not self.api_key or not self.api_token:
            logger.warning("Exotel SMS credentials not set. Simulating SMS dispatch.")
            return True

        api_url = f"https://{self.subdomain}/v1/Accounts/{self.account_sid}/Sms/send.json"
        auth = (self.api_key, self.api_token)
        payload = {"From": self.caller_id, "To": to_number, "Body": message}

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(api_url, auth=auth, data=payload)
                return res.status_code in (200, 201)
        except Exception as e:
            logger.error(f"Exotel SMS error: {e}")
            return False


def get_sms_provider() -> BaseSMSProvider:
    settings = get_settings()
    if settings.telephony_provider == "exotel":
        return ExotelSMSProvider()
    return TwilioSMSProvider()
