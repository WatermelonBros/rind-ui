## Why

An AI agent's tool calls are shown in the thread (name, status, input, output) and some need a
human to approve them first. The kits get the hard parts wrong: the status is a colour or an
icon not in the name (assistant-ui#7957), an approval can be sent twice, the focus is lost
after a decision (assistant-ui#8704, #8994) or taken without asking (#8223), a missing handler
fabricates a result (#6094), an abandoned request becomes an empty answer (CopilotKit#5554),
and calls are identified by name (Open WebUI#29293).

Research: [tool-call](../../../docs/research/tool-call.md) ·
[reasoning](../../../docs/research/reasoning.md) · [collapsible](../../../docs/research/collapsible.md)

Depends on: `add-collapsible` / `add-reasoning` (disclosure), `add-button`,
`add-a11y-foundations` (Announcer, focus), `add-theme-system`.

## What Changes

- A public **Tool Call** in `@rind-ui/core` and every framework package: parts `Root`,
  `Header`, `Name`, `Status`, `Duration`, `Content`, `Input`, `Output`, `Error`, `Approval`,
  `ApprovalTitle`, `ApprovalDescription`, `Approve`, `Deny`, `Receipt`.
- `status` is the consumer's (`pending | running | awaiting | done | error | denied |
  cancelled`); the Header is a disclosure named "tool name, status in words".
- Approval attempt `idle | awaiting | submitting | settled | failed | expired`: one decision
  (a second press ignored), `onDecision({ id, approved })` awaited, the body opens on
  `awaiting` and never auto-closes, the focus moves to the Receipt only if it was inside,
  `awaiting` and `error` announced.
- `getToolCall` driver, `tool-call.css`, site example, docs page.

## Capabilities

### New Capabilities

- `tool-call`: anatomy, status and name, disclosure, approval lifecycle, focus, announcements,
  duration, data attributes, messages, contract, theme.

### Modified Capabilities

None.

## Non-goals

- Running tools, schemas, validation, remembered permissions, forms inside the approval,
  grouping parallel calls, streaming JSON repair, time-outs (the consumer sets `cancelled`).

## Impact

- New: `packages/core/src/components/tool-call/`, framework parts, driver, theme file, site
  example and skin, `docs/components/tool-call.md`.
- Modified: `families.ts` (`tool-call` in `panel`).
