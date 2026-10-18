## MODIFIED Requirements

### Requirement: Chips Container And Names

The chips SHALL be rendered inside the host's Control, before the input, in a Chips part
with `role="toolbar"` labelled by the `chipsLabel` message. A host whose text control is a
bare textarea with no Control wrapper (Prompt Input) SHALL render the Chips inside its Root,
as a sibling of the textarea, before or after it in DOM order; the keyboard between the
input and the chips is unchanged. Each Chip SHALL be a focusable
element, roving within the toolbar (collections `roving` over the chip keys, one Tab stop
at most), named by its text. Each Chip MAY contain a ChipRemove button with `tabindex=-1`
named by `removeLabel(text)`. The input's `aria-describedby` SHALL reference a visually
hidden summary node whose text is the `tagsSummary(texts)` message. Every part SHALL carry
the host's `data-scope` (the connect helpers' `scope` parameter, e.g. `combobox`,
`tags-input` or `prompt-input`) and `data-part` `chips`, `chip`, `chip-remove` or
`chips-summary`.

#### Scenario: NVDA stays in focus mode (mui/base-ui#3629)

- **WHEN** an NVDA user arrows from the input onto the chips
- **THEN** the chips are inside an element with role `toolbar`, and NVDA stays in focus
  mode

#### Scenario: Host scope on every part

- **WHEN** the helpers are used with `scope: "tags-input"`
- **THEN** Chips, every Chip, every ChipRemove and the summary node carry
  `data-scope="tags-input"`, and the remove buttons are named "Remove Rome" and
  "Remove Paris" for the chips "Rome" and "Paris"

#### Scenario: Chips beside a textarea

- **WHEN** the helpers are used with `scope: "prompt-input"` and the Chips are rendered in
  the Prompt Input Root above its textarea
- **THEN** ArrowLeft at the textarea's caret start focuses the last chip, and ArrowRight past
  the last chip returns focus to the textarea
</content>
</invoke>
