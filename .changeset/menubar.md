---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Add Menubar: a named bar of menu items, one tab stop with arrow keys and typeahead, one open-menu `value` (`onValueChange` with kebab-case reasons), switching menus by press, hover and the arrow keys inside a menu, vertical bars, modal menus with the bar kept interactive, the `getMenubar` driver (`menu(name)` returns the item's Menu driver) and `menubar.css`. The runtime accepts a transition `reason` computed from the event; `MenuTreeHost.press` receives the press's modality.
