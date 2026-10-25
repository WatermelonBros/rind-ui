---
"@rind-ui/angular": minor
---

New package `@rind-ui/angular` (`@angular/core` ≥ 21): the same machines, ARIA and drivers as
`@rind-ui/react`, ported one component at a time (this release: Toggle, Button, Separator, Kbd,
Badge, Heading, Label, Link, Skeleton, Progress, Meter, Image, Avatar, Alert, Toggle Group, Fieldset, Field,
Text Field, Checkbox, Checkbox Group, Switch, Radio Group, Segmented Control, Collapsible,
Accordion, Tabs, Toolbar, Breadcrumbs, Pagination, Rating, Slider, Number Input, Pin Input, Splitter, Stepper, Timeline, Table of
Contents, Scroll Area, Marquee, QR Code, Clipboard, Code Block, Form, File Upload, VisuallyHidden, Listbox, Tag
Group, Grid List, Tree View, Sortable, Popover, Tooltip, Hover Card, Dialog, Drawer, Toast, Table
with its Filter parts, Menu, Context Menu, Menubar, Navigation Menu, Select, Combobox, Tags Input,
Calendar, Date Field with its picker, Color Picker, Image Viewer, Image Cropper, Tour, Message
Thread, Streaming Message, Reasoning, Prompt Input;
the form toggle bases, for a toggle of your own). Parts are attribute directives on your own elements
(`<button rindToggleRoot [(pressed)]="bold">`), so no wrapper element is added and any host element
keeps the behaviour; a part that renders elements of its own (Kbd, Badge) is a component with an
attribute selector, and a part that is a Button or a Link (Pagination's pages and triggers) is
the one its element asks for: `<button>`, or `<a>` with `getPageHref`; a Stepper's Trigger is `<button>` while its step is reachable,
`<span>` otherwise; a Marquee's Content is a structural directive (`<div *rindMarqueeContent>`),
stamped once per copy; a Drawer's Handle is `<button>` with two or more measured snap points
(`d.handleIsButton()`), `<div>` otherwise. A layer's portal is a template
(`<ng-template rindPopoverPortal>`, `<ng-template [rindToaster]="store" let-toast>`), rendered into
`body` after the first render with the trigger's dir, lang and theme; a Table Filter's content goes
in `<ng-template rindTableFilterPortal>` with a FilterPositioner around it. A Menu item's activation is `(itemSelect)`
(a native `select` event bubbles); Select, Combobox and Tags Input options are the Listbox
parts under their own names (`rindSelectItem`), their data rows from the Root's `groups()`. A Date Field
is a range field with `selectionMode="range"` on its Root; a Color Picker Channel Input is a text
field for `channel="hex"` or `"css"` and a Number Input for any other channel; an inline Color
Picker has its Content in place (no Portal or Positioner). A Tour Root is an `<ng-container>`
(`injectTour()` gives a handle for `[tour]`), its actions a template
(`<ng-template rindTourActions let-actions>`). A Prompt Input is `<form rindPromptInputRoot>`; its send
is the `submitHandler` input (it may return a promise), its Attachments take an
`<ng-template let-a>` chip; a Streaming Message's Content shows the text when it has no content of
its own. A part React renders nothing for in some state (a loaded Skeleton's Status, a
dismissed Alert, an inactive Tab's panel) keeps your element, hidden. Controlled values are an input and a `<value>Change` output (`[(pressed)]`),
with `<value>ChangeDetails` for vetoing a change. Published as Angular partial compilation, linked
by your application's build.
