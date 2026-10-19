## ADDED Requirements

### Requirement: Anatomy

A Stepper SHALL consist of `Root`, `List` (an `ol`) with one `Item` (`li`) per step, each
with a `Trigger`, and MAY contain `Indicator`, `Title`, `Description`, `Separator`,
`Content`, `PrevTrigger`, `NextTrigger` and `Progress`. It SHALL NOT use tab roles. Every
part SHALL accept the `render` prop.

#### Scenario: A list, not tabs

- **WHEN** a four-step Stepper is rendered
- **THEN** the steps are list items of an ordered list and no element has a tab role

### Requirement: Current Step

The Stepper SHALL expose a controllable `step` (0-based, default `defaultStep` 0) with
`onStepChange(step, details)`. `details` SHALL carry `reason` (`next`, `prev` or `select`) and
`cancel()`. A change the parent makes through `step` SHALL not call it. A cancelled change SHALL leave the step unchanged. The current
step's `Item` SHALL carry `aria-current="step"`.

#### Scenario: Validation refuses Next

- **WHEN** `onStepChange` calls `details.cancel()` for reason `next` on step 1
- **THEN** the step stays 1

### Requirement: Navigation Rules

`NextTrigger` and `PrevTrigger` SHALL move one step, skipping disabled steps, and SHALL be
disabled at the ends. With `linear` (default true), the user SHALL be able to select any
step up to the furthest visited one, and SHALL move beyond it only with `NextTrigger`.
Without `linear`, any step that is not disabled SHALL be selectable.

#### Scenario: Linear blocks jumping ahead (reka#2437)

- **WHEN** a linear Stepper on step 0 is shown
- **THEN** step 1's Trigger is not a button, and only `NextTrigger` reaches step 1

### Requirement: Step Triggers

A step the user can select SHALL render its `Trigger` as a `<button type="button">`. Any
other step SHALL render it as text. Each Trigger's accessible name SHALL be the step's
title followed by its status in parentheses (`messages.status`: "completed", "current"
or "not started"). A step before the current one SHALL be completed unless its Item says
otherwise.

#### Scenario: Name with status

- **WHEN** step 0 "Cart" is done and step 1 "Shipping" is current
- **THEN** the Triggers are named "Cart (completed)" and "Shipping (current)"

### Requirement: Focus And Announcement

When the user changes the step (`next`, `prev` or `select`), focus SHALL move to the new
step's `Content`, and `messages.stepAnnouncement` ("Step 2 of 4: Shipping") SHALL be
announced politely. A change the parent makes through `step` SHALL do neither. Each `Content` SHALL be
a `region` labelled with its "Step N of M: title" and SHALL be hidden unless current. It
SHALL stay mounted, so the values of the fields it contains survive navigation.

#### Scenario: Next moves focus

- **WHEN** the user presses Next on step 0 of 4
- **THEN** focus is on step 1's Content and "Step 2 of 4: Shipping" was announced

### Requirement: Step Count

The count SHALL come from `count`. Disabled and completed steps SHALL come from the
mounted Items. An Item that unmounts SHALL stop counting as disabled or completed.

#### Scenario: Conditional step (reka#2777)

- **WHEN** a disabled step's Item unmounts
- **THEN** Next no longer skips it

### Requirement: Data Attributes

Every part SHALL carry `data-scope="stepper"`, `data-part`, `data-instance` and
`data-orientation`. Item, Trigger, Indicator, Title, Description, Separator and Content
SHALL carry `data-index` and `data-status` (`completed`, `current` or `upcoming`), and
`data-disabled` when the step is disabled.

#### Scenario: Status attributes

- **WHEN** step 1 is current
- **THEN** step 0's parts carry `data-status="completed"`

### Requirement: Contract

The Stepper SHALL ship `stepperContract`, located by the Root's name, with the actions
`next`, `prev` and `select`, the queries `step`, `count`, `status`, `reachable` and
`focusInContent`, and a `getStepper` driver.

#### Scenario: Driver

- **WHEN** a test calls `next()` on step 0
- **THEN** `step()` is 1

### Requirement: Theme

`@rind-ui/theme` SHALL ship `stepper.css` in `@layer rind.components` with `:where()`
selectors, family `decoration`, horizontal and vertical layouts, logical properties only,
and a status shown by shape (a number, or a check when completed), not only by colour.

#### Scenario: Completed is a check

- **WHEN** a step is completed and its Indicator is empty
- **THEN** the theme draws a check icon in it
