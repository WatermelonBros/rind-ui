## MODIFIED Requirements

### Requirement: Grace Area

When the pointer leaves the trigger of an open layer, or leaves the layer's
content, a grace area SHALL be created: the polygon spanned by the exit point
(padded by a few pixels on both sides of the exit direction) and the rectangle of
the element it is heading to (the content, or the trigger). While the pointer stays
inside the polygon the layer SHALL stay open; entering the target SHALL remove the
grace area; leaving the polygon SHALL count as leaving the hover zone. The grace
area SHALL NOT be the hull of both rectangles, so a wide content box does not keep
the layer open while the pointer moves to neighbouring elements. The exit side is
the side nearest the exit point; when that side does not face the target, a side
that does face it SHALL count instead if the pointer's last movement heads towards
that side (a pointer leaving near a corner, towards a flipped submenu).

#### Scenario: Gap between trigger and content

- **WHEN** a hover card is placed 8 px below its trigger and the pointer moves
  from the trigger, through the gap, onto the card
- **THEN** the card never starts closing (regression: zag#3181, reka-ui#771,
  reka-ui#1063)

#### Scenario: Moving sideways off a wide card's trigger

- **WHEN** a hover card much wider than its trigger is open and the pointer leaves
  the trigger horizontally towards a neighbouring link
- **THEN** the pointer is outside the grace area and the card starts closing
  (regression: reka-ui#2203)

#### Scenario: Out near a corner towards a flipped submenu

- **WHEN** a submenu is placed on the left of its full-width trigger and the pointer
  moves down-left from the trigger, leaving it through the bottom edge a few pixels
  from the corner
- **THEN** a grace area towards the submenu is created and the submenu stays open
  (regression: radix#4036)
