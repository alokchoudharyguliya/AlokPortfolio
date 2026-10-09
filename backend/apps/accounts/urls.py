from django.urls import path

from . import views

urlpatterns = [
    path("csrf/", views.CsrfView.as_view(), name="auth-csrf"),
    path("login/", views.LoginView.as_view(), name="auth-login"),
    path("otp/verify/", views.OtpVerifyView.as_view(), name="auth-otp-verify"),
    path("refresh/", views.RefreshView.as_view(), name="auth-refresh"),
    path("logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("me/", views.MeView.as_view(), name="auth-me"),
    path("otp/setup/", views.OtpSetupView.as_view(), name="auth-otp-setup"),
    path("otp/confirm/", views.OtpConfirmView.as_view(), name="auth-otp-confirm"),
    path("otp/disable/", views.OtpDisableView.as_view(), name="auth-otp-disable"),
]
