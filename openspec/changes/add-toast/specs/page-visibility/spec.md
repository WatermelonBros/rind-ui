## Purpose

Defines the injected capability that tells machines whether the document is hidden
(background tab, minimised window) and notifies them when that changes, so timers can
pause without reading `document` globals and tests can hide the page deterministically.

## ADDED Requirements

### Requirement: Hidden State And Subscription

The environment SHALL expose `hidden()` and a subscription to its changes, following
the document's visibility state in the browser and overridable at environment
creation. Machines SHALL read page visibility only through this capability. Window
focus and blur SHALL NOT change it.

#### Scenario: Background tab

- **WHEN** the user switches to another browser tab
- **THEN** `hidden()` returns true and subscribers are notified once

#### Scenario: Iframe takes focus (radix#1362)

- **WHEN** an iframe on the page receives focus and the window blurs
- **THEN** `hidden()` still returns false and no subscriber is notified

#### Scenario: Test without a DOM

- **WHEN** a machine test creates an environment with a fake visibility and sets it
  hidden
- **THEN** subscribers are notified and no DOM global is read

### Requirement: Correct From The Start

A subscriber SHALL be able to read the current state when it subscribes, so a
component created while the page is already hidden starts paused.

#### Scenario: Created in a background tab (mui/base-ui#5955)

- **WHEN** a toast is shown while the tab is in the background
- **THEN** its timer is paused from the start and starts when the tab becomes visible
