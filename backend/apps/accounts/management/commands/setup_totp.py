from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django_otp.plugins.otp_totp.models import TOTPDevice

from apps.accounts import services


class Command(BaseCommand):
    help = (
        "Create (or replace) the owner's TOTP device and print the secret / otpauth URL "
        "to add to an authenticator app. Intended for first-time production setup, "
        "when SUDO_REQUIRE_TOTP blocks password-only login."
    )

    def add_arguments(self, parser):
        parser.add_argument("username")

    def handle(self, *args, **options):
        user = get_user_model().objects.filter(username=options["username"]).first()
        if user is None or not user.is_superuser:
            raise CommandError("No superuser with that username.")
        TOTPDevice.objects.filter(user=user).delete()
        device = TOTPDevice.objects.create(user=user, name="sudo", confirmed=True)
        self.stdout.write(self.style.SUCCESS("TOTP device created."))
        self.stdout.write(f"Secret:      {services.device_secret(device)}")
        self.stdout.write(f"otpauth URL: {device.config_url}")
        self.stdout.write(
            "Add the secret to your authenticator app (Google Authenticator, 1Password, …)."
        )
