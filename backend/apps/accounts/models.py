from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """
    Custom user model (declared up-front so it can evolve without painful
    migrations). The portfolio owner is the superuser; there are no public
    accounts.
    """

    @property
    def has_totp(self) -> bool:
        from django_otp.plugins.otp_totp.models import TOTPDevice

        return TOTPDevice.objects.filter(user=self, confirmed=True).exists()
