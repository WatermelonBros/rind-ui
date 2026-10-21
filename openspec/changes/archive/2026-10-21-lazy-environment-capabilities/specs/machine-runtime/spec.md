## MODIFIED Requirements

### Requirement: Injected Environment

Machines and their implementations SHALL access the outside world only through an
environment passed when the service is created, composed of small capability
interfaces (at least a scheduler and a DOM root accessor). The runtime SHALL NOT fall
back to global `window`, `document` or timers. The scheduler SHALL resolve
`setTimeout` and `requestAnimationFrame` at call time, never at import time.
Capabilities SHALL be either base (always present: scheduler, DOM root, router, platform,
modality, motion, pointer, style, locale, clock) or on-demand (announcer, clipboard,
collection layout, constraint validity, page visibility, date clock). An on-demand
capability SHALL be built only when a component requests it, at most once per environment,
and an implementation given in the environment options SHALL win over the default one.

#### Scenario: Machine test without a DOM

- **WHEN** a machine is run in plain Node with a fake environment
- **THEN** every transition, action and effect runs without touching DOM globals

#### Scenario: Fake timers installed after import

- **WHEN** a test installs fake timers after the module was imported
- **THEN** scheduled work is driven by the fake timers

#### Scenario: Capability built once

- **WHEN** two components under one environment request the announcer
- **THEN** both receive the same announcer and one set of live regions exists

#### Scenario: Option wins

- **WHEN** the environment options give a clipboard and a component requests the clipboard
- **THEN** the component receives the given clipboard, not the default one

#### Scenario: Not requested

- **WHEN** no component under an environment requests the announcer
- **THEN** no live region is created
