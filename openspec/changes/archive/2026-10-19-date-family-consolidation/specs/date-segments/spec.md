## MODIFIED Requirements

### Requirement: Typing And Auto-Advance

Typing into a numeric segment SHALL accept digits in the locale's numbering system and in Latin
and full-width forms (`number-parsing`) and SHALL reject any other insertion before it changes
the input. The segment SHALL show exactly the typed digits while it is focused, including
leading zeros. Focusing a segment SHALL start a new buffer, so the first digit replaces the
shown value. After each digit, focus SHALL advance to the next editable segment in format order
when no further digit can keep the buffer within the segment's limit, or the buffer has the
limit's digit count. A digit typed into a full buffer of the last segment SHALL be ignored.
Typing the locale's separator literal (or "/", "-", ".", ":" and space) in a non-empty segment
SHALL advance. A 12-hour hour segment SHALL be typed as 1–12: "0" or "1" waits for a second
digit, any other digit advances, and a "0" committed alone SHALL mean 12; a 24-hour hour waits
after "0"–"2" and advances after any other digit.

#### Scenario: Leading zero shown and advancing (react-spectrum#6004, react-spectrum#8637)

- **WHEN** the user types "0" into the month segment, then "1"
- **THEN** after "0" the segment shows "0" and keeps focus, and after "1" it shows "01" and
  focus moves to the day

#### Scenario: Year with a leading zero (react-spectrum#9952)

- **WHEN** the user types "0","2","0","2","6" into the year segment
- **THEN** the segment shows "0202" after the fourth digit, focus has left it, and the fifth
  digit lands in the next segment or is ignored in the last one

#### Scenario: Retyping a filled segment (react-spectrum#8366, reka-ui#2567)

- **WHEN** the year shows 2026, the user focuses it and types "1","9","9","0"
- **THEN** the year is 1990

#### Scenario: Full-width digits (react-spectrum#3739)

- **WHEN** a Japanese IME commits "１２" into the month segment
- **THEN** the month is 12

#### Scenario: Separator advances (react-spectrum#5364)

- **WHEN** the user types "3" then "/" in the month segment of an `en-US` field
- **THEN** the month is 3 and focus is on the day

#### Scenario: Last segment does not overwrite (reka-ui#2002)

- **WHEN** the year is complete and focused as the last segment and the user types "7"
- **THEN** the year is unchanged

#### Scenario: Two-digit 12-hour hour (bits-ui#1662)

- **WHEN** the user types "1","1" into the hour of an `en-US` 12-hour field
- **THEN** the hour is 11 and focus moved to the minutes only after the second "1"

#### Scenario: Zero alone in 12-hour

- **WHEN** the user types "0" into the hour of a 12-hour field and tabs to the minutes
- **THEN** the hour shows 12

#### Scenario: Zero-based 24-hour (bits-ui#914, reka-ui#1154)

- **WHEN** the user types "0","0" into the hour of a 24-hour field
- **THEN** the hour shows "00" and its value is 0
