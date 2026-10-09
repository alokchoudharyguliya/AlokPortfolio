"""
experience — the timeline.

Models
------
- Experience: jobs / internships (role, org, dates, highlights, tech tags).
- Education: degrees and schools.
- Achievement: leadership roles, hackathons, awards, certifications — one
  table with a `kind` so the frontend can group or filter them.

A null `end_date` means "present".
"""
