# Tool Call

An AI agent's tool call in the thread: its name and status, the input and output in a disclosure, and, when the tool needs a human, an approval with Approve and Deny. The status is yours (map it from your runtime); the component makes it readable ("search_flights, running"), sends one decision with the call's `id`, never fabricates a result, and puts the focus somewhere sensible after the decision.

## When to use

- **Use it for** showing tool calls (search, code execution, file edits) and for human-in-the-loop confirmations.
- **Over a card with two buttons**: the status in words in the header's name (assistant-ui#7957), one decision even on a double press, the focus on a receipt after deciding instead of `<body>` (assistant-ui#8704), the focus never taken unasked (#8223), no buttons without a handler (#6094), an abandoned request shown as expired rather than as an empty answer (CopilotKit#5554), identity by id, not by tool name.
- **Modal confirmation**: compose an [Alert Dialog](dialog.md) around the Approval when the action must block the page.

```tsx
import { ToolCall } from "@rind-ui/react"

<ToolCall.Root
  id={call.id}
  name={call.name}
  status={statusOf(call)}
  onDecision={({ id, approved }) => respond(id, approved)}
  risk="high"
>
  <ToolCall.Header>
    <ToolCall.Name />
    <ToolCall.Status />
    <ToolCall.Duration />
  </ToolCall.Header>
  <ToolCall.Content>
    <ToolCall.Input>{json(call.input)}</ToolCall.Input>
    <ToolCall.Output>{json(call.output)}</ToolCall.Output>
    <ToolCall.Approval>
      <ToolCall.ApprovalTitle>Delete 3 files?</ToolCall.ApprovalTitle>
      <ToolCall.Approve />
      <ToolCall.Deny />
      <ToolCall.Receipt />
    </ToolCall.Approval>
  </ToolCall.Content>
</ToolCall.Root>
```

## API

<!-- api:tool-call -->

## Status

`pending`, `running`, `awaiting` (needs approval), `done`, `error`, `denied`, `cancelled`. With the AI SDK: `input-streaming` → `pending`, `input-available` → `running`, `approval-requested` → `awaiting`, `output-available` → `done`, `output-error` → `error`, `output-denied` → `denied`.

## Approval

| Attempt | Meaning |
|---|---|
| `awaiting` | A decision is asked (the details open; it is announced). |
| `submitting` | `onDecision` is running; the buttons are busy, another press is ignored. |
| `settled` | Decided (or resolved elsewhere); the Receipt says "Approved" or "Denied". |
| `failed` | `onDecision` rejected; the human can decide again. |
| `expired` | The request was cancelled before a decision. |

After `settled` or `expired`, the focus moves to the Receipt only if it was inside the Approval. `focusOnRequest="approval"` focuses Approve when a request arrives (only where the user expects it).

## Accessibility notes

- **Status in words**, in the Header's name; the icon shape changes too, never colour alone.
- **Announced**: a request for approval and a failure; a success is silent (the output is in the thread).
- **Duration** is measured on the environment's clock from the first live status, never from mount.

## Testing

```tsx
import { getToolCall } from "@rind-ui/testing"

const call = getToolCall(screen, { name: /delete_file/ })
await call.approve()
expect(await call.approvalState()).toBe("settled")
expect(await call.decision()).toBe("approved")
```

Contract actions: `toggle`, `approve`, `deny`. Queries: `status`, `isOpen`, `approvalState`, `decision`, `receiptText`.

## Tested with

<!-- tested-with:tool-call -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
