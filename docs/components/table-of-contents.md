# Table of Contents

"On this page": the list of a document's sections, with the one being read marked as you scroll and links that take you to a section. It is a navigation landmark of real anchor links; exactly one carries `aria-current="location"`, chosen by a reading line a third of the way down the scroll root, and the last section still becomes current at the bottom of the page. A followed link is current at once and stays so while the page scrolls to it, and keyboard and screen-reader users land on the heading itself.

## When to use

- **Use it for** long pages split by headings: documentation, articles, settings pages.
- **Over a hand-made scrollspy**:
  - the last short sections become current at the bottom (Starlight #1954, Fumadocs #670);
  - no flicker through the sections passed during a jump (tocbot #376);
  - sticky headers (`offset`) and scroll containers (`scrollRoot`);
  - the list follows the current item without moving the page (Starlight #3617);
  - one current item, not every visible one (zag#3378 reports the duplicate ids too);
  - focus moves to the heading after a keyboard jump.
- **Don't use it for** navigation between pages (a nav or [Breadcrumbs](breadcrumbs.md)) or for steps of a task ([Stepper](stepper.md)).

```tsx
import { collectHeadings } from "@rind-ui/core"
import { TableOfContents } from "@rind-ui/react"

const items = collectHeadings(article, "h2, h3") // or your own [{ id, label, depth }]

<TableOfContents.Root items={items}>
  <TableOfContents.Title>On this page</TableOfContents.Title>
  <TableOfContents.List>
    {items.map((item) => (
      <TableOfContents.Item key={item.id} item={item}>
        <TableOfContents.Link />
      </TableOfContents.Item>
    ))}
    <TableOfContents.Indicator />
  </TableOfContents.List>
</TableOfContents.Root>
```

## API

<!-- api:table-of-contents -->

## Anatomy

| Part | `data-part` | Element |
|---|---|---|
| `TableOfContents.Root` | `root` | `<nav>` named by the Title, else "On this page". |
| `TableOfContents.Title` | `title` | `<h2>` (any element through `render`); names the landmark. |
| `TableOfContents.List` | `list` | `<ol>`; scrolls itself to keep the current item in view. |
| `TableOfContents.Item` | `item` | `<li>`; takes `item` ({ id, label, depth }). |
| `TableOfContents.Link` | `link` | `<a href="#id">`, its label by default; `aria-current="location"` when current. |
| `TableOfContents.Indicator` | `indicator` | `aria-hidden` marker; `--rind-toc-indicator-top` and `--rind-toc-indicator-height` give the current link's box. |

## Rules

| Situation | Current section |
|---|---|
| Scrolling | The last heading above the reading line: `offset` plus `ratio` (default 1/3) of the scroll root below it. |
| Above the first heading | The first section. |
| At the end of the scroll range | The last heading whose top is in view. |
| After following a link | That section, held until the scroll settles or you scroll yourself. |
| A heading not rendered (`display: none`, a closed panel) | Skipped. |

Links navigate natively (history, URL, new tab all work); a jump is smooth if your CSS sets `scroll-behavior: smooth` and lands below a sticky header with `scroll-margin-top` on the headings. `data-visible` marks every section in view, without making it current. `onValueChange(value, { reason })` reports `"scroll"` or `"navigate"`.

## Keyboard

| Key | Action |
|---|---|
| Tab | Through the links. |
| Enter | Follows the link; focus moves to the section's heading (`tabindex="-1"` is added if needed). |

## Accessibility notes

- **A landmark** (`<nav>`) with a name, so it is listed among the page's regions.
- **One current location** (`aria-current="location"`); sections merely in view are styled with `data-visible`, never announced as current.
- **Not announced while scrolling**: the current item changes constantly; a screen reader finds it in the list.
- **Focus follows a keyboard or screen-reader jump** to the heading, so reading and Tab continue from the section. A pointer click leaves focus alone.
- **Not colour alone**: the theme marks the current link by weight and the indicator.

## Testing

```tsx
import { getTableOfContents } from "@rind-ui/testing"

const toc = getTableOfContents(screen, { name: "On this page" })
await toc.follow("Install")
expect(await toc.current()).toBe("Install")
expect(await toc.focusedHeading()).toBe("Install") // keyboard and virtual modalities
```

Contract actions: `follow(label)`. Queries: `current`, `visible`, `focusedHeading`.

## Tested with

<!-- tested-with:table-of-contents -->
_No manual screen-reader pass recorded yet._
<!-- /tested-with -->
