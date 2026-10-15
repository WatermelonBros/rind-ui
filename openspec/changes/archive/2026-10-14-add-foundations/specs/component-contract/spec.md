## Purpose

Defines the contract every rind-ui component ships: a machine-readable description
of its anatomy, how to find it, what can be done to it and what can be read from
it, written against an environment interface with no DOM, so the same description
drives tests in any environment and tells agents how to operate and verify the UI.

## ADDED Requirements

### Requirement: Contract Contents

A contract SHALL declare: the component's scope name; its anatomy (the part names);
how to locate an instance from a human-meaningful anchor (role and exact accessible
name); its actions; its queries; the observable values of each machine state; the
mapping from machine events to actions; and its traits (which generic invariants
apply). State and event keys SHALL be checked against the machine at compile time;
an unknown state, event or part name SHALL be a compile error.

#### Scenario: Unknown part

- **WHEN** an action refers to a part name not in the anatomy
- **THEN** the contract does not compile

#### Scenario: Event mapped to a missing action

- **WHEN** the event map points `OPEN` at an action the contract does not declare
- **THEN** the contract does not compile

### Requirement: Environment Interface

Contracts SHALL be written only against an environment interface that offers:
resolving a part of the current instance (optionally refined by role and name, or
by text); finding an element anywhere in the document; the focused element; keyboard
input to the focused element; a pointer press outside every layer; polling until a
condition holds; advancing time; and the active input modality. Part handles SHALL
be lazy (resolved on every use), and every operation SHALL be asynchronous. Keys
SHALL be a closed, typed set.

#### Scenario: Lazy handle

- **WHEN** an action obtains a part handle and the element is re-rendered before
  the handle is used
- **THEN** the handle acts on the current element

### Requirement: Actions With Modalities And Postconditions

An action SHALL be implementable per input modality (pointer, keyboard, touch,
virtual) and
SHALL declare a postcondition. Running an action SHALL complete only when its
postcondition holds, or fail with a message naming the action, the modality and
the observed state when it does not hold within the timeout.

#### Scenario: Open waits for open

- **WHEN** a driver runs `open()` and the component opens after an animation frame
- **THEN** `open()` resolves after the component is open

#### Scenario: Postcondition never met

- **WHEN** a broken component never opens
- **THEN** `open()` rejects with a message naming `open`, the modality and the last
  observed state

### Requirement: Virtual Modality

The environment SHALL support a `virtual` modality that reproduces how assistive
technology activates and focuses elements: activation is a bare `click` event
(`detail: 0`, no preceding pointer or key events) and focus is a programmatic focus
with no preceding key event. Every action with a pointer implementation SHALL be
runnable in the virtual modality without a separate implementation, by replaying its
activations as bare clicks.

#### Scenario: Screen reader press

- **WHEN** an action that clicks a trigger is run in the virtual modality
- **THEN** the trigger receives a single `click` with `detail === 0` and no
  `pointerdown`, `mousedown` or `keydown` before it

### Requirement: Keyboard Twins

Every action that declares a pointer or touch implementation SHALL also declare a
keyboard implementation, or explicitly declare that none exists with a stated
reason; omitting both SHALL be a compile error. The model-based runner runs every
declared modality, so keyboard support is tested wherever pointer support is.

#### Scenario: Pointer-only action

- **WHEN** a contract declares `open` with only a pointer implementation and no
  keyboard declaration
- **THEN** the contract does not compile

### Requirement: Location By Accessible Name

Locating an instance SHALL use role and exact accessible name first. Parts SHALL be
resolved through `data-scope`, `data-part` and `data-instance`, document-wide, so
portalled parts belong to the right instance. When a lookup matches more than one
element, it SHALL fail and list every match.

#### Scenario: Duplicated accessible name

- **WHEN** a hidden native control duplicates a visible control's role and name
- **THEN** locating fails and the failure lists both elements

#### Scenario: Two instances on a page

- **WHEN** two instances are rendered and one is located by name
- **THEN** parts of the other instance are never returned, including portalled parts
