from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(max_length=256, trim_whitespace=False)


class OtpVerifySerializer(serializers.Serializer):
    challenge = serializers.CharField()
    code = serializers.RegexField(r"^\d{6}$", error_messages={"invalid": "Enter the 6-digit code."})


class OtpCodeSerializer(serializers.Serializer):
    code = serializers.RegexField(r"^\d{6}$", error_messages={"invalid": "Enter the 6-digit code."})


class OwnerSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField(allow_blank=True)
    has_totp = serializers.BooleanField()
    last_login = serializers.DateTimeField(allow_null=True)


class MeSerializer(serializers.Serializer):
    authenticated = serializers.BooleanField()
    user = OwnerSerializer(allow_null=True)


class LoginResponseSerializer(serializers.Serializer):
    otp_required = serializers.BooleanField()
    challenge = serializers.CharField(required=False)
    user = OwnerSerializer(required=False)


class OtpSetupSerializer(serializers.Serializer):
    otpauth_url = serializers.CharField()
    secret = serializers.CharField()
