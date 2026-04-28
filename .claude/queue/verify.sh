#!/usr/bin/env bash
# Extract the `verify: |` block from a markdown task's YAML frontmatter and
# run it through bash. Optional second arg is a log file.
#
# Exit codes:
#   0   verify passed
#   2   usage error
#   3   no `verify: |` block found
#   *   propagated from the verify block

set -u

usage() {
  echo "usage: verify.sh <task.md> [log-path]" >&2
  exit 2
}

[ "$#" -ge 1 ] || usage
TASK="$1"
LOG="${2:-}"

[ -f "$TASK" ] || { echo "verify.sh: missing file: $TASK" >&2; exit 2; }

# Extract the indented block under `verify: |` inside the leading `---`
# frontmatter. Stops at the first un-indented non-blank line or the closing
# `---`. Strips the leading indentation so the block runs as plain bash.
SCRIPT="$(awk '
  BEGIN { in_fm = 0; in_verify = 0; indent = 0 }
  /^---[[:space:]]*$/ {
    if (!in_fm) { in_fm = 1; next }
    else { exit }
  }
  in_fm && !in_verify && /^[[:space:]]*verify:[[:space:]]*\|[[:space:]]*$/ {
    in_verify = 1; indent = 0; next
  }
  in_fm && in_verify {
    if ($0 ~ /^[[:space:]]*$/) { print ""; next }
    if (indent == 0) {
      match($0, /^[[:space:]]+/)
      indent = RLENGTH
      if (indent == 0) { in_verify = 0; next }
    }
    if (substr($0, 1, indent) ~ /^[[:space:]]+$/) {
      print substr($0, indent + 1)
    } else {
      in_verify = 0
    }
  }
' "$TASK")"

if [ -z "${SCRIPT//[[:space:]]/}" ]; then
  echo "verify.sh: no \`verify: |\` block in $TASK" >&2
  exit 3
fi

if [ -n "$LOG" ]; then
  set -o pipefail
  bash -c "$SCRIPT" 2>&1 | tee "$LOG"
  rc=${PIPESTATUS[0]}
else
  bash -c "$SCRIPT"
  rc=$?
fi

exit "$rc"
