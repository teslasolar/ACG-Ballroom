# .claude/queue

A verify-gated markdown task queue. Drop a task into `pending/`, run
`/queue:tick` (or `/queue:run` to drain), and the runner moves it to
`active/`, performs the work described in the body, then runs the
`verify: |` block from its YAML frontmatter:

- exit 0 → task is deleted (DONE)
- non-zero → task moves to `failed/` alongside its `.log` (FAIL)

Failing tasks are **never auto-retried**. Inspect the log, fix either the
artifact or the verify block, then `/queue:retry <id-or-glob>` to move
them back to `pending/`.

## Files
- `TEMPLATE.md` — copy-from for new tasks. `/queue:add <title>` does this.
- `verify.sh` — awk-extractor + bash runner for the `verify: |` block.
- `pending/` `active/` `failed/` — operational; gitignored except `.gitkeep`.

## Authoring tips (verify blocks)
- `set -e` at the top of every multi-line block.
- `grep -qF` for any literal containing `$`, `\`, or other regex metachars.
- One `grep` per line of the artifact you need to assert (grep is per-line).
- Use a non-default port if you spawn a server (e.g. `PORT=399X`); always
  `trap 'kill $pid; wait' EXIT` after spawning so a crash never leaks ports.
