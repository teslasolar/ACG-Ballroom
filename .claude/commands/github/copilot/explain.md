---
description: Have GitHub Copilot CLI (gpt-4.1, free) explain a concept, file, or snippet.
argument-hint: <thing-to-explain>
---

If `$ARGUMENTS` is empty, ask the user what to explain and stop.

Otherwise run:

```bash
copilot -p "Explain concisely: $ARGUMENTS" --model gpt-4.1 --allow-all-tools --no-color --output-format text -s
```

Surface the answer verbatim — don't paraphrase or expand on it.
