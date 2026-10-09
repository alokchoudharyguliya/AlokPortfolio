"""
profiles — who the owner is.

Models
------
- Profile (singleton): name, headline, rotating roles, bio, about/philosophy
  markdown, availability, avatar.
- SocialLink: ordered, publishable outbound links (GitHub, LinkedIn, …).
- FocusArea: "what I'm currently deepening" cards (title, blurb, bullet items).
- ResumeVersion: uploaded resume PDFs; exactly one may be active and is the
  one offered for download.
"""
