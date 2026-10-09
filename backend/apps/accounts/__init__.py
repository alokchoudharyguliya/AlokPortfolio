"""
accounts — owner ("sudo") authentication.

Login flow
----------
1. GET  /api/v1/auth/csrf/        → sets the `csrftoken` cookie.
2. POST /api/v1/auth/login/       {username, password}
      → if the owner has TOTP:   {"otp_required": true, "challenge": "<signed>"}
      → otherwise:               JWT cookies set, {"otp_required": false, "user": {...}}
3. POST /api/v1/auth/otp/verify/  {challenge, code} → JWT cookies set.
4. POST /api/v1/auth/refresh/     rotates tokens using the refresh cookie.
5. POST /api/v1/auth/logout/      blacklists refresh token, clears cookies.

Tokens live in httpOnly cookies (`sudo_access`, `sudo_refresh`), so JavaScript
never sees them. Because cookies are sent automatically, every unsafe request
authenticated by cookie must carry the CSRF header (enforced in
`authentication.CookieJWTAuthentication`).
"""
