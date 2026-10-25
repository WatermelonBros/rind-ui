# @rind-ui/svelte

## 1.2.0

### Minor Changes

- 9aa73fa: Vue and Svelte: Message Thread, Streaming Message, Reasoning and Prompt Input (with
  `usePromptInput()`), each with React's contract models and markup parity. Every component of
  `@rind-ui/react` now ships in both adapters.
- 3cfd40d: Vue and Svelte: Image Viewer, Image Cropper, and Color Picker with its Area, channel Sliders, Field and Channel Field, Swatch
  and Swatch group (internal parts, as in React), each with React's contract models and markup
  parity.
- 945b493: Vue and Svelte: Table, Sortable, Tooltip, Hover Card, Dialog, Drawer, Toast, Menu, Context Menu,
  Menubar, Navigation Menu, Select, Combobox, Tags Input, Tour, Calendar and Date Field (single,
  range and picker). Parts that positioning or the scroll lock style keep those styles across
  re-renders.
- e5140db: Vue and Svelte: Popover, with a Portal and the layer context the overlays share (outside
  presses, Escape and focus return follow the nesting). `canonicalHtml` rounds measured lengths
  to whole pixels, drops an empty `style` and treats a generated `data-value` as one token, so
  two renders of one component compare equal across engines.

### Patch Changes

- Updated dependencies [aefab08]
  - @rind-ui/core@1.2.0

## 1.1.0

### Minor Changes

- 6d53336: New packages: `@rind-ui/vue` (Vue ≥ 3.5) and `@rind-ui/svelte` (Svelte ≥ 5.29). Same machines,
  ARIA and drivers as `@rind-ui/react`; components are ported one at a time (this release: Toggle,
  Button, Separator, Kbd, Badge, Heading, Label, Link, Skeleton, Progress, Meter, Avatar, Image,
  Alert, Toggle Group, Fieldset, Field, Text Field, Checkbox, Checkbox Group, Switch, Visually
  Hidden, Radio Group, Segmented Control, Collapsible, Accordion, Tabs, Toolbar, Breadcrumbs,
  Pagination, Rating, Slider, Number Input, Pin Input, Splitter, Stepper, Timeline, Table of Contents, Scroll Area, Marquee, QR Code, Clipboard, Code Block, Form, Form Toggle (Svelte public parts), File Upload, Tag Group, Listbox, Grid List, Tree View). `@rind-ui/core/internal` gains
  the framework-neutral helpers the adapters share; `@rind-ui/testing` exports `canonicalHtml` to
  compare a component's markup across frameworks. Every `@rind-ui` library package now ships at
  one version (a Changesets fixed group).

### Patch Changes

- Updated dependencies [175c5cf]
- Updated dependencies [6d53336]
  - @rind-ui/core@1.1.0
