"""
media_library — the single upload pipeline.

Every image or file used anywhere (avatar, project covers, blog images,
resume PDFs, OG image) is a `MediaAsset`. Content models hold a nullable FK to
it and expose it through `MediaRefField`:

    write: "cover": 12            (asset id, or null to clear)
    read:  "cover": {"id": 12, "url": "/media/…", "alt": "…", "width": 1200, "height": 630}

Benefits: one upload endpoint, one validation path, JSON-only content APIs,
and a reusable media picker in the dashboard. Storage backend (disk or S3/R2)
is a settings concern only.
"""
