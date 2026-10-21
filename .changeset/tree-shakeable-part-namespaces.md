---
"@rind-ui/react": patch
---

Compound components expose their parts as module namespaces instead of objects, so Vite,
Rollup, Rolldown and webpack drop the parts an app never renders (`Dialog.Root` alone: 23.5 →
13.9 kB gzip; a Color Picker with Root, Area and ChannelSlider: 85.6 → 68.4 kB). Same API:
`import { Dialog } from "@rind-ui/react"` and `<Dialog.Root>` work as before.
