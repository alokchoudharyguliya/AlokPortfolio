"""
site_config — global settings + the public aggregate endpoint.

Models
------
- SiteConfig (singleton): SEO meta, default presentation mode / theme, sound
  default, feature flags (blog, games, contact, analytics), accent colour,
  terminal hostname.
- Section: one row per homepage section (hero, about, projects, …) holding its
  title, subtitle, visibility and order. Every presentation mode (Simple,
  Terminal, 3D) renders sections in this order, so reordering in sudo
  reorders all modes at once.

Endpoints
---------
- GET /api/v1/public/bootstrap/   — everything the SPA needs for the homepage in
  ONE request (profile, sections, timeline, projects, skills, recent posts,
  games, site settings). With `?drafts=1` and an owner session it also returns
  unpublished rows and hidden sections, which powers inline editing.
- GET/PATCH /api/v1/admin/site/            — SiteConfig.
- CRUD     /api/v1/admin/sections/         — section titles / visibility / order.
- GET      /api/v1/admin/overview/         — dashboard counters.

This app is the aggregator, so it imports from content apps (never the reverse).
"""
