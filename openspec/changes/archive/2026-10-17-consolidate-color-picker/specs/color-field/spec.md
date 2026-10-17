## MODIFIED Requirements

### Requirement: Color Field Anatomy

The Color Field and the Color Channel Field are a part of the Color Picker (`ColorPicker.ChannelInput`, by its `channel`), not standalone components: no package SHALL export them on their own, and they SHALL be rendered only inside a `ColorPicker.Root`. A field-only picker is an inline Color Picker with one `ChannelInput`. The requirements of this capability describe that part.

A Color Field SHALL consist of `Root` (a Field host: when not inside a Field it acts as one, as Text Field's Root does; inside
a Field it registers as that Field's control and its own Label, Description and ErrorMessage are not rendered, with a
development warning), `Label`, `Description`, `ErrorMessage`, `Input` (`<input type="text">`) and an automatic hidden input for
form participation (`hidden-form-input`). Every part SHALL accept the `render` prop and forward its element's attributes
(reka-ui#2545). Inside a Color Picker the Field is **embedded**: it registers with no Field and renders no Label of its own
(the picker's `ChannelInput` renders it).

#### Scenario: Standalone

- **WHEN** a Color Field with Label "Brand colour" and an Input is rendered
- **THEN** exactly one `textbox` exists, named "Brand colour", and one hidden input is in the form

#### Scenario: Attributes forwarded (reka-ui#2545)

- **WHEN** `data-testid` and `class` are passed to `Root`
- **THEN** they appear on the root element
