# Citation

A numbered marker in an AI answer ("[1]") that names its source and shows it in a card on hover or focus: title, domain, snippet and a link. The marker is a link to the source when it has a safe URL, a button that pins the card when it does not, and plain text while the source is still streaming in. The visible "1" is never the name: the marker is named "Source 1: Example Domain".

## When to use

- **Use it for** inline sources in generated answers, footnotes in long-form text, references in a research tool.
- **Over a superscript link**: a name that says what the source is (not "1"), a card readers can reach by keyboard and pin, `javascript:` and other unsafe URLs never rendered as links, and a pending state while the answer streams.
- **Always also list the sources** below the answer: touch and screen-reader users may never open a hover card.

```tsx
import { Citation } from "@rind-ui/react"

<p>
  Rind ships headless parts{" "}
  <Citation.Root index={1} source={{ title: "rind-ui docs", url: "https://example.com/docs", snippet: "Behaviour, accessibility and state…" }}>
    <Citation.Trigger />
    <Citation.Portal>
      <Citation.Positioner>
        <Citation.Content>
          <Citation.Source>
            <Citation.SourceTitle />
            <Citation.SourceUrl />
            <Citation.SourceSnippet />
            <Citation.SourceLink>Open source</Citation.SourceLink>
          </Citation.Source>
        </Citation.Content>
      </Citation.Positioner>
    </Citation.Portal>
  </Citation.Root>
  .
</p>
```

## API

<!-- api:citation -->

## The marker's kind

| Source | Marker | Press |
|---|---|---|
| none yet (`source` undefined) | `<span>`, `data-kind="pending"` | nothing |
| a safe `http(s)` URL | `<a href>` | follows the link |
| no URL, or an unsafe one | `<button>` | pins the card open |

The card opens on hover (after `openDelay`) and on keyboard focus, closes on leave, Escape or an outside press, and stays while the pointer is over it. It is a [Hover Card](hover-card.md).

## Accessibility notes

- **Named by its source**: "Source 1: Example Domain", from `messages`; the visible number is not the name.
- **Unsafe URLs are not links**: only `http:` and `https:` become an `href`; the rest is shown as text.
- **The card is supplementary**: everything in it must also be reachable from a sources list.

## Testing

```tsx
import { getCitation } from "@rind-ui/testing"

const cite = getCitation(screen, { name: "Source 1: Example Domain" })
expect(await cite.kind()).toBe("link")
```

## Tested with

<!-- tested-with:citation -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
