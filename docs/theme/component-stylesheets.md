# Component stylesheets

How a component is themed. Spec: `openspec/specs/theme-variants` and `design-tokens`
(change `add-theme-system`). Checked by `packages/theme/src/lint.test.ts`.

## The convention

- One stylesheet per component: `packages/theme/src/<scope>.css`, `<scope>` being the
  component's `data-scope`. Importable on its own after `tokens.css`; exported as
  `@rind-ui/theme/<scope>.css`.
- Everything inside `@layer rind.components`. Unlayered consumer CSS always wins.
- Selectors use `:where()` (zero specificity) on `data-scope`, `data-part`, state attributes
  and the consumer attributes `data-variant`, `data-size`, `data-tone`. Never classes, never
  DOM position.
- Tier-3 tokens `--rind-<scope>-<name>` are **read, never declared**, always with a tier-2
  fallback, so an override on an ancestor is never shadowed:

```css
@layer rind.components {
  :where([data-scope="button"][data-part="root"]) {
    min-block-size: var(--rind-button-height, var(--rind-size-control, var(--rind-size-md)));
    border-radius: var(--rind-button-radius, var(--rind-radius-control));
  }
  :where([data-scope="button"][data-part="root"][data-variant="solid"]) {
    background: var(--rind-button-solid-bg, var(--rind-color-accent-solid));
    color: var(--rind-button-solid-fg, var(--rind-color-accent-on-solid));
  }
}
```

- Never read `--rind-brand-*` (only `tokens.css` does) and never write a literal colour: use
  palette role tokens (`--rind-color-accent-*`, `-neutral-*`, `-text`, `-border`, …).
  Tone is free: `data-tone` re-points the accent roles, so read accent roles only.
- A scope never equals a tier-2 category (`color space size radius text font leading shadow
  duration ease focus border`), and no tier-3 name equals a tier-2 name.
- Runtime variables written by core (`--rind-x`, `--rind-y`, `--rind-available-*`,
  `--rind-anchor-*`, `--rind-transform-origin`, `--rind-arrow-*`, `--rind-scrollbar-width`,
  `--rind-pop-from`, …) are not themeable tokens; the manifest lists them as `runtime`.
- Do not hide with `[hidden]` rules (`hidden="until-found"` must keep working).

## Family matrix

A component belongs to exactly one family; the data lives in `packages/theme/src/families.ts`.
Default first.

| Family | Components | `data-variant` | `data-size` |
|---|---|---|---|
| action | Button, Toggle | solid, soft, outline, ghost | md, sm, lg |
| toggle item | Toggle Group item, Toolbar button / link / toggle, Menubar trigger, Navigation Menu trigger and bar link | ghost, soft, outline | md, sm, lg |
| field | Text Field, Select / Combobox control, Number Input, Date / Time (Range) Field, Date (Range) Picker fields | outline, soft | md, sm, lg |
| choice | Checkbox, Radio, Switch | solid, soft | md, sm, lg |
| selector | Tabs list | ghost (underline), soft (pill) | md, sm, lg |
| selector | Segmented Control | soft, outline | md, sm, lg |
| status | Badge, Tag, Alert, Toast | soft, solid, outline | md, sm, lg |
| identity | Avatar, Avatar Group | soft, solid, outline | md, sm, lg |
| panel | Dialog, Drawer, Popover, Menu, Hover Card, Tooltip, Toolbar / Menubar root, Navigation Menu viewport and content, Calendar / Range Calendar root, Date (Range) Picker popover content, Month / Year Picker root | none | Dialog / Drawer: md, sm, lg (width); others inherit |
| collection item | Menu item, Listbox option, Calendar / Range Calendar day, Month / Year Picker cell | none | inherited |
| link | Link, Breadcrumbs link, Navigation Menu content link | none | none (inherits font size) |
| range | Slider, Progress, Meter | solid, soft | md, sm, lg |
| decoration | Separator, Skeleton, Image | none | none (look via `--rind-separator-*`, `--rind-skeleton-*`, `--rind-image-*`) |

No family: Label, Field, Fieldset, Form, Heading. They read no `data-variant` and only
typography and spacing tokens, so an inherited `data-size` scales their text and spacing.
An unsupported `data-variant` renders the family default.

## Rules that need care

- **Indicator edge.** Checked, selected and pressed indicators draw an edge in the palette
  `border` role (`--rind-color-accent-border`), so the state meets 3:1 even when `solid`
  (a light yellow) does not.
- **Forced colors.** Backgrounds and shadows vanish, so every bordered part keeps a
  `border` that is `transparent` in the normal look, never `none`/`0`: it is then painted
  in the system colour. State cues use `outline` or borders mapped to system colours inside
  `@media (forced-colors: active)` (the only place system colours may appear).
- **Icons.** Draw `--rind-icon-<name>` with `mask-image` and `background-color:
  currentColor` (`CanvasText` under forced colors); mirror only previous/next icons under
  `[dir="rtl"]`. Pick icons by meaning (`check`, `caret-down`, …), not by look.
- **Size.** Read `--rind-size-control`, `--rind-text-control`, `--rind-space-control`
  with a `md` fallback; `data-size` on an ancestor sets them, so popups and items inherit.

## Checklist for a component change

1. Add the scope to one row of `families.ts` (or to `noFamily`); a new family or value is a
   change to `theme-variants`.
2. Write `src/<scope>.css` as above; add it to `index.css` imports.
3. `pnpm --filter @rind-ui/theme generate` — regenerates `tokens.manifest.json` and the
   `components` override type. Both are build outputs (not committed); turbo runs it before
   build and typecheck.
4. `pnpm vitest run packages/theme` — lint, family and export tests.
5. Site examples (`apps/site/examples/<slug>.tsx`) render the themed component; state examples also with `data-tone="danger"`.
6. Link this page from the component's docs page.
