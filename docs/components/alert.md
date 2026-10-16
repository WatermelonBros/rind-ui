# Alert

An inline message in the page layout ("Couldn't save", "Connection lost", "Maintenance
tonight"). It never takes focus and is never a live region of its own: it announces through
rind-ui's Announcer, once when it appears after the page has loaded and once each time its
text changes while shown. A dismissal keeps focus on the page, never on `body`.

```tsx
import { Alert } from "@rind-ui/react"

{error && (
  <Alert.Root announce="assertive" data-tone="danger">
    <Alert.Icon label="Error"><ErrorIcon /></Alert.Icon>
    <Alert.Title>Couldn't save</Alert.Title>
    <Alert.Description>The disk is full.</Alert.Description>
    <Alert.CloseTrigger><CrossIcon /></Alert.CloseTrigger>
  </Alert.Root>
)}
// announced once: "Error. Couldn't save. The disk is full." (assertive)
```

## API

<!-- api:alert -->

## Which `announce`

| `announce` | Use it for | What is announced |
|---|---|---|
| `"polite"` (default) | Advisory messages: "Message sent", "Connection lost", a status that updates | The text, politely, when the alert appears after load and when its text changes |
| `"assertive"` | Important, time-sensitive messages: errors, failures, a session about to expire | The same, interrupting |
| `"off"` | Static content: a banner present at load, an archived-project notice, an alert inside a toast (the toast announces itself) | Nothing, ever |

The tone is styling only: `data-tone="danger"` does not make an alert assertive, and
`announce` never changes a `data-*` attribute the theme reads.

## Why there is no `role="alert"`

A live region in the visible tree is spoken when it is inserted, re-spoken when it moves
(a keyed list reordering, ariakit#7235), spoken at page load for server-rendered content
(mui/material-ui#49440), missed when the region is created in the same frame as its text
(chakra-ui#3240), and hidden from assistive technology when a modal hides everything
outside itself. The Announcer avoids all of it: its regions exist before the first message
and survive hide-outside, and each alert's messages share one key, so Strict Mode's double
mount and bursts of text changes collapse into one.

If you add `role="alert"` or `aria-live` to Root anyway, the attribute is forwarded and a
development warning names the `announce` prop; the model-based tests' "no live region of its
own" invariant fails for that wrapper.

## Silent at page load

An alert that was server-rendered and hydrated is part of the page the user arrives on: it
is read with the page, not announced. Only an alert that mounts on the client after
hydration, or whose `open` becomes `true`, is announced. Re-rendering or moving a shown alert
without changing its text announces nothing.

## The announced text

The message is built from the labelled Icon, the Title and the Description, in that order,
each ending a sentence ("Error. Couldn't save. Disk full."). Without a Title or Description it
is the Root's text. Text inside `aria-hidden` or `hidden` elements and the CloseTrigger is
left out; visually hidden text is kept. Pass `announcement` to say something else
("3 errors in the form. Fix them and submit again."), or override
`messages.announcement(segments)` to join segments for another language. The message carries
the alert's locale.

Severity must be in words, not only in colour or an icon: put it in the Title
("Error: couldn't save") or name the Icon (`<Alert.Icon label="Error">`), which makes it an
image named "Error" and the first sentence announced.

## Dismissal and focus

`Alert.CloseTrigger` is a native `button type="button"`; without text it is named by
`messages.dismiss` ("Dismiss"). Activating it calls `onOpenChange(false, { reason:
"close-trigger" })`; the Root stays mounted with `data-state="closed"` while its exit
animation runs, then unmounts. Nothing is announced on dismissal.

When the alert is dismissed with focus inside it, focus moves **before** `onOpenChange` runs,
so an app that unmounts the alert in response cannot strand focus on `body`: to
`finalFocus()` when it returns an element, else to the next tab stop after the alert, else to
the previous one. `finalFocus={() => false}` leaves focus alone. Escape does not dismiss an
alert, and it never closes by itself.

## Error summary in a form

```tsx
{errors.length > 0 && (
  <Alert.Root
    announce="assertive"
    announcement={`${errors.length} errors in the form. Fix them and submit again.`}
  >
    <Alert.Title>{errors.length} errors</Alert.Title>
    <Alert.Description>
      <ul>{errors.map((e) => <li key={e.id}><a href={`#${e.id}`}>{e.message}</a></li>)}</ul>
    </Alert.Description>
  </Alert.Root>
)}
```

The Alert does not move focus when it appears; if your form moves focus to the first invalid
field (Form does), the announcement still tells the user how many errors there are.

## Region recipe

A long-lived alert can be a landmark: give Root `role="region"` and name it with the Title's
stable id, `alert-<id>-title` (`alertIds(id).title` from `@rind-ui/core`).

```tsx
<Alert.Root id="release" announce="off" role="region" aria-labelledby="alert-release-title">
  <Alert.Title>New release</Alert.Title>
</Alert.Root>
```

## Alert, Toast or Alert Dialog

- **Alert**: in the page layout, stays until the page or the user removes it, never takes
  focus.
- **Toast**: floats over the page and times out; set `announce="off"` on an Alert rendered
  inside a toast, since the toast announces its own text.
- **Alert Dialog**: interrupts and requires a decision; it takes focus.

## Styling

`@rind-ui/theme` styles it in the `status` family: `data-variant` `soft` (default), `solid`,
`outline`; `data-size` `sm`, `md`, `lg`; every `data-tone`. Tokens: `--rind-alert-bg`,
`-text`, `-border`, `-radius`, `-padding`, `-gap`, `-font-size`, `-icon-size`,
`-title-font-weight`, `-close-size`, `-duration`. The CloseTrigger target is at least 24×24 CSS
px, the layout uses logical properties (RTL mirrors), forced colors keep a border, and the
exit transition is zero under reduced motion.

## Testing

```tsx
import { getAlert } from "@rind-ui/testing"

const a = getAlert(screen, { title: "Couldn't save" })
await a.announcements() // [] — read before the alert appears
await user.click(screen.getByRole("button", { name: "Save" }))
await a.announcements() // [{ message: "Couldn't save. Disk full.", priority: "assertive" }]
await a.dismiss() // pointer, touch or keyboard on the CloseTrigger
await a.isOpen() // false; focus is on the next control, never on body
```

The same test runs with a Playwright `page`. `getAlert(screen, { within })` finds the one
alert inside a container.

## Tested with

<!-- tested-with:alert -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
