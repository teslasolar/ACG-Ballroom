---
description: Delete failed tasks older than N days (default 7). Asks for confirmation before deleting.
argument-hint: [days]
---

Parse `$ARGUMENTS` as a positive integer (default 7).

1. List the candidate files:
   ```bash
   days=${ARGS:-7}
   find .claude/queue/failed -maxdepth 1 -type f -mtime +"$days" -not -name '.gitkeep'
   ```
2. Show the user the list and the count.
3. **Ask the user to confirm** before deleting (this is destructive).
4. On confirmation, delete them:
   ```bash
   find .claude/queue/failed -maxdepth 1 -type f -mtime +"$days" -not -name '.gitkeep' -delete
   ```
5. Report the count deleted.
