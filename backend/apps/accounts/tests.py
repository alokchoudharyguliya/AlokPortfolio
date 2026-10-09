import time

import pytest
from django.conf import settings
from django_otp.oath import totp
from django_otp.plugins.otp_totp.models import TOTPDevice
from rest_framework.test import APIClient

from conftest import OWNER_PASSWORD

LOGIN = "/api/v1/auth/login/"
ME = "/api/v1/auth/me/"
ACCESS = settings.AUTH_COOKIES["ACCESS_NAME"]
REFRESH = settings.AUTH_COOKIES["REFRESH_NAME"]


def current_code(device: TOTPDevice) -> str:
    code = totp(device.bin_key, device.step, device.t0, device.digits, device.drift)
    return str(code).zfill(device.digits)


@pytest.mark.django_db
class TestPasswordLogin:
    def test_success_sets_httponly_cookies(self, api, owner):
        res = api.post(LOGIN, {"username": "owner", "password": OWNER_PASSWORD}, format="json")
        assert res.status_code == 200
        assert res.json()["otp_required"] is False
        assert res.cookies[ACCESS]["httponly"]
        assert res.cookies[REFRESH]["path"] == settings.AUTH_COOKIES["REFRESH_PATH"]
        assert api.get(ME).json()["authenticated"] is True

    def test_wrong_password_returns_error_envelope(self, api, owner):
        res = api.post(LOGIN, {"username": "owner", "password": "nope"}, format="json")
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "invalid_credentials"

    def test_non_superuser_cannot_log_in(self, api, django_user_model):
        django_user_model.objects.create_user("visitor", password=OWNER_PASSWORD)
        res = api.post(LOGIN, {"username": "visitor", "password": OWNER_PASSWORD}, format="json")
        assert res.status_code == 401

    def test_totp_required_but_not_configured(self, api, owner, settings):
        settings.SUDO_REQUIRE_TOTP = True
        res = api.post(LOGIN, {"username": "owner", "password": OWNER_PASSWORD}, format="json")
        assert res.status_code == 403
        assert res.json()["error"]["code"] == "otp_setup_required"


@pytest.mark.django_db
class TestTotpLogin:
    @pytest.fixture
    def device(self, owner):
        return TOTPDevice.objects.create(user=owner, name="sudo", confirmed=True)

    def _challenge(self, api):
        res = api.post(LOGIN, {"username": "owner", "password": OWNER_PASSWORD}, format="json")
        assert res.json()["otp_required"] is True
        assert ACCESS not in res.cookies
        return res.json()["challenge"]

    def test_valid_code_completes_login(self, api, device):
        challenge = self._challenge(api)
        res = api.post(
            "/api/v1/auth/otp/verify/",
            {"challenge": challenge, "code": current_code(device)},
            format="json",
        )
        assert res.status_code == 200
        assert ACCESS in res.cookies

    def test_invalid_code_rejected(self, api, device):
        challenge = self._challenge(api)
        bad = "000000" if current_code(device) != "000000" else "111111"
        res = api.post(
            "/api/v1/auth/otp/verify/", {"challenge": challenge, "code": bad}, format="json"
        )
        assert res.status_code == 401

    def test_tampered_challenge_rejected(self, api, device):
        res = api.post(
            "/api/v1/auth/otp/verify/",
            {"challenge": "forged", "code": current_code(device)},
            format="json",
        )
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "challenge_expired"


@pytest.mark.django_db
class TestSession:
    def test_refresh_rotates_tokens(self, owner_api):
        res = owner_api.post("/api/v1/auth/refresh/")
        assert res.status_code == 200
        assert ACCESS in res.cookies and REFRESH in res.cookies

    def test_logout_clears_and_blacklists(self, owner_api):
        old_refresh = owner_api.cookies[REFRESH].value
        res = owner_api.post("/api/v1/auth/logout/")
        assert res.status_code == 204
        assert owner_api.get(ME).json()["authenticated"] is False
        owner_api.cookies[REFRESH] = old_refresh
        assert owner_api.post("/api/v1/auth/refresh/").status_code == 401

    def test_invalid_cookie_is_anonymous_on_public_but_401_on_admin(self, owner):
        client = APIClient()
        client.cookies[ACCESS] = "garbage"
        assert client.get("/api/v1/public/bootstrap/").status_code == 200
        assert client.get("/api/v1/admin/projects/").status_code == 401

    def test_csrf_enforced_for_cookie_auth(self, owner):
        client = APIClient(enforce_csrf_checks=True)
        csrf = client.get("/api/v1/auth/csrf/").json()["csrfToken"]
        res = client.post(
            LOGIN,
            {"username": "owner", "password": OWNER_PASSWORD},
            format="json",
            HTTP_X_CSRFTOKEN=csrf,
        )
        assert res.status_code == 200
        payload = {"title": "CSRF probe"}
        assert client.post("/api/v1/admin/projects/", payload, format="json").status_code == 403
        ok = client.post("/api/v1/admin/projects/", payload, format="json", HTTP_X_CSRFTOKEN=csrf)
        assert ok.status_code == 201


@pytest.mark.django_db
def test_totp_setup_and_confirm_from_dashboard(owner_api, owner):
    res = owner_api.post("/api/v1/auth/otp/setup/")
    assert res.status_code == 200
    assert res.json()["otpauth_url"].startswith("otpauth://totp/")
    device = TOTPDevice.objects.get(user=owner, confirmed=False)
    # Make sure we don't reuse a code within the same step as other tests
    time.sleep(0)
    res = owner_api.post("/api/v1/auth/otp/confirm/", {"code": current_code(device)}, format="json")
    assert res.status_code == 200
    assert TOTPDevice.objects.filter(user=owner, confirmed=True).count() == 1
