"""
analytics — privacy-friendly, first-party usage stats.

The SPA posts small events to /api/v1/public/analytics/collect/
(pageviews, mode/theme switches, game plays, resume downloads …).
No cookies, no third-party scripts, no raw IPs: visitors are identified by a
daily-rotating salted hash (see core.utils.visitor_hash), so "unique visitors"
means unique visitor-days.

The owner dashboard reads /api/v1/admin/analytics/summary/?days=30.
The SPA does not send events while the owner is logged in.
"""
