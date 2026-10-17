## 1. Core

- [ ] 1.1 One Text Field machine with the visibility values and events and the Escape / Enter events (`escapeClears`, `onSubmit`); the preset builder internal
- [ ] 1.2 Connect: `type`, the password and search input attributes, VisibilityTrigger, VisibilityIndicator, `data-state` / `data-empty`, injected native-control styles under scope `text-field`
- [ ] 1.3 Messages: `toggleLabel`, `visibilityAnnouncement`, `clearSearch`
- [ ] 1.4 Contract located by label, with the visibility and search actions, events and invariants; meta with the new parts
- [ ] 1.5 Remove `password-input` and `search-field` from core

## 2. React

- [ ] 2.1 `TextField.VisibilityTrigger`, `TextField.VisibilityIndicator`; Root `type`, `visible`, `escapeClears`, `onSubmit`; hide on submit / reset; caret kept
- [ ] 2.2 Remove `PasswordInput` and `SearchField`

## 3. Testing

- [ ] 3.1 `getTextField` covers everything; `getPasswordInput` / `getSearchField` removed
- [ ] 3.2 Password and search scenario, model, broken, hydrate and Playwright tests ported to Text Field

## 4. Theme, site, docs

- [ ] 4.1 `text-field.css` absorbs the visibility trigger and the search styles; the two stylesheets removed
- [ ] 4.2 Site examples and skins merged into Text Field's; docs page merged; inventory updated
- [ ] 4.3 Changeset; lint, typecheck, docs check
