---
description: Ask GitHub Copilot CLI (gpt-4.1, free) a quick question. Surfaces the answer verbatim.
argument-hint: <question>
---

If `$ARGUMENTS` is empty, ask the user for a question and stop.

Otherwise run:

```bash
copilot -p "$ARGUMENTS" --model gpt-4.1 --allow-all-tools --no-color --output-format text -s
```

Print the answer verbatim. Do not re-reason or re-summarise — the whole
point of this command is to keep cheap reads on the free model and out of
Claude's context.
