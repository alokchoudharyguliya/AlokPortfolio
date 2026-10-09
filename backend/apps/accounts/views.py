from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import update_last_login
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.permissions import IsOwner

from . import services
from .cookies import clear_auth_cookies, set_auth_cookies, set_rotated_cookies
from .serializers import (
    LoginResponseSerializer,
    LoginSerializer,
    MeSerializer,
    OtpCodeSerializer,
    OtpSetupSerializer,
    OtpVerifySerializer,
)


def _error(message: str, code: str, http_status: int):
    return Response(
        {"error": {"status": http_status, "code": code, "message": message, "fields": {}}},
        status=http_status,
    )


def _issue_tokens(user) -> Response:
    update_last_login(None, user)
    response = Response({"otp_required": False, "user": services.owner_payload(user)})
    return set_auth_cookies(response, RefreshToken.for_user(user))


class CsrfView(APIView):
    """Sets the CSRF cookie; the SPA calls this once before any unsafe request."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses={200: dict})
    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response({"csrfToken": get_token(request)})


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    """Password step of the sudo login."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @extend_schema(request=LoginSerializer, responses=LoginResponseSerializer)
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(request, **serializer.validated_data)
        if user is None or not user.is_superuser:
            return _error("Invalid credentials.", "invalid_credentials", 401)

        if user.has_totp:
            return Response({"otp_required": True, "challenge": services.make_otp_challenge(user)})
        if settings.SUDO_REQUIRE_TOTP:
            return _error(
                "2FA is required but not set up. Run "
                f"`python manage.py setup_totp {user.get_username()}` on the server.",
                "otp_setup_required",
                403,
            )
        return _issue_tokens(user)


@method_decorator(csrf_protect, name="dispatch")
class OtpVerifyView(APIView):
    """TOTP step of the sudo login."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    @extend_schema(request=OtpVerifySerializer, responses=LoginResponseSerializer)
    def post(self, request):
        serializer = OtpVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = services.read_otp_challenge(serializer.validated_data["challenge"])
        if user is None:
            return _error("Login expired. Start again.", "challenge_expired", 401)
        if services.verify_totp(user, serializer.validated_data["code"]) is None:
            return _error("Invalid code.", "invalid_code", 401)
        return _issue_tokens(user)


@method_decorator(csrf_protect, name="dispatch")
class RefreshView(APIView):
    """Rotate the token pair using the refresh cookie."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=None, responses={200: dict})
    def post(self, request):
        raw = request.COOKIES.get(settings.AUTH_COOKIES["REFRESH_NAME"])
        if not raw:
            return _error("Not logged in.", "not_authenticated", 401)
        serializer = TokenRefreshSerializer(data={"refresh": raw})
        try:
            serializer.is_valid(raise_exception=True)
        except Exception:  # TokenError / InvalidToken / blacklisted user
            return clear_auth_cookies(_error("Session expired.", "session_expired", 401))
        data = serializer.validated_data
        return set_rotated_cookies(
            Response({"refreshed": True}), data["access"], data.get("refresh")
        )


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        raw = request.COOKIES.get(settings.AUTH_COOKIES["REFRESH_NAME"])
        if raw:
            try:
                RefreshToken(raw).blacklist()
            except TokenError:
                pass
        return clear_auth_cookies(Response(status=status.HTTP_204_NO_CONTENT))


class MeView(APIView):
    """Who am I? Always 200 so the SPA can probe silently."""

    permission_classes = [AllowAny]

    @extend_schema(responses=MeSerializer)
    def get(self, request):
        user = request.user
        if user.is_authenticated and user.is_superuser:
            return Response({"authenticated": True, "user": services.owner_payload(user)})
        return Response({"authenticated": False, "user": None})


class OtpSetupView(APIView):
    """Owner starts (re)configuring the authenticator app from the dashboard."""

    permission_classes = [IsOwner]

    @extend_schema(request=None, responses=OtpSetupSerializer)
    def post(self, request):
        device = services.start_totp_setup(request.user)
        return Response(
            {"otpauth_url": device.config_url, "secret": services.device_secret(device)}
        )


class OtpConfirmView(APIView):
    """Confirms the pending device with a first code; older devices are removed."""

    permission_classes = [IsOwner]

    @extend_schema(request=OtpCodeSerializer, responses={200: dict})
    def post(self, request):
        serializer = OtpCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        device = services.verify_totp(
            request.user, serializer.validated_data["code"], confirmed=False
        )
        if device is None:
            return _error("Invalid code.", "invalid_code", 400)
        type(device).objects.filter(user=request.user, confirmed=True).delete()
        device.confirmed = True
        device.save(update_fields=["confirmed"])
        return Response({"has_totp": True})


class OtpDisableView(APIView):
    """Removes 2FA. Requires a current code. Refused when the server mandates 2FA."""

    permission_classes = [IsOwner]

    @extend_schema(request=OtpCodeSerializer, responses={200: dict})
    def post(self, request):
        if settings.SUDO_REQUIRE_TOTP:
            return _error("2FA is mandatory on this server.", "otp_required", 400)
        serializer = OtpCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if services.verify_totp(request.user, serializer.validated_data["code"]) is None:
            return _error("Invalid code.", "invalid_code", 400)
        from django_otp.plugins.otp_totp.models import TOTPDevice

        TOTPDevice.objects.filter(user=request.user).delete()
        return Response({"has_totp": False})
