---
description: Run a code snippet via the project MCP server. First word of $ARGUMENTS is the language; the rest is the code.
argument-hint: <lang> <code...>
---

Parse `$ARGUMENTS`:

- The first whitespace-delimited token is the language key.
- Everything after the first whitespace is the code body (preserve newlines).

If the user did not supply both, ask them to provide `<lang>` and `<code>`,
showing the output of `/acg:langs` so they can pick a key.

Otherwise call `mcp__acg__run` with `{lang, code, timeout_ms: 10000}` and
print the returned text verbatim. If `isError` is true, surface the
`stderr` and `exitCode` lines prominently before any commentary.
