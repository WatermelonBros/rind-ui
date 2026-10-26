---
"@rind-ui/core": patch
---

QR code and message thread fixes from the cross-library audit:

- QR Code: SVG export escapes the overlay's `href`, so a raw `data:image/svg+xml` logo no longer corrupts the file.
- Message Thread: when the message count drops while following (a deletion or a regenerate), the count seen drops too, so the user's next message still re-attaches.
