---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Navigation Menu: site navigation following the disclosure navigation pattern, a named `nav` landmark whose triggers open panels of links.

- **Opening.** Press, Enter or Space toggle; a mouse or pen resting on a trigger opens it after `openDelay`, with a grace area towards the panel, immediate switching while open, a warm window after a close, and the press that follows a hover open keeping it open. `openOnHover={false}` keeps press and keys only.
- **Closing and focus.** Escape closes the innermost level and returns focus to its trigger; an outside press, focus leaving the menu and a same-tab link activation close every level. The open panel follows its trigger in the Tab order wherever it renders.
- **Parts.** `Root`, `List`, `Item`, `Trigger`, `Content`, `Link`, `Indicator`, `Viewport`, `Positioner`, `Sub`. Closed panels stay in the document with `hidden` (`closedContent="unmount"` removes them). A shared `Viewport` animates its size between panels (`content-size` gains a part name for its properties).
- **Contract and driver.** `getNavigationMenu`.
- **Theme.** `navigation-menu.css`.
