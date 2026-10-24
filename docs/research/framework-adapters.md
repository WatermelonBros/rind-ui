# Framework adapters (Vue, Svelte) — research

Status: done · Wave: infrastructure

How the libraries that ship Vue and Svelte bindings bind a framework-neutral core, and what
went wrong for them. Applies to `@rind-ui/vue` and `@rind-ui/svelte`; the component behaviour
itself is unchanged (machines and connect are shared), so the per-component research notes
still apply as written.

## How the others built it

### Zag / Ark UI (Vue, Svelte, Solid, React from one core)

- Source: `zag/packages/frameworks/vue/src/normalize-props.ts`,
  `zag/packages/frameworks/svelte/src/normalize-props.ts`, `use-machine.ts` per framework.
- One machine core; each framework package is `useMachine` + `normalizeProps`. Connect
  produces React-cased props and each normalizer renames them: Vue `htmlFor → for`,
  `className → class`, `onChange → onInput`, `onFocus → onFocusin`, `onDoubleClick →
  onDblclick`, other `onX` → `onX` with the rest lower-cased; Svelte lower-cases everything
  (`onclick`, `onfocusin`, `oninput`), keeps SVG camel-case keys (`viewBox`,
  `strokeDasharray`) and turns the style object into a string.
- Notable: our connect is already neutral (HTML names, `onDblClick`, `onFocusIn`,
  `onInput`; kebab style keys), so our normalizers are smaller than Zag's: Vue only
  re-cases handlers, Svelte lower-cases handlers and serialises style.
- Problems: Vue `children` mapped to `innerHTML` (XSS-adjacent, warned); Ark Vue had
  `asChild` losing listeners when the child was a component without `inheritAttrs`.

### Reka UI (Vue)

- Source: `reka-ui/packages/core/src/Primitive/Slot.ts`, `Primitive.ts`.
- `as` (tag or component) + `asChild`: `Slot` clones the first non-comment child of the
  default slot with `cloneVNode`, merging attrs with the child's props (child wins), strips the
  child's own `ref`. Text children are not rejected.
- Notable: `mergeProps` from Vue concatenates `class`, merges `style`, and chains listeners
  (`onClick: [a, b]`), so handler composition is free.
- Problems: the slot child can be a text node or a fragment; the comment/fragment walk is
  ad hoc; refs to components resolve to the component instance, needing `$el` unwrapping
  (`useForwardExpose`); attrs fall through twice when a part forgets `inheritAttrs: false`.

### Bits UI / Melt UI (Svelte 5)

- API: every part takes a `child` snippet receiving `{ props }` to spread on the consumer's
  element (element substitution), `children` for content, `bind:ref` for the element.
  Props are merged with `svelte-toolbelt`'s `mergeProps` (handlers chained, class joined,
  style merged).
- Notable: the `child` snippet is the Svelte equivalent of React's `render` function.
- Problems: before Svelte 5.20 there was no SSR-stable id (`$props.id()`); ids were counters
  and mismatched across server and client. A namespace import (`import * as Sheet`) broke
  SvelteKit hydration in one Svelte release (sveltejs/svelte#17152, fixed in Svelte). Element
  refs went through `bind:ref` and an id lookup because a spread object could not carry a ref
  until Svelte 5.29 added `createAttachmentKey` (an attachment key in the spread object runs
  on the element).

## Platform facts that decide the design

- **Vue boolean attributes.** Vue 3 renders `false` as the string `"false"` for non-boolean
  attributes (`aria-pressed="false"` is right) but `inert` is not on every Vue version's
  boolean list: `inert: false` would render `inert="false"`, which *is* inert. The normalizer
  maps `inert` to `""`/absent.
- **Vue listeners.** `h(tag, { onFocusin })` listens to `focusin`; `onDblclick` to
  `dblclick`. Native events reach connect's handlers; connect already reads
  `event.nativeEvent ?? event`.
- **Svelte event delegation.** Svelte 5 delegates `click`, `input`, `keydown`, `pointerdown`
  and some others to the mount root. `currentTarget` is patched correctly; `stopPropagation`
  in a delegated handler does not stop native listeners an ancestor added with
  `addEventListener` before the root. Core's dismiss layer listens on `document` (above the
  root), so its order is unchanged.
- **Svelte spread of `undefined`.** Spreading `{ attr: undefined }` removes the attribute;
  booleans on unknown attributes render `"true"`/`"false"`, so `inert` gets the same mapping
  as Vue.
- **Stable ids.** Vue 3.5 `useId()` and Svelte 5.20 `$props.id()` are SSR-stable. Peer
  ranges: `vue >=3.5`, `svelte >=5.29` (attachments).

## Bug history

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| Zag Vue | normalize-props `children` | strings set as `innerHTML` | treating children as a prop | warned in dev | children are never a connect prop; content goes through slots |
| Reka | Slot | attrs applied to a text child, or to a fragment | first-non-comment pick | open behaviour | `asChild` requires exactly one element vnode; warn otherwise |
| Reka | refs on components | ref resolves to component instance | Vue component refs | `useForwardExpose` | resolve `$el` when the ref is a component instance |
| Bits UI | ids before 5.20 | hydration mismatch | counters | `$props.id()` | always `$props.id()` |
| Svelte | #17152 | namespace-imported compound parts null on hydration | compiler bug | fixed upstream | an SSR + hydrate test imports parts through the namespace |

## Testing notes

- Drivers are framework-free: they take a Testing Library `screen` or a DOM container. The
  same drivers and the same `testMachine` model run unchanged against Vue and Svelte
  renders; only the `setup` (mount) differs.
- A parity test renders one fixture in React, Vue and Svelte and compares the DOM with ids
  normalised: equal markup proves the parts forward the same connect output.

## Decisions

- Same part names as React (`Toggle.Root`, `Toggle.Indicator`), exported as module
  namespaces.
- Vue: render-function components in `.ts` (no SFC build step); element substitution with
  `asChild` (one child element receives the merged props), state through the default slot's
  props.
- Svelte 5: `.svelte` parts with runes; element substitution with a `child` snippet
  (`{ props, state }`), content with `children` (receives the state); refs via an
  attachment key in the props object.
- Deliberately different from React: no `render` prop (each framework's idiom instead).
