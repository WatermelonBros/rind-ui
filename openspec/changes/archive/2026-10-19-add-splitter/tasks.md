## 0. Prerequisites

- [x] 0.1 Research note `docs/research/splitter.md` done; `pointer-drag` (add-slider) applied

## 1. Math and machine (`core/components/splitter/`)

- [x] 1.1 `splitter.math.ts`: resolve and validate sizes, clamp with collapse snap, the resize-by-delta port (attributed), handle bounds
- [x] 1.2 `splitter.machine.ts`: `idle | dragging`, events per design §2, controllable `sizes`, `onSizesCommit`, `onProps` (`panels`, `disabled`)
- [x] 1.3 Node tests of the math and of every transition

## 2. Connect (`splitter.connect.ts`)

- [x] 2.1 Root, Panel, Handle props per design §4; key mapping per orientation and direction
- [x] 2.2 Pixel constraint resolution (`resolveConstraints`) and the drag axis

## 3. Parts (`@rind-ui/react`)

- [x] 3.1 `Splitter.Root`, `Panel`, `Handle` with `render`; ResizeObserver on the Root; press through `pointerDragSession`; focus on press without ring
- [x] 3.2 Development warning for an unnamed handle; SSR + hydrate test

## 4. Contract and driver

- [x] 4.1 `splitter.contract.ts` and `splitter.meta.ts` per design §6
- [x] 4.2 `getSplitter` driver

## 5. Tests

- [x] 5.1 Model-based `testMachine(splitterContract)`: keyboard in jsdom, pointer, touch, keyboard and virtual in browser mode; horizontal, vertical, collapsible, three panels, controlled
- [x] 5.2 Browser tests for the scenarios, regressions citing their issues (RRP#740, RRP#688, RRP#720, RRP#692, zag#2417, zag#3223, Ark#2967), nested splitters, RTL

## 6. Theme, examples, docs

- [x] 6.1 `packages/theme/src/splitter.css`: tier-3 tokens, hit area, focus ring, dragging cursor, forced colors; theme browser test
- [x] 6.2 Site examples (state examples, ARIA snapshots) and the site skin
- [x] 6.3 Docs page with When to use, persistence, 2.5.7 alternative, driver; components.md status; changeset
