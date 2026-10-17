## MODIFIED Requirements

### Requirement: Portalled Content Keeps The Theme

The host of portalled content SHALL carry the `data-rind-theme` and `data-theme` values
of the nearest ancestors of its logical parent that carry them, and SHALL update them
while mounted when those ancestor attributes change. Tokens SHALL reach portalled
content through these attributes and the cascade only, without framework context.

#### Scenario: Portal content keeps the tenant theme (radix-ui/themes#708)

- **WHEN** a menu is opened from a trigger inside `[data-rind-theme="acme"]` and its
  content is portalled to `body`
- **THEN** the menu content uses `acme`'s tokens, not the `:root` theme

#### Scenario: Scheme switch while a toast is open (chakra-ui#3076)

- **WHEN** a toast is visible and the ancestor's `data-theme` changes from `light` to
  `dark`
- **THEN** the toast repaints in the dark scheme without being re-opened

#### Scenario: Brand switch while a popover is open

- **WHEN** `data-rind-theme` changes on an example's root while a popover is open
- **THEN** the popover content uses the new brand
