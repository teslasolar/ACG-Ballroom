---
description: Stamp a new task into .claude/queue/pending/ from TEMPLATE.md.
argument-hint: <title>
---

If `$ARGUMENTS` is empty, ask the user for a one-line title and stop.

Steps:

1. Compute `slug` = `$ARGUMENTS` lowercased, non-alphanumeric → `-`,
   collapsed runs of `-`, trimmed.
2. Compute `id` = `$(date +%Y-%m-%d)-<slug>`.
3. Copy `.claude/queue/TEMPLATE.md` to `.claude/queue/pending/<id>.md`.
4. Edit the new file: replace the placeholder `id:` and `title:` lines.
   Leave the `verify: |` block and body as placeholders.
5. Print the path of the new file and remind the user to open it and fill
   in the verify block + body before running `/queue:tick`.
