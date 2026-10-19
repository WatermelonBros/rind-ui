## MODIFIED Requirements

### Requirement: Long Press

A part SHALL be able to opt into long press: holding a pointer or touch press for a
threshold (default 500 ms, scheduled through the injected scheduler) SHALL send
`LONG_PRESS` with `modality` and SHALL suppress the trailing `PRESS` and the touch
context menu. A part MAY set a movement tolerance: moving farther than it from the
press's start SHALL cancel the long press (jitter within it SHALL NOT); a second pointer
going down SHALL always cancel it (a pinch is not a long press). A long-pressable part SHALL reference a localised hint through
`aria-describedby`. Every long-press action in a contract SHALL have a keyboard twin,
as every pointer action does.

#### Scenario: Long press on touch

- **WHEN** the user keeps a finger on a long-pressable part for 500 ms and releases
- **THEN** the machine receives `LONG_PRESS` and no `PRESS`, and the platform context
  menu does not open

#### Scenario: Fake timers

- **WHEN** a test with fake timers starts a press and advances 500 ms
- **THEN** `LONG_PRESS` is delivered with no real time elapsed

#### Scenario: Hint

- **WHEN** a long-pressable part renders
- **THEN** its accessible description contains the hint from its `messages`

#### Scenario: Movement tolerance

- **WHEN** a part with a 10 px tolerance is held while the finger moves 4 px, and in a
  second press 15 px
- **THEN** the first press sends `LONG_PRESS` and the second does not

#### Scenario: Pinch

- **WHEN** a second finger goes down during a long press
- **THEN** no `LONG_PRESS` is sent
