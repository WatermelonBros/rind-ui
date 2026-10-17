## MODIFIED Requirements

### Requirement: Form-Associated Trait

Contracts SHALL be able to declare the `form-associated` trait, and SHALL be able to
declare which input properties the runner compares (default: `checked`, `indeterminate`,
`value`; Select: the `value` of every hidden input, in order). For such contracts the
model-based runner SHALL check after every step that:

- the declared properties of the hidden input(s) equal the oracle's value;
- it carries `aria-hidden="true"` and `tabIndex=-1`, does not have focus, and is the only
  input the component renders for that value (plus the `uncheckedValue` input when
  applicable);
- the number of `change` events dispatched by the hidden input since the path started
  equals the number of steps whose action changed the value — the controllable values
  the contract declares the form carries (default: all; Select: `value`, not `open`);
- the number of `click` events an ancestor of the component received equals the number of
  clicks the driver produced.

Both test adapters SHALL let contracts read a native input's checkedness and indeterminate
state as DOM properties.

#### Scenario: Event parity fails on a synthetic click

- **WHEN** a broken variant dispatches a `click` from its hidden input on every change
- **THEN** the first step that changes the value fails, naming the ancestor click count

#### Scenario: Programmatic change dispatching change

- **WHEN** a broken variant dispatches `change` when the parent sets a controlled value
- **THEN** the `$sync` step fails, naming the `change` count

#### Scenario: Reading checkedness

- **WHEN** a contract query reads the hidden input's checkedness through the Playwright
  adapter and through the DOM adapter
- **THEN** both return the `checked` property, not the `checked` attribute

#### Scenario: Opening is no change of the form's value

- **WHEN** a select's contract declares the form carries `value` and a step opens it
- **THEN** the step counts no user change and expects no `change` event
