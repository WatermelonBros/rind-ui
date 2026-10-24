---
"@rind-ui/vue": minor
"@rind-ui/svelte": minor
"@rind-ui/core": patch
"@rind-ui/testing": minor
---

New packages: `@rind-ui/vue` (Vue ≥ 3.5) and `@rind-ui/svelte` (Svelte ≥ 5.29). Same machines,
ARIA and drivers as `@rind-ui/react`; components are ported one at a time (this release: Toggle,
Button, Separator, Kbd, Badge, Heading, Label, Link, Skeleton, Progress, Meter, Avatar, Image,
Alert, Toggle Group, Fieldset, Field, Text Field, Checkbox, Checkbox Group, Switch, Visually
Hidden, Radio Group, Segmented Control, Collapsible, Accordion, Tabs, Toolbar, Breadcrumbs,
Pagination, Rating, Slider, Number Input, Pin Input, Splitter, Stepper, Timeline, Table of Contents, Scroll Area, Marquee, QR Code, Clipboard, Code Block, Form, Form Toggle (Svelte public parts), File Upload, Tag Group, Listbox, Grid List, Tree View). `@rind-ui/core/internal` gains
the framework-neutral helpers the adapters share; `@rind-ui/testing` exports `canonicalHtml` to
compare a component's markup across frameworks. Every `@rind-ui` library package now ships at
one version (a Changesets fixed group).
