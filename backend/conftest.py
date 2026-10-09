"""Shared pytest fixtures for every app's tests.py."""

import pytest
from rest_framework.test import APIClient

OWNER_PASSWORD = "correct-horse-battery-staple"


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def owner(db, django_user_model):
    return django_user_model.objects.create_superuser(
        username="owner", email="owner@example.com", password=OWNER_PASSWORD
    )


@pytest.fixture
def owner_api(owner):
    """Client logged in through the real cookie-based login flow."""
    client = APIClient()
    response = client.post(
        "/api/v1/auth/login/", {"username": "owner", "password": OWNER_PASSWORD}, format="json"
    )
    assert response.status_code == 200, response.content
    return client
