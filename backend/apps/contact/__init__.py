"""
contact — visitor messages and the owner's inbox.

Public: POST /api/v1/public/contact/ with {name, email, subject, body, website}.
`website` is a honeypot: real users never see the field, bots fill it in, and
such submissions are silently accepted-and-dropped. Submissions are also
throttled per IP (`contact` scope). Only a hashed visitor id is stored.

Owner: list / search / filter, mark read / starred / archived, delete,
plus `unread_count` for the dashboard badge.
"""
