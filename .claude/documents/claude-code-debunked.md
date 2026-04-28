# Claude Code DEBUNKED

> **A reproducible build prompt for the Claude Code workflow architecture.**
> Paste this document into a fresh Claude Code session at the root of any
> empty (or near-empty) repo. You'll end up with: a clean root, a
> project-scoped MCP server whose centerpiece is a "run code in any language"
> tool, namespaced slash commands, a verify-gated markdown task queue, and
> Copilot CLI delegation so free GPT-4.1 absorbs the cheap prompts instead of
> your Claude plan.
>
> **Voice.** You are an AI coding assistant reading this as an order. Follow
> the phases in order. Each phase ends with an **Acceptance check** you must
> run and confirm green before starting the next. Do not skip acceptance
> checks.

---

## 0. Pick a project handle

Decide two names up front — these get substituted into every path and config
in the rest of this document:

- `<PROJECT>` — a short lowercase slug for the MCP server and command
  namespace. Example: `acme`. Rules: `[a-z][a-z0-9_-]{1,31}`.
- `<SRC>` — the sub-directory that will hold everything that isn't root-level
  boilerplate. Default: `src/`. Can be `app/`, `project/`, or any name that
  fits the repo. Must not be a reserved path.

Ask the user if they don't specify. Everywhere below that you see
`<PROJECT>` or `<SRC>`, substitute the chosen value.

---

## 1. Prerequisites

- `node` (any LTS ≥ 18)
- `npm`
- `gh` CLI authenticated (`gh auth status` should be healthy)
- `copilot` CLI installed and logged in — `copilot --version` should print
  `GitHub Copilot CLI …`
- Write access to `~/.claude/` and the target repo root

If any are missing, stop and tell the user which. Do not attempt to install
system tools yourself.

---

## 2. Target architecture at a glance

```
<repo-root>/
├── README.md                  ← one of only two visible docs at root
├── index.html                 ← optional: published entry (e.g. GitHub Pages)
├── .mcp.json                  ← registers the project-scoped MCP server
├── .editorconfig              ← shared formatting baseline
├── .gitignore
├── .github/workflows/         ← CI
├── .claude/
│   ├── settings.local.json    ← permissions allowlist + enableAllProjectMcpServers
│   ├── documents/             ← long-form prompts/specs (this file lives here)
│   ├── commands/              ← slash commands, organised by subdir
│   │   ├── <PROJECT>/         ← /<PROJECT>:run, /<PROJECT>:langs
│   │   ├── dev/               ← /dev:test
│   │   ├── git/               ← /git:status, /git:log
│   │   ├── github/copilot/    ← /github:copilot:{ask,explain,suggest,review}
│   │   └── queue/             ← /queue:{add,list,tick,run,retry,gc}
│   └── queue/
│       ├── README.md
│       ├── TEMPLATE.md
│       ├── verify.sh          ← extracts & runs the `verify: |` block
│       ├── .gitignore         ← ignores operational task files
│       ├── pending/           ← drop task .md files here
│       ├── active/            ← task being processed (transient)
│       └── failed/            ← verify-failed tasks + .log of the run
└── <SRC>/                     ← everything else
    ├── package.json           ← only if this is a Node project
    ├── server.js              ← optional: local dev server w/ /health
    ├── mcp/
    │   ├── server.js          ← zero-dep MCP over stdio
    │   └── test-stdio.js      ← handshake smoke test
    └── <your project files>
```

### Three invariants

1. **Root stays minimal.** Only `README.md` and a published entry point (if
   any) are visible at root, plus hidden dotfiles. Everything the project
   actually *does* lives under `<SRC>/`. If you'd serve this repo via GitHub
   Pages, absolute URLs in root HTML point into `<SRC>/` (e.g.
   `/<SRC>/styles/…`).

2. **Every automated task must be verifiable.** The queue runner deletes a
   task only after its `verify: |` block exits 0. Failing tasks are preserved
   in `failed/` with their log for human inspection. Never auto-retry.

3. **Cheap reads go to free GPT-4.1.** If a question can be answered by
   `copilot -p --model gpt-4.1`, delegate it. That model costs 0 Premium
   requests on standard Copilot plans and keeps Claude's context for the
   expensive work.

---

(See the original prompt for the full per-phase build instructions,
acceptance checks, conventions, and gotchas. This document is preserved
here as the canonical specification this repository was built from.)
