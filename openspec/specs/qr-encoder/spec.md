# qr-encoder Specification

## Purpose
Defines the QR Code encoder in `@rind-ui/core`: a pure, dependency-free function that turns a
string or bytes into the module matrix of a QR Code symbol (ISO/IEC 18004 versions 1 to 40,
four error-correction levels, numeric, alphanumeric and byte modes), plus the pure helpers
that turn a matrix into an SVG path and a standalone SVG string. It is the only place QR
encoding logic lives, so it can be verified without a DOM and decoded back in tests.
## Requirements
### Requirement: Encoding Result

`encodeQr(input, options?)` SHALL accept a string or a `Uint8Array` and SHALL return a result,
never throw for data-dependent failures. A success SHALL carry `ok: true`, `version` (1–40),
`ecc` (the level actually used), `mask` (0–7), `size` (the number of modules per side,
`17 + 4 × version`, **without** quiet zone), `modules` (a row-major matrix of booleans, `true`
for a dark module, which callers SHALL treat as read-only) and `segments` (the mode and
length of each segment). A failure SHALL carry `ok: false` and an `error` of `"too-long"`
(with `neededBits` and `availableBits` for the best version, and `maxBytes` at the requested
level), `"invalid-option"` (with the option name) or `"invalid-input"` (an input that is
neither a string nor bytes). The same input and options SHALL always produce the same result,
in any environment, with no access to globals, the DOM, time or randomness.

#### Scenario: Success result

- **WHEN** `encodeQr("01234567", { ecc: "M" })` is called
- **THEN** the result has `ok: true`, `version: 1`, `ecc: "M"`, `size: 21` and a 21 × 21
  matrix

#### Scenario: Too long is a result

- **WHEN** a string needing more than the version-40 capacity at level L is encoded
- **THEN** the result is `{ ok: false, error: "too-long" }` with `neededBits`,
  `availableBits` and `maxBytes: 2953`, and nothing is thrown (regression: react-qr-code#255,
  where the page crashed above ~2953 characters; qrcode.react#225)

#### Scenario: Wrong input type

- **WHEN** `encodeQr(123 as never)` is called
- **THEN** the result is `{ ok: false, error: "invalid-input" }` (regression: uqr#2,
  "data is not iterable")

#### Scenario: Deterministic

- **WHEN** the same value and options are encoded in Node, in a browser and under
  server rendering
- **THEN** the matrices are identical

### Requirement: Input And Character Encoding

A string SHALL be encoded as UTF-8 with the platform-independent `TextEncoder` semantics,
where a lone surrogate becomes U+FFFD and never throws. A `Uint8Array` SHALL be encoded as
bytes unchanged. When a string contains any character above U+007F and `eci` is `"auto"`
(default), the byte segment SHALL be preceded by an ECI segment declaring UTF-8
(assignment 26), so readers do not have to guess between ISO 8859-1 and UTF-8; with `eci:
"none"` no ECI segment SHALL be written; a string of ASCII characters SHALL never get an ECI
segment. ECI overhead (12 bits) SHALL count in the capacity check. The empty string SHALL
encode to a valid version-1 symbol with no data.

#### Scenario: Lone surrogate

- **WHEN** a string ending in a lone high surrogate (`"a\uD83D"`) is encoded
- **THEN** the symbol decodes to `"a�"` and nothing is thrown (`uqr`'s
  `encodeURI`-based conversion throws `URIError`)

#### Scenario: Non-ASCII text carries an ECI segment

- **WHEN** `"홍길동"` is encoded with the defaults
- **THEN** `segments` starts with an ECI segment (26) followed by a byte segment of 9 bytes,
  and a conforming decoder returns the original text (regression: react-qr-code#283,
  nayuki#154)

#### Scenario: ASCII has no ECI

- **WHEN** `"https://example.com"` is encoded with the defaults
- **THEN** `segments` has no ECI segment

#### Scenario: Binary payload

- **WHEN** a 64-byte `Uint8Array` is encoded
- **THEN** it is one byte segment with no ECI and the decoded bytes equal the input
  (regression: nayuki#104, where the reader inserted U+FFFD)

#### Scenario: Empty string

- **WHEN** `""` is encoded
- **THEN** the result is `ok: true` with `version: 1` and zero data characters

### Requirement: Segment Mode Selection

The encoder SHALL encode the whole value as a single data segment in the most compact mode that
can represent every character: numeric when every character is `0`–`9`; alphanumeric when
every character is in `0-9 A-Z space $ % * + - . / :`; otherwise byte. Mode indicators SHALL be
numeric `0001`, alphanumeric `0010`, byte `0100` and ECI `0111`, and the character-count field
widths SHALL be numeric 10 / 12 / 14, alphanumeric 9 / 11 / 13 and byte 8 / 16 / 16 bits for
versions 1–9 / 10–26 / 27–40.

#### Scenario: Digits

- **WHEN** `"01234567"` is encoded at level M
- **THEN** the single segment is numeric, 8 characters, and the bit stream starts `0001
  0000001000 0000001100 0101011001 1000011` (ISO/IEC 18004 Annex I example)

#### Scenario: One lowercase letter

- **WHEN** `"HTTPS://EXAMPLE.COM/a"` is encoded
- **THEN** it is a byte segment (the whole value falls to byte mode, as documented), not
  alphanumeric (nayuki#166)

#### Scenario: Count field width follows the version

- **WHEN** 300 bytes are encoded at level L
- **THEN** the version is 11 (version 10 holds 271 bytes at L) and the byte segment's count
  field is 16 bits wide, which a conforming decoder reads back

### Requirement: Version And Capacity

The encoder SHALL choose the smallest version in `[minVersion, maxVersion]` (defaults 1 and 40)
whose data capacity holds the segments, and SHALL fail with `"too-long"` only after trying
`maxVersion`. At version 40 the capacities SHALL be 7089 digits, 4296 alphanumeric characters
and 2953 bytes at level L, 5596 / 3391 / 2331 at M, 3993 / 2420 / 1663 at Q and 3057 / 1852 /
1273 at H; at version 1 level L 41 / 25 / 17, M 34 / 20 / 14, H 17 / 10 / 7. `minVersion`
and `maxVersion` outside 1–40 or `minVersion > maxVersion` SHALL return `"invalid-option"`.

#### Scenario: Exactly at the version-40 capacity

- **WHEN** 2953 bytes of binary data are encoded at level L, then 2954
- **THEN** the first is version 40 and the second is `"too-long"` (regression: nayuki#32,
  where the reporter believed version 40 was unreachable)

#### Scenario: Version 1 boundary

- **WHEN** 17 and then 18 bytes are encoded at level L
- **THEN** the first is version 1 and the second version 2

#### Scenario: Forced minimum version

- **WHEN** `"hi"` is encoded with `minVersion: 5`
- **THEN** the version is 5

#### Scenario: UTF-16 length is not byte length

- **WHEN** a string of 1000 four-byte emoji is encoded at level L
- **THEN** it is `"too-long"` with `maxBytes: 2953` and `neededBits` reflecting 4000 bytes

### Requirement: Error Correction

The level SHALL be one of `"L"`, `"M"`, `"Q"`, `"H"` (default `"M"`); any other value SHALL
return `"invalid-option"` (a lowercase `"h"` is an invalid option, not a thrown `TypeError`).
Format bits SHALL be `L=01`, `M=00`, `Q=11`, `H=10`. With `boostEcc: true` the encoder SHALL
raise the level to the highest of M, Q and H that still fits the chosen version and report it
as `ecc`; with the default `boostEcc: false` the requested level SHALL be used as is (so the
output equals other generators at the same explicit level).

#### Scenario: Invalid level

- **WHEN** `encodeQr("x", { ecc: "h" as never })` is called
- **THEN** the result is `{ ok: false, error: "invalid-option", option: "ecc" }`
  (regression: qrcode.react#199)

#### Scenario: No silent boost

- **WHEN** `"A"` is encoded at level L with the defaults
- **THEN** `ecc` is `"L"` (regression: qrcode.react#356)

#### Scenario: Explicit boost

- **WHEN** `"A"` is encoded at level L with `boostEcc: true`
- **THEN** `ecc` is `"H"` and the version is still 1

### Requirement: Reed-Solomon And Interleaving

The data codewords SHALL be split into the version and level's blocks (the shorter blocks
first, the longer ones one data codeword longer), each block extended with its error-correction
codewords by Reed-Solomon over GF(2⁸) with the generator polynomial `x⁸+x⁴+x³+x²+1` (`0x11D`),
and the final sequence SHALL interleave the data codewords block by block, then the
error-correction codewords block by block. The remainder bits after the last codeword SHALL be
zero.

#### Scenario: Annex I example codewords

- **WHEN** `"01234567"` is encoded at level M
- **THEN** the data codewords are `16 32 12 86 97 128 236 17 236 17 236 17 236 17 236 17` and
  the error-correction codewords are `165 36 212 193 237 54 199 135 44 85`

#### Scenario: Multiple blocks interleave

- **WHEN** a version-5 level-Q symbol (two block sizes) is encoded
- **THEN** the interleaved sequence takes codeword `i` of every block in turn, and a
  decoder that de-interleaves recovers each block with all syndromes zero

### Requirement: Matrix Construction

The matrix SHALL contain the three finder patterns with their separators, the timing patterns
on row 6 and column 6, the alignment patterns at the positions of the version (none at version
1; centres at 6, 18 at version 2; 6, 22, 38 at version 7; 6, 30, 58, 86, 114, 142, 170 at
version 40; none overlapping a finder pattern), the dark module at (4 × version + 9, 8), the
format information (15 bits, BCH(15,5) with generator `0x537`, XOR `0x5412`, written twice)
and, from version 7, the version information (18 bits, BCH(18,6) with generator `0x1F25`,
written twice). Data bits SHALL be placed in two-module columns from the bottom right, moving
up and down alternately, skipping column 6 and every function module.

#### Scenario: Format information words

- **WHEN** the format information for mask 0 is computed for L, M, Q and H
- **THEN** the 15-bit words are `111011111000100`, `101010000010010`, `011010101011111` and
  `001011010001001`

#### Scenario: Version information

- **WHEN** the version information of version 7 is computed
- **THEN** the 18-bit word is `000111110010010100`

#### Scenario: Alignment positions for every version

- **WHEN** the alignment pattern centres are computed for versions 1 to 40
- **THEN** they equal the table of the standard for all 40 versions (regression: nayuki#214,
  where one port's step formula differed)

#### Scenario: Function patterns survive masking

- **WHEN** any symbol is encoded with any mask
- **THEN** the finder, timing and alignment modules, the dark module and the format and
  version words are unchanged by the mask

### Requirement: Mask Selection

When `mask` is `-1` or omitted the encoder SHALL apply each of the eight mask patterns
(each flips a data module, never a function module, when its expression is 0: `(r+c) mod 2`,
`r mod 2`, `c mod 3`, `(r+c) mod 3`, `(⌊r/2⌋+⌊c/3⌋) mod 2`, `rc mod 2 + rc mod 3`,
`(rc mod 2 + rc mod 3) mod 2`, `((r+c) mod 2 + rc mod 3) mod 2`), write the format
information for it, score it with the four penalty rules (runs of five or more same-coloured
modules: 3 + the excess; 2 × 2 blocks: 3 each; finder-like 1:1:3:1:1 runs with four light modules
before or after: 40 each; dark-module proportion: 10 × the smallest `k ≥ 0` for which the
proportion lies within (45 − 5k) % to (55 + 5k) %) and keep the
mask with the lowest score, the lowest mask number winning a tie. A `mask` from 0 to 7 SHALL
force that mask; any other number SHALL return `"invalid-option"`.

#### Scenario: Auto mask equals the minimum

- **WHEN** a symbol is encoded with the automatic mask
- **THEN** its penalty score is not higher than that of the same symbol with any forced mask

#### Scenario: Forced mask

- **WHEN** `mask: 3` is given
- **THEN** the result's `mask` is 3 and the format information word encodes mask 3

#### Scenario: Differential output

- **WHEN** the fixture set (digits, alphanumeric, ASCII URL, UTF-8, binary and boundary
  values at every level) is encoded with `boostEcc: false` and `eci: "none"`
- **THEN** every matrix equals the one generated by the reference implementations
  (`uqr`, Nayuki) stored with the tests as fixtures

### Requirement: Decodability

Every symbol the encoder produces SHALL decode back to its input. The testing package SHALL
provide a decoder (format information, unmasking, de-interleaving, Reed-Solomon verification
with all syndromes zero, segment parsing) used as the oracle of property tests over random
values, all versions, all levels and all eight forced masks; in browser tests an
engine-provided `BarcodeDetector` SHALL be used as a second, independent oracle where it
supports QR codes.

#### Scenario: Round trip over all versions

- **WHEN** a value of the maximum length is encoded for each of the 40 versions at each level
- **THEN** the decoder returns the same value for every one

#### Scenario: Damaged symbol

- **WHEN** modules are flipped to damage fewer codewords than the level can correct
- **THEN** the decoder still returns the value (the test proves the error-correction codewords
  are right, not only the data)

### Requirement: Path And Standalone SVG

`qrPath(matrix, { quietZone })` SHALL return one SVG path string in module units that covers
exactly the dark modules, with each maximal horizontal run of adjacent dark modules in a row
as one subpath (`M{x} {y}h{n}v1H{x}z`) and the quiet zone (default 4 modules) as an offset;
for a version-1 symbol it SHALL have fewer subpaths than dark modules. `renderQrSvg(result,
options)` SHALL return a standalone SVG string (`viewBox` including the quiet zone,
`shape-rendering="crispEdges"`, a background rect and the path, optional `title` and `desc`),
in which every interpolated attribute value is escaped, so a hostile colour option cannot inject
markup.

#### Scenario: Path covers the dark modules

- **WHEN** the path of a symbol is rasterised at one pixel per module
- **THEN** the dark pixels are exactly the dark modules and there is no dark pixel in the quiet
  zone

#### Scenario: Run merging

- **WHEN** a row has the dark modules `1 1 1 0 1`
- **THEN** it contributes two subpaths (`h3` and `h1`), not four

#### Scenario: Attribute injection

- **WHEN** `renderQrSvg` is given the background `"\"><script>alert(1)</script>"`
- **THEN** the output contains no `<script` and is well-formed XML (regression: uqr#9)

#### Scenario: Valid attribute names

- **WHEN** the standalone SVG is validated
- **THEN** it uses `shape-rendering`, never `shapeRendering` (regression: qrcode.react#113)

### Requirement: Performance And Footprint

The encoder SHALL be synchronous and linear-ish in the number of modules: a version-40
symbol at level H with automatic mask selection SHALL encode in under 100 ms on the CI
machine. The encoder and its tables SHALL be reachable from their own entry point
(`@rind-ui/core/qr`) so an application that only needs a matrix does not bundle the
component, and SHALL have no runtime dependency.

#### Scenario: Largest symbol

- **WHEN** a 1273-byte binary value is encoded at level H
- **THEN** the call returns in under 100 ms

#### Scenario: No dependency

- **WHEN** the package manifest of `@rind-ui/core` is read
- **THEN** it lists no QR-related runtime dependency

