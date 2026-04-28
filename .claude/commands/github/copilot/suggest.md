---
description: Ask GitHub Copilot CLI (gpt-4.1, free) for the shell command that does X. Always confirms before running.
argument-hint: <task-in-plain-english>
---

If `$ARGUMENTS` is empty, ask the user what shell task they need a command
for and stop.

Otherwise run:

```bash
copilot -p "Return ONLY the shell command (no prose, no markdown fences): $ARGUMENTS" --model gpt-4.1 --allow-all-tools --no-color --output-format text -s
```

Wrap the returned line in a ```bash``` block and present it to the user.
**Do not execute it.** Ask the user to confirm before running it.
