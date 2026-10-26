## Context

Research: [docs/research/tool-call.md](../../../docs/research/tool-call.md) ("Decisions").

## Decisions

### 1. Status

`status` is a prop the consumer maps from its runtime. Every part carries it as `data-state`.
The Header is the disclosure's trigger (a button, `aria-expanded`, `aria-controls` = Content)
named "`name`, `messages.status[status]`" ("search_flights, running"); `Status` shows the
words, `aria-hidden` (they are in the name).

### 2. Disclosure

`open` is controllable (`open`, `defaultOpen`, `onOpenChange`). Entering `awaiting` opens it
(it never auto-closes); a user toggle afterwards wins.

### 3. Approval

Rendered only with `onDecision` (no buttons, no fabricated result: assistant-ui#6094). The
attempt (context `approval`):

| Event | From | To |
|---|---|---|
| status becomes `awaiting` | any | `awaiting` |
| `APPROVE` / `DENY` | `awaiting` | `submitting`, `onDecision({ id, approved, reason })` |
| promise resolves (or a sync return) | `submitting` | `settled` |
| promise rejects | `submitting` | `failed` (buttons enabled again: `failed` accepts a decision) |
| status leaves `awaiting` from outside | `awaiting` | `settled` |
| status becomes `cancelled` | `awaiting` | `expired` |

A press outside `awaiting` / `failed` is ignored (no double decision). While `submitting` the
buttons are `aria-disabled`. `decision` (`approved | denied`) is kept for the Receipt.

### 4. Focus

`focusOnRequest`: `"none"` (default; never steal: #8223) or `"approval"` (focus Approve on
entering `awaiting`). On `settled`/`expired`, if the focus was inside the Approval
(`env.focusInside()`), it moves to the Receipt (`role="status"`, `tabindex=-1`): #8704, #8994.

### 5. Announcements

Entering `awaiting`: `messages.awaiting(name)` politely ("search_flights needs your
approval"); entering `error`: `messages.failed(name)`. Nothing for `done` (the output is in the
thread). `announce="off"` silences both.

### 6. Duration

`duration` (seconds) when given; else measured on the injected Clock from the first live status
(`pending` / `running`) to the first final one (`done | error | denied | cancelled`), never
from mount for a call already final (Reasoning's rule). `Duration` shows
`messages.duration(seconds)`.

### 7. Attributes

Every part: `data-scope="tool-call"`, `data-part`, `data-instance`, `data-state` (status),
`data-open`. Approval: `data-approval` (attempt), `data-risk`, `data-decision`. Buttons:
`data-disabled`, focus attributes.

### 8. Contract

Locate by the Header's name, else the only one. Actions `toggle`, `approve`, `deny`. Queries
`status`, `isOpen`, `approvalState`, `decision`, `receiptText`.
