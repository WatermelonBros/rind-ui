## Why

Inspecting a JSON value (an API response, a log entry, a config, a tool call's arguments in
an AI UI) is a common view with a long bug history: whole values converted up front so a
large payload freezes the page (Zag, vue-json-pretty), dotted paths that collide (`a.b` vs
`a › b`, Zag), shared references flagged as circular (Zag), an English `aria-label` replacing
the visible text (Ark), copy that reports success while copying `""` (react-json-view),
crashes on sparse arrays and BigInt. rind-ui already has an accessible, virtualised Tree View;
a JSON view is a Tree View fed lazily from a value.

Research: [json-tree-view](../../../docs/research/json-tree-view.md) ·
[tree-view](../../../docs/research/tree-view.md) ·
[clipboard](../../../docs/research/clipboard.md)

Depends on: `add-tree-view` (machine, collection, contract, driver, virtualisation),
`add-clipboard` (copy capability and states), `add-theme-system`.

## What Changes

- A public **JSON Tree View** in `@rind-ui/core` (a JSON adapter in `json-tree/`: value →
  lazy tree collection, item text, copy serialiser, messages, meta) and every framework
  package: parts `Root`, `Tree`, `Item`/`Branch` (Tree View's), `ItemText` with `Key`,
  `Separator`, `Value`, `Summary`, `Preview`, and an optional `CopyTrigger`.
- No new machine: Tree View's, selection `none` by default.
- Keys are JSON Pointers; children are built only for expanded containers; large containers
  are grouped in ranges; cycles (ancestors only) render as leaves.
- Copy of the focused node (`Mod+C`, CopyTrigger) as JSON, raw value or pointer, announced.
- `getJsonTreeView` driver (Tree View's plus JSON queries), `json-tree-view.css`, site
  example and skin, docs page with a `JSON.parse` BigInt recipe.

## Capabilities

### New Capabilities

- `json-tree-view`: value model and supported types, keys, lazy materialisation, grouping,
  cycles, item text and names, expansion defaults and `expandAll` bound, copy, data
  attributes, messages, contract, theme.

### Modified Capabilities

None (Tree View is used as is).

## Non-goals

- A line view (brackets on their own lines, line numbers): Code Block's job.
- Search or filter over unexpanded branches; editing; a custom type registry; a `parseJson`
  helper (a docs recipe instead).

## Impact

- New: `packages/core/src/components/json-tree-view/`, framework parts, driver, theme file,
  site example and skin, `docs/components/json-tree-view.md`.
- Modified: `families.ts` (`json-tree-view` in `decoration`, items from Tree View's row).
- No new dependency.
