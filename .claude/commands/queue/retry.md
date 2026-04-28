---
description: Move failed tasks matching <id-or-glob> back to pending/ and drop their stale .log files.
argument-hint: <id-or-glob>
---

If `$ARGUMENTS` is empty, ask the user which failed task(s) to retry and
stop.

Run:

```bash
shopt -s nullglob
moved=0
for f in .claude/queue/failed/$ARGUMENTS.md .claude/queue/failed/$ARGUMENTS; do
  [ -f "$f" ] || continue
  id=$(basename "$f" .md)
  mv "$f" .claude/queue/pending/"$id".md
  rm -f .claude/queue/failed/"$id".log
  echo "retry: $id"
  moved=$((moved+1))
done
[ "$moved" -eq 0 ] && echo "no matches for: $ARGUMENTS"
```

Surface the output verbatim.
