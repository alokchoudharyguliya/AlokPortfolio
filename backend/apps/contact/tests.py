import pytest

from apps.contact.models import Message

URL = "/api/v1/public/contact/"
VALID = {"name": "Ada", "email": "ada@example.com", "subject": "Hi", "body": "Loved the site!"}


@pytest.mark.django_db
class TestContact:
    def test_submit_creates_message(self, api):
        assert api.post(URL, VALID, format="json").status_code == 201
        msg = Message.objects.get()
        assert msg.visitor_hash and not msg.is_read

    def test_honeypot_silently_drops(self, api):
        res = api.post(URL, {**VALID, "website": "http://spam"}, format="json")
        assert res.status_code == 201
        assert Message.objects.count() == 0

    def test_validation(self, api):
        res = api.post(URL, {**VALID, "email": "nope", "body": "short"}, format="json")
        assert res.status_code == 400
        assert set(res.json()["error"]["fields"]) == {"email", "body"}

    def test_inbox_flags_and_unread_count(self, api, owner_api):
        api.post(URL, VALID, format="json")
        assert owner_api.get("/api/v1/admin/messages/unread_count/").json() == {"unread": 1}
        pk = Message.objects.get().pk
        res = owner_api.patch(
            f"/api/v1/admin/messages/{pk}/", {"is_read": True, "body": "edited?"}, format="json"
        )
        assert res.json()["is_read"] is True
        assert res.json()["body"] == VALID["body"]  # message content is immutable
        assert owner_api.get("/api/v1/admin/messages/unread_count/").json() == {"unread": 0}

    def test_throttled(self, api, settings):
        settings.REST_FRAMEWORK = {
            **settings.REST_FRAMEWORK,
            "DEFAULT_THROTTLE_RATES": {
                **settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"],
                "contact": "1/hour",
            },
        }
        from django.core.cache import cache
        from rest_framework.throttling import ScopedRateThrottle

        cache.clear()
        ScopedRateThrottle.THROTTLE_RATES = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
        try:
            assert api.post(URL, VALID, format="json").status_code == 201
            assert api.post(URL, VALID, format="json").status_code == 429
        finally:
            from rest_framework.settings import api_settings

            ScopedRateThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES
            cache.clear()
