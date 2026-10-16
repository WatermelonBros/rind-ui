# Dogfooding

The site uses rind components wherever one exists, and swaps in the rind component as soon
as it ships. This lists every site-built piece still waiting for its rind counterpart.

| Site piece | Where | Today | Becomes |
|---|---|---|---|
| Skin switch (crisp / juicy / bare) | `components/example-frame.tsx`, `components/home/any-look.tsx` | three `Toggle`s | Segmented Control |
| Copy code | `components/example-frame.tsx` | `Button` + `navigator.clipboard` | Clipboard |
| Code block | `lib/docs.ts`, `components/example-frame.tsx` | highlight.js `<pre>` | Code Block (roadmap, wave 2, first in line) |
| API and docs tables | `lib/docs.ts` (markdown tables) | `<table>` in a focusable scroll box | Table |
| On this page | `app/docs/[slug]/page.tsx` | links | Table of Contents |
| Docs filter | `components/sidebar.tsx` | `TextField` | Combobox or Command |

Already rind: `Tabs` (code panel), `Switch` (page phase), `Toggle`, `Button`, `TextField`, `Collapsible` (mobile docs menu), `Heading.Level`, `Tooltip` (planned frameworks)
(example outlines), every live example and hero specimen.
