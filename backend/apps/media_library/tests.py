import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

URL = "/api/v1/admin/media/"


def png(size=(32, 16)):
    buf = io.BytesIO()
    Image.new("RGB", size, "purple").save(buf, format="PNG")
    return SimpleUploadedFile("pic.png", buf.getvalue(), content_type="image/png")


@pytest.mark.django_db
class TestMedia:
    def test_upload_image_populates_metadata(self, owner_api):
        res = owner_api.post(URL, {"file": png(), "alt_text": "a pic"}, format="multipart")
        assert res.status_code == 201, res.json()
        body = res.json()
        assert body["kind"] == "image"
        assert (body["width"], body["height"]) == (32, 16)
        assert body["url"].startswith("/media/uploads/")

    def test_rejects_disallowed_extension(self, owner_api):
        bad = SimpleUploadedFile("x.exe", b"MZ", content_type="application/octet-stream")
        res = owner_api.post(URL, {"file": bad}, format="multipart")
        assert res.status_code == 400
        assert "file" in res.json()["error"]["fields"]

    def test_rejects_oversized(self, owner_api, settings):
        settings.MEDIA_MAX_UPLOAD_BYTES = 10
        res = owner_api.post(URL, {"file": png()}, format="multipart")
        assert res.status_code == 400

    def test_media_ref_on_profile(self, owner_api):
        asset_id = owner_api.post(URL, {"file": png()}, format="multipart").json()["id"]
        res = owner_api.patch("/api/v1/admin/profile/", {"avatar": asset_id}, format="json")
        assert res.json()["avatar"]["id"] == asset_id
        # Deleting the asset nulls the reference instead of breaking the profile.
        owner_api.delete(f"{URL}{asset_id}/")
        assert owner_api.get("/api/v1/admin/profile/").json()["avatar"] is None
