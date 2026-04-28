---
description: Have GitHub Copilot CLI (gpt-4.1, free) review the working diff or a named path.
argument-hint: [path]
---

If `$ARGUMENTS` is empty, review the working diff:

```bash
git diff --no-color | copilot -p "Review this diff. Bullets grouped by severity: blocker / warning / nit. If clean, reply 'LGTM'." --model gpt-4.1 --allow-all-tools --no-color --output-format text -s
```

Otherwise review the named path:

```bash
copilot -p "Review the file(s) at: $ARGUMENTS. Bullets grouped by severity: blocker / warning / nit. If clean, reply 'LGTM'." --model gpt-4.1 --allow-all-tools --no-color --output-format text -s
```

Surface the review verbatim — keep Claude's context free for actual fixes.
