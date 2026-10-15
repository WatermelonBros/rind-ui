# 0005 — Making rind-ui known to LLMs

Status: accepted · 2026-10-14

Most code that uses rind-ui will be written by an agent. If agents do not know the
library, or know it wrongly, people will not adopt it. This is a first-class
requirement, not docs polish.

## What we ship

1. **`llms.txt`** at the docs site root, following the convention Ark, Reka, Base
   UI and React Aria use: an index of every page as markdown, plus
   `llms-full.txt` with the whole documentation in one file.
2. **A markdown page per component**, generated from the same source as the
   website: anatomy, parts, props, `data-*` attributes, keyboard interactions,
   accessibility notes, a minimal example, and **a driver test example**.
3. **Generated, not hand-written, API facts.** Props, parts, data attributes,
   machine states and contract actions are extracted from the TypeScript sources
   and the machine definitions, so the LLM docs cannot drift from the code.
4. **An agent skill** (Claude Code / Agent Skills format) explaining how to compose
   rind-ui components and how to verify them with drivers — shipped in the repo and
   published.
5. **An MCP server** exposing docs, component metadata and examples (Ark has one).
   Later; built on the same generated data as (1)–(3).

## Why the contracts matter here

A contract is a machine-readable description of what a component can do. The same
data that powers drivers tells an agent which actions exist and what state it can
read — and the drivers let an agent **verify** the UI it wrote. "The library an AI
can use *and* check" is a real differentiator.

## In this repository

- `CLAUDE.md` is the agent guide for contributors; `AGENTS.md` points other tools
  to it (and carries the block Turborepo maintains there).
- Decisions live in `docs/decisions/`, specs in `openspec/` — agents read both
  before changing behaviour.
