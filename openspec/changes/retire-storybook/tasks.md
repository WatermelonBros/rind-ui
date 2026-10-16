## 1. Examples harness (site session)

- [ ] 1.1 Route group: `/examples` layout without site chrome, reduced motion forced
- [ ] 1.2 Static path variants `/examples/<slug>/<example>/<skin>/` for none, bare, crisp, juicy, theme-calm, theme-crisp; `?scheme`
- [ ] 1.3 `states` and `hidden` in examples modules; `/examples/index.json` at build
- [ ] 1.4 Port every Storybook story: component stories as examples, `*Fixture` stories as hidden examples, Tokens / Contrast report / Showcase as site pages under `/theme/`
- [ ] 1.6 Site examples for components added after the port (Alert Dialog: default, destructive confirm, async confirm with pending UI, alert inside a dialog, form with submit-type action, Escape vetoed, a driver example; state examples `open` / `closed`; Popover: default, modal, with title/description, custom anchor, arrow, nested, in a dialog, sibling popovers, long content at 320 px, RTL, exit animation, a driver example; state examples `open` / `closed`)
- [ ] 1.5 Site audit still green; PR merged before section 2

## 2. Tests move to the harness (implementer)

- [ ] 2.1 `openExample(page, slug, example, skin?)` helper serving `apps/site/out`; every `*.pw.test.ts` uses it instead of storybook-static
- [ ] 2.2 Axe on every example from index.json: none + theme-calm/theme-crisp, light and dark, 3 engines
- [ ] 2.3 ARIA snapshots keyed `<slug>--<example>` under packages/testing/fixtures/__aria__, state coverage check on contract states
- [ ] 2.4 Parity proof: per component, the number of driver / axe / snapshot checks is not lower than with Storybook (list it in the PR)

## 3. Remove Storybook (implementer, same PR as 2)

- [ ] 3.1 Delete apps/storybook, @storybook/* dependencies, the storybook Vitest project, CI slices, turbo outputs/dependsOn, serve-static if unused; a11y-nightly uses the site export
- [ ] 3.2 CLAUDE.md, openspec/config.yaml, docs (testing guides, decisions README): "stories" → "site examples"; decision 0011 supersedes Storybook half of 0004
- [ ] 3.3 Every queued change's "Stories" task rewritten to "Site examples (apps/site/examples/<slug>.tsx, state examples for every contract state)"
