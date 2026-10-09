"""
core — foundation shared by every other app.

Responsibilities
----------------
- Abstract model mixins: TimeStamped, Orderable, Publishable, Singleton.
- The shared `Tag` taxonomy used by projects, experience and blog posts.
- `IsOwner` permission that guards every /api/v1/admin/ endpoint.
- `OwnerModelViewSet`: CRUD + reorder + version-recording base for admin APIs.
- Uniform API error envelope (`exceptions.api_exception_handler`).

core must not import from content apps; content apps import from core.
"""
