# Tabs

A tab list with one roving tab stop and one panel per tab. Tabs are real `<button role="tab">` elements with an always explicit `aria-selected`; panels are `role="tabpanel"` labelled by their tab. The value is the selected tab's key (`string | null`).

```tsx
import { Tabs } from "@rind-ui/react"

<Tabs.Root defaultValue="account" onValueChange={(value) => save(value)}>
  <Tabs.List aria-label="Sections">
    <Tabs.Tab value="account">Account</Tabs.Tab>
    <Tabs.Tab value="billing">Billing</Tabs.Tab>
    <Tabs.Tab value="team" disabled>Team</Tabs.Tab>
    <Tabs.Indicator />
  </Tabs.List>
  <Tabs.Panel value="account">Account settings</Tabs.Panel>
  <Tabs.Panel value="billing">Billing settings</Tabs.Panel>
  <Tabs.Panel value="team">Team settings</Tabs.Panel>
</Tabs.Root>
```

## API

<!-- api:tabs -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `Tabs.Root` | `root` | `<div>`; `data-orientation`, `data-activation-direction`. |
| `Tabs.List` | `list` | `<div role="tablist">`; `data-orientation`, `data-activation-direction`, `data-focus`, `data-disabled`. Name it with `aria-label` or `aria-labelledby` (a development warning logs a nameless list). |
| `Tabs.Tab` | `tab` | `<button role="tab">`; `data-key`, `data-selected`, `data-highlighted` while it is the roving focus target, and the button-like `data-disabled`, `data-focus`, `data-focus-visible`, `data-pressed` and `data-hover`. |
| `Tabs.Panel` | `panel` | `<div role="tabpanel">`; `data-key`, `data-selected`, `data-reveal` after find-in-page. A panel with nothing tabbable inside is itself a tab stop. |
| `Tabs.Indicator` | `indicator` | Optional `<span aria-hidden>` inside the list; `data-state` (`visible` or `hidden`), `data-resizing`. |

## Keyboard

| Key | Action |
|---|---|
| Tab / Shift+Tab | The list is one tab stop (the selected tab); the next Tab goes to the panel. |
| Arrow Right / Left | Moves focus to the next / previous enabled tab (wraps unless `loop={false}`); mirrored in RTL. In `automatic` mode it also selects. |
| Arrow Down / Up | Same as Right / Left in a vertical list. |
| Home / End | Moves focus to the first / last enabled tab. |
| Enter / Space | Selects the focused tab. |

## Activation modes, and why focus never selects

`activationMode="automatic"` (default) selects when an arrow, Home or End moves focus. `"manual"` only moves focus; Enter or Space selects, which suits panels that are slow to render. In both modes a focus that does not come from a key (a screen-reader virtual cursor, a script, a dialog restoring focus, Tab) never selects (radix#1047): the selection follows the user's intent to switch, not where focus happens to land. A press (pointer, touch) selects in both modes.

## Panels and find-in-page

`inactivePanels` sets what happens to panels that are not selected:

- `unmount` (default): not rendered; the tab has no `aria-controls` (never dangling, radix#1703).
- `hidden`: rendered with `hidden`, keeping their state.
- `until-found`: rendered with `hidden="until-found"`. Browser find-in-page can match their text; the browser reveals the panel and Tabs selects its tab (`data-reveal="find-in-page"`, reason `find-in-page`). The theme never overrides `[hidden]`, as that would defeat this.

## Indicator variables

`Tabs.Indicator` exposes the selected tab's layout box relative to the list as `--rind-indicator-left`, `-right`, `-top`, `-bottom`, `-width` and `-height` (CSS pixels, ignoring transforms and scroll). Use them to slide a highlight. It re-measures on selection, registration and resize, and carries `data-resizing` when the change came from layout rather than selection, so you can skip the transition.

```css
[data-scope="tabs"][data-part="indicator"] {
  position: absolute;
  inset-block-end: 0;
  translate: var(--rind-indicator-left) 0;
  inline-size: var(--rind-indicator-width);
  transition: translate 180ms, inline-size 180ms;
}
[data-scope="tabs"][data-part="indicator"][data-resizing] { transition: none; }
```

## Tabs, Segmented Control or Toggle Group

- **Tabs**: one choice that shows a panel; the list is a navigation between views of the same page.
- **Segmented Control**: exactly one choice drawn as a joined strip, with no panels; arrows select.
- **Toggle Group**: independent or at-most-one pressed buttons; arrows only move focus.

## Styling

Style the `data-*` attributes above, or import `@rind-ui/theme/tabs.css`: structural only (a row, or a column for `data-orientation="vertical"`; the selected tab is heavier and underlined by the indicator, never colour alone; tabs of at least `--rind-hit-area`; no indicator transition under `data-resizing` or reduced motion; forced-colors mapping with a Highlight bottom border; tier-3 `--rind-tabs-*` tokens). The focus ring comes from `base.css`.

## Testing

Contract actions: `select(name)` (pointer and touch press the tab; keyboard arrows to it, then Enter), `focusTab(name)`, `press(name)`, `focus(name)`, `arrowNext()`, `leave()` (focuses a button named "After"). Queries: `tabs`, `selected`, `focusedTab`, `panel`, `isDisabled`.

```tsx
import { getTabs } from "@rind-ui/testing"

render(<Settings />)
const tabs = getTabs(screen, { name: "Sections" })
await tabs.select("Billing")
expect(await tabs.selected()).toBe("Billing")
await tabs.focusTab("Account")
expect(await tabs.selected()).toBe("Billing") // focus alone never selects
```

The same test runs with a Playwright `page`.

## Accessibility tree

<!-- aria:tabs--default -->
```yaml
- tablist "Sections":
  - tab "Account" [selected]
  - tab "Billing"
  - tab "Team"
- tabpanel "Account":
  - paragraph: Account settings
- button "After"
```
<!-- /aria -->

## Tested with

<!-- tested-with:tabs -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
