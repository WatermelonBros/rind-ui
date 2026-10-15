# <Component> — research

Status: todo | in progress | done · Wave: <1|2|3|AI>

## Pattern

- WAI-ARIA APG pattern: <link, or "none — closest is …">
- Roles and attributes required:
- Keyboard interactions required:

## How the others built it

One subsection per library that ships it (see components.md for which do).

### <Library>

- Source: <path / link to the file(s) read>
- API shape (parts, key props):
- State model (states, events; controlled/uncontrolled):
- Notable: <what is clever or worth copying>
- Problems: <bugs, open issues, limitations — link the issues>

## Accessibility

Apply [accessibility.md](accessibility.md) and
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) to this
pattern: roles, states, naming, keyboard, focus, announcements, forced colors,
motion, RTL — and the known screen reader / browser quirks for it.
[native-platform.md](native-platform.md): can a native primitive do part of this?

## Bug history

Required. Search every shipping library's issue tracker (open and closed) for this
component. For each bug worth learning from:

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|

## Known pitfalls

Bugs that more than one library hit, platform quirks (Safari, iOS VoiceOver,
Android TalkBack, IME), SSR or hydration problems, focus edge cases.

## Testing notes

What is hard to test about this component, what the others polyfill or work
around, and what its driver must expose (actions, queries).

## Decisions

- Parts:
- Machine states and events:
- `data-*` attributes:
- Contract actions / queries:
- Deliberately different from the others, and why:

## Open questions
