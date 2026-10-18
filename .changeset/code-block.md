---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Add Code Block: code readable as server HTML, from text, tokens or highlighter HTML (`trustedCodeHtml`, split per line with balanced tags); a copy button whose state follows the clipboard write and is announced politely ("Copied" / "Copy failed") with a constant name; line numbers as a CSS counter (never copied), highlighted lines with a description, soft wrap, a collapsed preview with `maxLines`, and a named tab stop only while the content scrolls. New `clipboard` environment capability (Clipboard API with a fallback next to the trigger), `fakeClipboard` and `getCodeBlock` in testing, `code-block.css`.
