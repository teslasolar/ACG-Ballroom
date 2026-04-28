---
description: Drain up to N tasks (default 100) by repeatedly running /queue:tick. Stops on the first failure.
argument-hint: [N]
---

Parse `$ARGUMENTS` as a positive integer N (default 100).

Loop up to N times:

1. Invoke the `/queue:tick` procedure.
2. If it reports `queue empty`, stop and report how many tasks were
   processed.
3. If it reports `DONE: <id>`, increment the counter and continue.
4. If it reports `FAIL: <id>`, **stop immediately** — do not attempt the
   next task. Surface the failure summary and the path to the log under
   `.claude/queue/failed/<id>.log`.

Final report: `processed=<n> remaining_pending=<m> first_failure=<id|none>`.
