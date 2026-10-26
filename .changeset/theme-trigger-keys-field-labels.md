---
"@rind-ui/theme": patch
---

The triggers that open an overlay (Dialog, Drawer, Popover, Menu outside a menubar, Tour, Tooltip) and a Timer's ActionTriggers are styled as Buttons (family `action`: "triggers styled as buttons"); they rendered as unstyled native buttons, and rendering a Button there replaces its scope. The field label of Select, Slider, Listbox, Color Picker, Meter, Progress, Rating and Tree View has the field label style (it inherited the body text). An empty Select Indicator draws the theme's caret.
