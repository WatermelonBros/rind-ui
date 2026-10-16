# delay-group Specification

## Purpose
Coordinates the members of a delay group (tooltips today, navigation-menu
triggers later): at most one member open at a time, and a warm window during
which the next member opens without its delay — the warm-up / cool-down
behaviour users expect when moving along a toolbar — with state that cannot leak
across unmounts, library copies or documents.
## Requirements
### Requirement: One Group Per Document

By default every member SHALL join the single delay group of its document. The
group SHALL be stored on the document under a versioned global key, so two copies
of `@rind-ui/core` in one page share it, and members in different documents
(iframes) SHALL never affect each other. The group SHALL be reached by machines
through an injected capability, so it can be faked in Node.

#### Scenario: Two library copies

- **WHEN** a page bundles two copies of `@rind-ui/core` and a tooltip from each is
  hovered in turn within the warm window
- **THEN** the second opens without delay and the first closes

#### Scenario: Iframe

- **WHEN** a tooltip is open in the main document and a tooltip in a same-origin
  iframe is hovered
- **THEN** the main document's tooltip stays open and the iframe's tooltip waits
  for its own delay

### Requirement: One Open Member

When a member opens, every other open member of the group SHALL close at once,
with reason `"group"`, and both the closing and the opening member SHALL be marked
instant for that transition (no enter or exit animation). Coordination SHALL be
done through the shared group object, not through DOM events.

#### Scenario: Moving between adjacent triggers

- **WHEN** tooltip A is open and the pointer moves onto the adjacent trigger B
- **THEN** A closes immediately with reason `"group"`, B opens, and at no time are
  both visible (regression: reka-ui#850, reka-ui#1544, bits-ui#1300)

#### Scenario: Opened without a preceding leave

- **WHEN** tooltip A is open by hover and tooltip B is opened by keyboard focus
  without the pointer leaving A
- **THEN** A closes (regression: reka-ui#2868)

### Requirement: Warm Window

The group SHALL be warm while any member is open and for the skip delay after the
last member closed, where the skip delay is that member's `skipDelay` (default
300 ms). A member asked to open by hover while the
group is warm SHALL open without waiting for its open delay and SHALL be marked
instant. The skip delay SHALL be independent of members' close delays. A skip
delay of `0` SHALL make the group cold as soon as the last member closes. All
timing SHALL use the injected scheduler.

#### Scenario: Toolbar sweep

- **WHEN** a tooltip in a toolbar has opened after its 700 ms delay and the
  pointer moves to the next button within 300 ms
- **THEN** the next tooltip opens immediately with `data-instant`

#### Scenario: Cold again

- **WHEN** the last open tooltip closed 400 ms ago and another trigger is hovered
- **THEN** that tooltip waits for its full open delay

#### Scenario: Close delay does not extend the window

- **WHEN** a tooltip with `closeDelay: 0` closes and another trigger is hovered
  350 ms later with the default skip delay
- **THEN** the second tooltip waits for its open delay (regression:
  react-spectrum#9517)

#### Scenario: Skip delay zero

- **WHEN** the skip delay is `0` and the pointer moves from an open tooltip's
  trigger directly onto another trigger
- **THEN** the second tooltip waits for its full open delay (regression:
  radix#3873, radix#1110)

### Requirement: Membership Lifetime

A member SHALL be registered while its component is mounted and SHALL be removed
when its service stops, whether or not it is open; removing an open member SHALL
count as it closing (starting the skip window). A member's repeated open requests
while it is already waiting for its delay SHALL NOT make it open early.

#### Scenario: Open tooltip unmounted

- **WHEN** a toolbar is removed while one of its tooltips is open, and five
  seconds later another trigger on the page is hovered
- **THEN** that tooltip waits for its full open delay (regression: zag#3390)

#### Scenario: Open requested twice

- **WHEN** a tooltip receives two open requests 100 ms apart while cold
- **THEN** it opens once, after its open delay from the first request
  (regression: react-spectrum#8026)

