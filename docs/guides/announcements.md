# Announcements

Some changes have no focus move to carry them — "3 results", "Copied", a streamed answer.
Components announce them through the environment's `Announcer`; they never render their
own live region.

```ts
env.announcer.announce({ message: "3 results", key: "results" })
```

## Live-region backend (default)

- Two regions (polite and assertive) per document, created **before** the first message
  (components call `announcer.prepare()` on mount), because a region added together with
  its text is not read.
- Messages are inserted a frame later, repeated identical messages still speak, messages
  with the same `key` are debounced (500 ms), and each is removed after 7 s.
- Messages from a hidden tab are dropped; `lang` is set from the component's locale.
- Regions stay where they were created and are kept out of `inert` (modals do not hide
  them).

`announcer: "aria-notify"` (on `RindProvider` or `domEnvironment`) uses `ariaNotify` where
the browser has it and falls back to live regions per call. A custom `Announcer` can be
injected the same way.

## Streaming text

`streamAnnouncement(announcer, { key, locale, scheduler, mode })` announces text that
arrives in chunks: `completion` mode speaks once at the end, `sentences` mode speaks each
finished sentence (segmented for the locale) and flushes at least every 2 s.

## Apple and `aria-activedescendant`

VoiceOver does not speak `aria-activedescendant` changes, so composites that keep focus on
an input announce the highlighted option themselves — on Apple platforms only (quirk
`vo-activedescendant`); elsewhere that would double the speech.
