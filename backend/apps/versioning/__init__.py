"""
versioning — edit history with restore for owner-editable content.

How it connects
---------------
- Admin viewsets inherit `VersionedViewSetMixin` (via core.viewsets.OwnerModelViewSet),
  which calls `services.record()` after every create / update / delete.
- Snapshots are taken *after* `serializer.save()`, so many-to-many fields
  (e.g. tags) are captured correctly — signals would fire before M2M is set.
- `/api/v1/admin/versions/` lists history; `.../{id}/` returns the snapshot
  plus a field-level diff against the previous version; `.../{id}/restore/`
  writes the snapshot back (and itself records a "restore" version).
"""
