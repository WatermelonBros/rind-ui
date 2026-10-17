## MODIFIED Requirements

### Requirement: Press Ends On Focus Loss Or Hidden Document

A press in progress SHALL end when the pressable part loses focus (a `blur` of the part,
for a part that had focus) or when the document becomes hidden (`visibilitychange` with
`document.visibilityState === "hidden"`: a tab or app switch during the press). The press
SHALL end with `PRESS.CANCEL`, no `PRESS` SHALL be delivered for it (neither from a later
keyup, `pointerup` or `click` nor from the click fallback), and `data-pressed` SHALL be
removed. This applies to pointer and keyboard presses alike, except that a pointer press SHALL NOT
end when focus moves from the part to one of its ancestors: WebKit and Safari do not focus
a button on mousedown and move focus to its nearest focusable ancestor (a dialog's
content), which is the press's own focus change, not an interruption. Without it a link that opens a
new tab with Enter, or a button whose keyup is lost to a tab switch, stays `data-pressed`
(react-spectrum#6094).

#### Scenario: Enter opens a new tab (react-spectrum#6094)

- **WHEN** the user presses Enter on a link-like part, the document becomes hidden before
  the keyup, and the keyup never arrives
- **THEN** the machine receives `PRESS.START` and `PRESS.CANCEL` and no `PRESS`, and the
  part no longer carries `data-pressed`

#### Scenario: Focus moves away during a held Space

- **WHEN** the user holds Space on a button and focus moves to another element before
  Space is released
- **THEN** the machine receives `PRESS.CANCEL`, `data-pressed` is removed, and releasing
  Space delivers no `PRESS`

#### Scenario: Tab switch during a touch press

- **WHEN** a touch press is in progress on a button and the document becomes hidden
- **THEN** the machine receives `PRESS.CANCEL` and no `PRESS`, even if a `pointerup` or
  `click` arrives when the document is shown again

#### Scenario: Mouse press on a focused close trigger in WebKit

- **WHEN** a dialog's close trigger has focus and the user clicks it in WebKit, which
  moves focus to the dialog's content on mousedown
- **THEN** the press is not cancelled and the click delivers one `PRESS`
