# announcer Specification

## Purpose
Defines the injected `Announcer` through which every rind-ui component speaks to
screen-reader users: how messages reach assistive technology reliably (live regions
that exist first, repeat-safe, never hidden, localised, muted in background tabs),
how streamed text is announced without flooding, and how contracts declare the
announcements drivers assert.
## Requirements
### Requirement: Injected Announcer

Machines SHALL announce only through the `Announcer` capability of the environment,
with a message, a priority (`polite` by default, or `assertive`), an optional
coalescing key and the locale of the announcing component. No component SHALL render
an `aria-live` region of its own except where its contract declares the `live-region`
trait. The announcer SHALL be replaceable through the environment and the provider.

#### Scenario: Machine test without a DOM

- **WHEN** a machine that announces runs in Node with a recording announcer
- **THEN** the recording contains each message with its priority and key, and no DOM
  is touched

### Requirement: Regions Exist Before The First Message

The default announcer SHALL create one polite and one assertive region per document
when the first component that may announce is mounted, before any message is
requested, and SHALL keep them for the life of the document (rind-ui's test reset
excepted). Text SHALL be inserted no earlier than the next animation frame after the
request, as a new child node per message.

#### Scenario: First toast is spoken (RA#5191, BU#4181, RX#3634)

- **WHEN** a page mounts its first announcing component and the first message is
  requested in the same task
- **THEN** both regions were in the document before the message's text node was
  inserted, and the text is inserted in a later frame

#### Scenario: Region created inside a hidden tree (RA#3559)

- **WHEN** the first announcing component mounts while a modal layer has made the rest
  of the page inert
- **THEN** the regions are created outside every inert or `aria-hidden` subtree

### Requirement: Repeated Messages Are Spoken

Each call without a key SHALL produce one announcement, including calls with text
identical to the previous message. A call with a key SHALL replace any pending,
not-yet-inserted message with the same key, after a debounce (default 500 ms) through
the injected scheduler. Inserted message nodes SHALL be removed after 7 s.

#### Scenario: "Copied" twice

- **WHEN** a component announces "Copied" twice, two seconds apart
- **THEN** two announcements are made

#### Scenario: Result count while typing

- **WHEN** a combobox announces "12 results", "5 results" and "3 results" with the same
  key within 300 ms
- **THEN** only "3 results" is announced

### Requirement: Never Hidden By Hide-Outside Operations

The announcer's container SHALL carry `data-live-announcer` and `data-rind-top-layer`.
rind-ui SHALL export one keep-visible rule (a selector and a predicate) covering the
announcer, `[data-rind-top-layer]`, `[aria-live]` and `role` `status`, `alert` and
`log`, and every rind-ui operation that makes content outside a layer inert or
`aria-hidden` SHALL leave elements matching it, and their ancestors, exposed. The
announcer's regions SHALL never be moved in the DOM once created.

#### Scenario: Announcement while a menu is open (RX#1820)

- **WHEN** a hide-outside operation runs over the whole body while a menu is open and a
  component then announces
- **THEN** the announcer regions are not inert, have no `aria-hidden` ancestor, and the
  message is announced

#### Scenario: Modal dialog open

- **WHEN** a modal dialog is open and the announcer speaks
- **THEN** the regions are still at their original position in the document

### Requirement: Language Of Announcements

Each message node SHALL carry `lang` set to the announcing component's locale, so
speech uses that language's voice.

#### Scenario: Italian component on an English page

- **WHEN** a component rendered with locale `it-IT` announces on a page whose `lang`
  is `en`
- **THEN** the message node has `lang="it-IT"`

### Requirement: Muted In Hidden Documents

Messages requested while `document.hidden` is true SHALL be dropped, not queued.

#### Scenario: Background tab

- **WHEN** a toast announces while its tab is in the background
- **THEN** nothing is inserted into the regions and the message is not spoken later

### Requirement: Assertive Only For Errors

The `assertive` priority SHALL be used by rind-ui components only for errors and
failures; every other rind-ui announcement SHALL be `polite`.

#### Scenario: Tool call failed

- **WHEN** an AI tool call goes from "Running" to "Failed"
- **THEN** "Failed" is announced assertively and "Running" was announced politely

### Requirement: Optional ariaNotify Backend

The announcer SHALL offer an opt-in backend that calls `ariaNotify` on an element
carrying the message's `lang` (`priority: "high"` for assertive, `"normal"` for
polite) when the browser supports it, and SHALL fall back to the live-region backend
when it does not. Both backends SHALL obey the hidden-document, key and repeat rules.
The live-region backend SHALL remain the default.

#### Scenario: Supported browser

- **WHEN** the `ariaNotify` backend is selected in a browser that implements it
- **THEN** a polite message calls `ariaNotify` with `priority: "normal"` and inserts
  nothing into the regions

#### Scenario: Unsupported browser

- **WHEN** the `ariaNotify` backend is selected in a browser without it
- **THEN** the message goes through the live regions

### Requirement: Streamed Text Policy

rind-ui SHALL provide an announcement policy for streamed text that, by default,
announces a stream exactly once, with its full text, when it completes; and, when
configured for sentences, announces each complete sentence (segmented with the
locale's sentence segmentation) or the accumulated text every 2 s at most, politely,
keyed per stream so a backlog collapses. A stream that is cancelled SHALL announce
nothing further.

#### Scenario: Default mode

- **WHEN** a stream delivers "Hel", "lo", " there" and completes
- **THEN** exactly one announcement, "Hello there", is made

#### Scenario: Sentence mode

- **WHEN** a stream in sentence mode delivers "First one. Sec" and then "ond one." and
  completes
- **THEN** "First one." and "Second one." are announced, in that order

### Requirement: Highlight Announcements On Apple Platforms

Components that keep DOM focus in a text field and move a highlight with
`aria-activedescendant` SHALL announce the highlighted item through the announcer only
while the `vo-activedescendant` quirk entry applies (Apple platforms with the WebKit
engine, where VoiceOver does not speak `aria-activedescendant` changes, RA#10326), and
never elsewhere: VoiceOver in Chrome speaks the highlighted option natively and a live
announcement interrupts it (RA PR #10503). They SHALL announce entering a section (the
section's label and its option count) and the selection on commit only while the
`vo-section-entry` entry applies (every Apple platform, where VoiceOver speaks neither),
and never elsewhere. The result count is not gated (see "Result Count Is A Status
Message").

#### Scenario: Combobox highlight in Safari on macOS (RA#10326, ZG#2936)

- **WHEN** on an Apple platform with the WebKit engine the user presses ArrowDown in a
  combobox and "Apple" (1 of 6) becomes highlighted
- **THEN** exactly one polite announcement equal to the contract's focus announcement
  for that item is made

#### Scenario: Combobox highlight in Chrome on macOS (RA PR #10503)

- **WHEN** the same interaction happens on an Apple platform with the Blink engine
- **THEN** no highlight announcement is made

#### Scenario: Section entry in Chrome on macOS (RA PR #10503)

- **WHEN** on an Apple platform with the Blink engine ArrowDown moves the highlight into
  a section labelled "Fruit" holding 4 options
- **THEN** one polite announcement naming "Fruit" and the count 4 is made, and no
  per-item announcement

#### Scenario: Windows

- **WHEN** the same interactions happen on Windows
- **THEN** no highlight, section or selection announcement is made

### Requirement: Result Count Is A Status Message

Components with the `composite-activedescendant` trait SHALL announce the result count
politely, keyed per component instance, when the popup opens and whenever the number of
results changes, on every platform: the count is a WCAG 4.1.3 status message. It SHALL NOT be gated by
a quirk entry.

#### Scenario: Count on Windows

- **WHEN** on Windows a combobox filters its options from 12 to 3 results
- **THEN** one polite announcement equal to the contract's count announcement for 3
  results is made, after the key's debounce

#### Scenario: Count on Apple and WebKit

- **WHEN** the same filtering happens on an Apple platform with the WebKit engine
- **THEN** the same count announcement is made, once

### Requirement: Contract Announcement Declarations

A contract SHALL be able to declare `focusAnnouncement`, `countAnnouncement` and
`selectionAnnouncement`, each a function from the observed state to the expected
message. A contract with the `composite-activedescendant` trait SHALL declare all
three; omitting one SHALL be a compile error. Drivers SHALL expose the announcements
made since the driver was created.

#### Scenario: Missing declaration

- **WHEN** a contract with the `composite-activedescendant` trait declares no
  `countAnnouncement`
- **THEN** the contract does not compile

#### Scenario: Driver reads announcements

- **WHEN** a test opens a combobox through its driver on an emulated Apple platform
- **THEN** the driver's announcements include the count announcement the contract
  declares for the open state

