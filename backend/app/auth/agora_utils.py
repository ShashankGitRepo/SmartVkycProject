import os
import time
import logging
from agora_token_builder import RtcTokenBuilder
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
load_dotenv()

APP_ID = os.getenv("AGORA_APP_ID")
APP_CERTIFICATE = os.getenv("AGORA_APP_CERTIFICATE")


if not APP_ID or not APP_CERTIFICATE:
    logging.warning("AGORA_APP_ID or AGORA_APP_CERTIFICATE not set in .env file.")

TOKEN_EXPIRATION_SEC = 3600
PRIVILEGE_EXPIRATION_SEC = 3600

def generate_agora_rtc_token(channel_name: str, user_id: int) -> str | None:
    """Generates an Agora RTC token."""
    
    if not APP_ID or not APP_CERTIFICATE:
        logging.error("Cannot generate token: Missing App ID or Certificate.")
        return None

    try:
        current_timestamp = int(time.time())
        privilege_expired_ts = current_timestamp + PRIVILEGE_EXPIRATION_SEC

        logging.info(f"Building token for User: {user_id}, Channel: {channel_name}")

        token = RtcTokenBuilder.buildTokenWithUid(
            APP_ID,
            APP_CERTIFICATE,
            channel_name,
            user_id,
            1, # Role_Publisher = 1
            privilege_expired_ts
        )
        return token
    except Exception as e:
        logging.error(f"Agora Token Generation Failed: {e}", exc_info=True)
        return None