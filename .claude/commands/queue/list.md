---
description: List queue tasks grouped by status (pending / active / failed).
---

For each of `pending`, `active`, `failed`, list the `.md` files under
`.claude/queue/<status>/` (skip `.gitkeep`) and extract the `title:` line
from the YAML frontmatter:

```bash
for status in pending active failed; do
  dir=.claude/queue/$status
  files=$(ls -1 "$dir"/*.md 2>/dev/null || true)
  count=$(printf "%s\n" "$files" | grep -c . || true)
  echo "== $status ($count) =="
  for f in $files; do
    title=$(awk '/^title:[[:space:]]*/{sub(/^title:[[:space:]]*/,""); print; exit}' "$f")
    echo "  - $(basename "$f" .md): $title"
  done
done
```

Surface the output verbatim.
