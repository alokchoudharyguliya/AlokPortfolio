"""Auth domain logic, separated from the HTTP layer for testability."""

from base64 import b32encode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django_otp.plugins.otp_totp.models import TOTPDevice

CHALLENGE_SALT = "accounts.sudo-otp-challenge"


def make_otp_challenge(user) -> str:
    """Signed, short-lived token proving the password step succeeded."""
    return signing.dumps({"uid": user.pk}, salt=CHALLENGE_SALT)


def read_otp_challenge(challenge: str):
    """Return the user for a valid challenge, or None if invalid/expired."""
    try:
        data = signing.loads(
            challenge, salt=CHALLENGE_SALT, max_age=settings.SUDO_OTP_CHALLENGE_MAX_AGE
        )
    except signing.BadSignature:
        return None
    return get_user_model().objects.filter(pk=data.get("uid"), is_active=True).first()


def verify_totp(user, code: str, *, confirmed: bool = True) -> TOTPDevice | None:
    """Return the device that accepted `code`, else None. Devices enforce replay protection."""
    for device in TOTPDevice.objects.filter(user=user, confirmed=confirmed):
        if device.verify_token(code):
            return device
    return None


def start_totp_setup(user) -> TOTPDevice:
    """Replace any pending (unconfirmed) device with a fresh one."""
    TOTPDevice.objects.filter(user=user, confirmed=False).delete()
    return TOTPDevice.objects.create(user=user, name="sudo", confirmed=False)


def device_secret(device: TOTPDevice) -> str:
    return b32encode(device.bin_key).decode().rstrip("=")


def owner_payload(user) -> dict:
    return {
        "id": user.pk,
        "username": user.get_username(),
        "email": user.email,
        "has_totp": user.has_totp,
        "last_login": user.last_login,
    }
