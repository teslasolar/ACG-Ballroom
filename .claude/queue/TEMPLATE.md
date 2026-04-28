---
id: REPLACE-WITH-YYYY-MM-DD-slug
title: One-line description
priority: normal
verify: |
  # Bash. Must exit 0 to mark the task complete.
  set -e
  test -f path/to/output.js
  grep -qF "expected" path/to/output.js
---

Describe the work here in prose. Be specific about which files to touch
and which to leave alone. The runner reads this body as instructions for
Claude.
