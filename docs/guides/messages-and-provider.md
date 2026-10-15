# Messages, locale and RindProvider

Every user-visible string a component owns (labels it generates, hints, announcements)
is a typed **message** with an English default, overridable per component or for a whole
tree. Numbers, plurals, sorting and sentence splitting use `Intl` with the component's
locale (`format.number`, `plural`, `format.collator`, `format.segmenter`; instances are
cached).

```tsx
<RindProvider
  locale="de-DE"
  messages={{ tags: { removeLabel: (name: string) => `${name} entfernen` } }}
  typeaheadTimeout={1500}
>
  <App />
</RindProvider>
```

- `locale` defaults to the document's `lang` (followed on change); `dir` defaults to the
  locale's direction.
- Nested providers merge field by field: an inner provider that sets only `messages`
  keeps the outer locale.
- `announcer` and `environment` (platform, reduced motion, CSP `nonce`, root node)
  configure the [environment](../decisions/0002-architecture.md) every component below
  uses.
- Parts rendered outside the root (portals) carry `dir` and `lang` themselves
  (`localeAttrs`).

In components: `useLocale()`, `useMessages(scope, defaults, own)`,
`useTypeaheadTimeout(own)`, `useEnvironment()`.
