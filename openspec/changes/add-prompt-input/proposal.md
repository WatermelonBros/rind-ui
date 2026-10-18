## Why

Every AI product has a prompt box, and every implementation we read gets the same things
wrong: the Enter that confirms a Japanese or Chinese conversion sends a half-written message
(vercel/ai-elements#21, #400; assistant-ui/assistant-ui#8199, #8319; prompt-kit and the
shadcn chatbot kit have no guard at all), a stuck composition flag freezes the input
(assistant-ui/assistant-ui#3923), Enter sends a second message while a reply streams
(vercel/ai-elements#439, #185; Blazity/shadcn-chatbot-kit#11), a failed send loses the
user's attachments or erases what they typed meanwhile (vercel/ai-elements#126, #518;
assistant-ui/assistant-ui#8242), pasting a spreadsheet attaches a picture
(vercel/ai-elements#509), and rejected files vanish silently (vercel/ai-elements#511). No
headless library ships it. rind already has the pieces — the IME guard, the autosize
module, the chips helpers, the announcer — and Prompt Input is the first component that
puts them together.

Research: [prompt-input](../../../docs/research/prompt-input.md) (sources, Bug history,
Accessibility, Decisions) · [text-field](../../../docs/research/text-field.md) (autosize,
count, IME rules) · [tags-input](../../../docs/research/tags-input.md) (`input-chips`) ·
[accessibility](../../../docs/research/accessibility.md) §6, §7.4–7.5 ·
[assistive-tech-and-a11y-testing](../../../docs/research/assistive-tech-and-a11y-testing.md) ·
[native-platform](../../../docs/research/native-platform.md) §11–12

**Depends on** (all archived) `add-foundations`, `add-a11y-foundations` (keyboard
normalisation and the IME guard, press, modality, announcer, messages, invariants),
`add-field` / `add-form` (`field-control`, `use-field-host`), `add-text-field`
(`autosize-textarea`, `defaultCount`, `countAnnouncement`), `add-button`
(`button-like-element`), `add-combobox` / `add-tags-input` (`input-chips`) and
`add-theme-system`.

## What Changes

- New capability **`prompt-input`**: a native `<form>` with a `<textarea>` draft
  (`field-sizing: content`, fallback `autosize-textarea`), IME-safe submit keys, the request
  lifecycle `idle` / `composing` / `submitting` / `streaming` / `stopped` driven by the
  consumer's callbacks and `status` (no model inside), one Submit button that becomes Stop,
  attachments as `input-chips` parts with picker, paste and drop intake, validation,
  removal and announcements, an optional character or token limit, opt-in history recall,
  parts, `data-*`, contract and driver.
- `@rind-ui/core`: `ai/prompt-input` machine, connect, contract, messages; a small
  `core/dom/file-intake.ts` (accept matching, clipboard and drop extraction, `DataTransfer`
  sync to the file input) that File Upload will reuse.
- `@rind-ui/react`: `PromptInput.Root`, `Label`, `Description`, `Textarea`, `Submit`,
  `AttachTrigger`, `Attachments`, `Attachment`, `AttachmentRemove`, `CharacterCount`.
- `@rind-ui/testing`: `getPromptInput` driver; model-based coverage.
- Theme stylesheet (`--rind-prompt-input-*`), site examples, docs page.

## Capabilities

### New Capabilities

- `prompt-input`: the Prompt Input component — draft, keys, IME, lifecycle, submit/stop
  contract, attachments, limits, history, focus, announcements, parts, attributes,
  contract.

### Modified Capabilities

- `input-chips`: "Chips Container And Names" names the host's container for a host whose
  chips sit beside, not inside, a text control (Prompt Input: the Root). Delta in
  `specs/input-chips/spec.md`.

## Non-goals

- Any model, transport, streaming parser or token counter inside the component (the
  consumer passes `count` for token limits; Context Meter shows context usage).
- Rendering the reply, "Assistant is responding" announcements, the message list
  (Streaming Message, Message Thread).
- Mentions / Slash Commands (inline combobox on the textarea) and Suggestions (prompt
  chips) — later components; this change only fixes the seams they plug into.
- Rich text / `contenteditable` (native-platform §12: avoid).
- Previews and object URLs, upload transport and progress UI (consumer markup; an
  attachment can be marked `pending`).
- Queued or steered sends while a reply streams (assistant-ui's queue).
- Escape to stop (Escape belongs to the enclosing layer; assistant-ui/assistant-ui#8199).
- Turning a long paste into an attachment (docs recipe through `onPaste`).
- Voice dictation, screenshots, model pickers, tool menus (consumer markup next to the
  parts).
- Framework adapters other than React; fx.

## Impact

- New code: `packages/core/src/ai/prompt-input/{prompt-input.machine,prompt-input.connect,prompt-input.contract,prompt-input.messages}.ts`,
  `packages/core/src/dom/file-intake.ts`, `packages/react/src/prompt-input/*`,
  `getPromptInput` in `@rind-ui/testing`, `packages/theme/src/prompt-input.css`,
  `apps/site/examples/prompt-input.tsx`, generated docs page.
- Public API: `prompt-input` machine/connect/contract, `PromptInput` parts,
  `getPromptInput`, `PromptAttachment` and `PromptInputStatus` types.
- `docs/components.md`: Prompt Input status `spec`.
- No new runtime dependency.
</content>
</invoke>
