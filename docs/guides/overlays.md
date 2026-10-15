# Overlays

Dialogs, popovers, menus and drawers share one layer stack per document that decides who is
on top, what dismisses what, where focus goes, what is inert and whether the page scrolls;
a component only registers its layer.

## The layer stack and parentage

The stack lives on the `document` under a versioned key, so two copies of `@rind-ui/core`
(a duplicated dependency, a micro-frontend) share one stack instead of each believing it is
on top.

A layer's parent is, in order: the layer from the React context, the open layer whose
elements contain the layer's opener, else the root. Wrap the content of a layer in
`LayerProvider` and everything opened from inside it is nested; a dialog opened from a
button that merely sits next to another dialog is its **sibling**, never its child, however
the two were opened.

```tsx
<LayerProvider layer={layerId}>{children}</LayerProvider>
```

Membership never depends on DOM position, so a portalled child of a layer still belongs to
it and an inline one behaves the same.

## Dismissal

- **Escape** closes the topmost layer only, from a document `keydown` in the bubble phase.
  A widget inside that calls `preventDefault()` on Escape keeps the layer open, and so does
  an IME composition.
- **Outside press**: the press must go down and come up outside every layer, after the layer
  opened. Mouse dismisses on release; touch and pen on the following `click`. A bare
  `click` (a screen reader activating something) never dismisses, and neither does a press
  on a scrollbar, a right click, or a press inside a layer that is still exiting.
- A press outside a stack of non-modal layers closes them top-down until it reaches the layer
  that contains it; a modal layer stops the cascade.
- **Reasons and `cancel()`**: every request carries a `reason` (`escape-key`,
  `outside-press`, `outside-focus`, `parent-dismissed`) and can be vetoed; a vetoed request
  goes no further.

```ts
onOpenChange(details) {
  if (details.reason === "outside-press" && formIsDirty) details.cancel()
}
```

- **Dismiss surfaces**: a layer can mark its backdrop (and a positioner larger than its
  content) as dismiss surfaces; a press that starts and ends on one counts as outside for
  that layer but still belongs to it for focus, inert and presence.
- **Top-layer regions**: mark an always-on-top region (toasts, a cookie banner) with
  `data-rind-top-layer`. Pressing in it never dismisses a layer, and it is never made inert.

## Focus

- **Initial focus** goes where the component says (an autofocus element, the first tabbable,
  or the container after a touch open). It is skipped if the user already moved focus
  inside the layer; focus that was only lost to `<body>` (the trigger became inert) is not
  a user move.
- **Tab wrap** is done at the edges of the layer by computing the tab order, with no
  sentinel elements: nothing extra for screen readers to find, and axe stays quiet.
- **Recovery**: if the focused element is removed, focus returns to the layer instead of
  falling to `<body>`.
- **Restore** on close, only when focus is inside the closing layer or on `<body>`, trying in
  order: the component's choice, the opener or the element focused before opening, the most
  recent still-connected element of the focus history, the parent layer. It runs after
  `inert` is removed, because focusing an inert trigger does nothing.

## Hiding the rest of the page

While a modal layer is topmost, everything outside it is `inert`. Rind never uses
`aria-hidden` for this: `inert` also blocks focus and clicks and cannot leave a focusable
element hidden from the accessibility tree.

- The walk is ref-counted and remembers an author's own `inert`, so overlapping layers
  and teardown in any order restore the page exactly.
- **Kept visible**: the announcer, `aria-live` regions and `role="status|alert|log"`, and
  anything marked `data-rind-top-layer`.
- **Late nodes are left alone.** Nodes added to `<body>` after the layer opened (password
  managers, extensions, a third-party widget's portal) are neither made inert nor counted
  as "outside". The cost is that a screen-reader cursor can reach such a node; content
  mounted inside an existing page root is covered because the root is already inert.

## Scroll lock

One lock per document while any modal layer is open, with no `position: fixed` body and no
change to the scroll position.

- The scrollbar's width is added as padding on the scroller and published as
  `--rind-scrollbar-width`; use it for `position: fixed` elements that would otherwise jump:
  `right: calc(1rem + var(--rind-scrollbar-width, 0px))`.
- `data-rind-scroll-locked` is set on the scroller while locked, for styling.
- If the author already reserves space with `scrollbar-gutter: stable`, no padding is added.
  Rind never sets `scrollbar-gutter` itself.
- On iOS, where `overflow: hidden` does not stop the page, one `touchmove` listener prevents
  only gestures that would scroll the page behind the topmost modal; scrolling inside the
  layer and pinch zoom keep working. Check it on a real device: simulators do not scroll
  like iOS.

## Presence and animation

Closing is immediate: `data-state="closed"` is applied at once, the content becomes inert
and the layer leaves the stack, and the part stays mounted only while its exit animations
run. `data-state="closed"` is therefore the hook for an exit transition or keyframes; for
entry use `@starting-style`.

```css
[data-scope="dialog"][data-part="content"] {
  transition: opacity 150ms, translate 150ms;
  @starting-style { opacity: 0; translate: 0 8px; }
  &[data-state="closed"] { opacity: 0; translate: 0 8px; }
}
```

Presence reads `getAnimations()` after the closed state is applied, so CSS transitions,
keyframes and the Web Animations API need no events. A JS animation library (Motion, GSAP)
that does not register with `getAnimations` should take over the lifetime instead:

```tsx
const { mounted } = usePresence(open, ref, { keepMounted: true, onExitComplete })
```

`keepMounted` never unmounts (the library animates, then hides); `onExitComplete` fires when
the exit ended. The unmount is committed synchronously so no frame shows the resting style.
Presence resolves at once in a hidden tab, when nothing is animating, and where `getAnimations`
is missing.

## Inside a native `<dialog>` or popover

The top layer paints above everything, so a portal into `body` would be invisible behind an
open `<dialog>` opened with `showModal()`. The portal target is resolved, in order, from
`container`, the closest open `dialog:modal`, `:popover-open` or fullscreen element that
contains the logical parent, the shadow root of the logical parent, and `body`. Pass
`logicalParent` (usually the trigger) to `Portal` and it works inside a native dialog with no
further setup. Rind's own layers do not use `showModal()`: native modality would make every
portalled child and every toast inert.

## Testing overlays

Give the component's contract the `modal` and `presence` traits and the model-based tests
check them after every step:

- `modal`: everything outside that existed before opening is inert (or kept visible), focus
  is inside the layer, the page is scroll-locked, `<body>` has no `pointer-events` style,
  and after closing none of it remains. Nodes added while open are ignored, as above.
- `presence`: closed content that is still mounted has `data-state="closed"` and a running
  exit animation, and is gone once none runs.

jsdom has no real `inert`, layout or `getAnimations`: the traits check attributes there and
presence resolves immediately (`@rind-ui/testing/setup`). Inert, Tab wrap and scroll lock are
asserted in browser mode. Real iOS scrolling and screen-reader speech are in the
[manual protocol](../accessibility/manual-protocol.md).
