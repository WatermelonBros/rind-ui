## Context

React parts are thin: they bind a machine service, call connect, normalise and merge props, and
render. Everything framework-specific is in ~10 helpers (`use-machine`, `normalize-props`,
`merge-props`, `render`, `use-ids`, `provider`, `use-press`, `use-modality`, icons). This change
writes those helpers for Vue and Svelte, then ports each component's parts.

## Decisions

### Shared helpers in core

Prop merging (handler chaining with `preventRindHandler`, critical-attribute warnings), the part
registry and provider config resolution have no framework in them. They live in
`packages/core/src/adapter/` and are exported from `@rind-ui/core/internal`; each adapter
instantiates the merger with its spelling (Vue `onClick`, Svelte `onclick`; class as an array,
which both frameworks normalise).

### Vue

- Components are `defineComponent` + render functions in `.ts`: no SFC build step, typed props
  and emits that Volar reads.
- `inheritAttrs: false`; attrs are the consumer layer of `mergeProps`.
- Controlled values: a prop that defaults to `undefined` (uncontrolled when absent), the change
  emitted as `<value>Change(value, details)` first (a listener can `details.cancel()`), then
  `update:<value>` for `v-model` only when nothing cancelled.
- `asChild`: the default slot's single element is cloned with the merged props (its own props
  are the consumer layer; the clone is FULL_PROPS so later patches see every prop). The slot
  receives the part's state. The rendered tag is the child's when it is a host element, else
  measured after mount.
- Ids: `useId()` (SSR-stable), or the consumer's `id`.

### Svelte

- `.svelte` parts with runes; helpers that use runes are `.svelte.ts` modules.
- Controlled values: `bind:<value>` two-way; a function binding whose setter refuses makes the
  part fully controlled (the parent alone moves it); without a binding the prop is an initial
  value the part may change locally (Svelte's prop semantics).
- `child` snippet (`{ props, state }`) for element substitution, `children` snippet receiving the
  state. Element refs: an attachment key (`createAttachmentKey`) in the props, so the ref lands on
  the consumer's element too. The tag is measured after mount (fallback before).
- Ids: `$props.id()`.
- Package build: `svelte-package` (ships `.svelte` sources with `lang="ts"`, compiled by the
  consumer) plus `scripts/svelte-exports.mjs` writing one `exports` entry per component.
- Type check: `svelte-check --tsgo` (TypeScript 6 installed beside 7, as svelte-check requires).

### Tests

The contract model test is the parity check: the same `testMachine(contract, …)` the React
suite runs, with the framework's mount as `setup`. Per-framework tests add what the model does
not cover (the framework's binding idiom, element substitution, slots/snippets).

## Risks

- Svelte event delegation: `stopPropagation` in a delegated handler does not stop listeners an
  ancestor added natively below the document. Core's document-level listeners are unaffected;
  a component that relies on stopping propagation between its own parts must use the same
  mechanism for both.
- Svelte hydration tests need a server compile of the fixture; they are added with the
  infrastructure task 1.6 (a Rolldown bundle per target).
- Found while porting, in all three adapters: `Field.ErrorMessage` with several messages
  renders a `<ul>` inside its `<p>`, which the HTML parser splits on load (server HTML then
  differs from the DOM). The adapters keep React's markup; the fix belongs to the Field spec
  (render the list in a `<div>` part, or the messages inline) and is reported separately.
- Connect still spells some props the React way (`htmlFor`, `tabIndex`, `onChange`,
  `defaultValue`): `neutralName` in `@rind-ui/core/internal` folds them back for Vue and
  Svelte. `defaultValue`/`defaultChecked` stay DOM properties on the client (they set the
  attribute and keep the user's edits) and become the attribute in server HTML.
