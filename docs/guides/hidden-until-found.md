# Collapsed content that find-in-page can reach

Collapsible content can render closed as `hidden="until-found"`: hidden from view and from
assistive technology, but the browser's find-in-page (and fragment links) can still match
it. When a match is found the browser fires `beforematch`; the component opens with reason
`find-in-page` and marks the content `data-reveal="find-in-page"`.

- Opt in per component with `hiddenUntilFound`. In browsers without support the content
  falls back to plain `hidden`.
- `untilFound(element, { scheduler, isOpen, onReveal })` keeps the attribute in sync after
  every render — React would otherwise leave the browser's removal in place.
- Do not override `[hidden]` with `display: none` in CSS: it defeats until-found.
  `@rind-ui/theme` skips the opening animation for `[data-reveal="find-in-page"]` so the
  match is shown at once.
- Server rendering: React 19 serialises `hidden="until-found"` as `hidden=""`, so server
  HTML has plain `hidden` and the content is upgraded to `until-found` right after
  hydration.
- Deep links: after hydration, if the URL's fragment (`location.hash`) points inside closed
  content, the component opens it with reason `find-in-page` and scrolls the target into
  view.
- Limitation: find-in-page before hydration completes cannot reach closed content.
