---
description: Process exactly ONE task from .claude/queue/pending/. Verify-gated; failures move to failed/.
---

Process exactly ONE task. Do NOT loop — that's `/queue:run`'s job.

1. Pick the next task:
   ```bash
   next=$(ls -1 .claude/queue/pending/*.md 2>/dev/null | grep -v '/\.gitkeep$' | head -n1 || true)
   ```
   If `next` is empty, print `queue empty` and stop.

2. Move it to `active/`:
   ```bash
   id=$(basename "$next" .md)
   mv "$next" .claude/queue/active/"$id".md
   ```

3. Read `.claude/queue/active/<id>.md` — the body (everything after the
   closing `---` of the YAML frontmatter) is the work description. Do
   exactly what it says, no more.

4. Run the verify block, capturing its log:
   ```bash
   bash .claude/queue/verify.sh .claude/queue/active/"$id".md .claude/queue/active/"$id".log
   rc=$?
   ```

5. On `rc=0` — task passed:
   ```bash
   rm .claude/queue/active/"$id".md .claude/queue/active/"$id".log
   ```
   Report `DONE: <id>`.

6. On `rc≠0` — task failed:
   ```bash
   mv .claude/queue/active/"$id".md .claude/queue/failed/"$id".md
   mv .claude/queue/active/"$id".log .claude/queue/failed/"$id".log
   ```
   Report `FAIL: <id>` with the last ~20 lines of the log. **Do not
   auto-fix and re-run** — the task stays in `failed/` for human
   inspection. The user can use `/queue:retry <id>` to move it back.
