from django.conf import settings
from rest_framework import exceptions
from rest_framework.authentication import CSRFCheck
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class CookieJWTAuthentication(JWTAuthentication):
    """
    Authenticates from the `Authorization: Bearer` header (Swagger, scripts) or,
    for the browser, from the httpOnly access-token cookie.

    Design notes
    ------------
    - An *invalid / expired cookie* is treated as anonymous rather than raising.
      Public endpoints therefore keep working for an owner whose session has
      lapsed, while owner-only endpoints respond 401 (DRF uses this class's
      `WWW-Authenticate` header), which tells the SPA to call /auth/refresh/.
    - Cookie-authenticated unsafe requests must pass Django's CSRF check.
    """

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)

        raw_token = request.COOKIES.get(settings.AUTH_COOKIES["ACCESS_NAME"])
        if not raw_token:
            return None
        try:
            validated = self.get_validated_token(raw_token)
            user = self.get_user(validated)
        except (InvalidToken, TokenError, exceptions.AuthenticationFailed):
            return None

        self.enforce_csrf(request)
        return user, validated

    @staticmethod
    def enforce_csrf(request):
        def dummy_get_response(_request):  # pragma: no cover
            return None

        check = CSRFCheck(dummy_get_response)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")
