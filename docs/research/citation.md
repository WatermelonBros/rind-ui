# Citation — research

Status: done · Wave: AI

A Citation is the inline reference an AI answer puts after a claim: a marker (`[1]`, a number,
a source chip) that stands for one or more sources, and a **preview** of the source (title, URL
or domain, a snippet of the cited passage) that opens on the marker. The marker is the part
the kits handle unevenly: in one it is a `span` that only a mouse can reach, in another a real
link, in the third a button. The rest is the hover card of
[hover-card.md](hover-card.md) with a different trigger, plus a list of all sources for the
readers who never see a hover card (touch, screen reader virtual cursor). There is no model and
no retrieval inside: the consumer's runtime (AI SDK, a provider's annotations, a RAG pipeline)
decides which text span cites which source and passes the data in. This note records how the AI
kits built it, the bugs on their trackers, the shapes the providers return, and the decisions
for `add-citation`.

Builds on [hover-card.md](hover-card.md) (the base: "also the base of the AI primitive
Citation"; its open question about long press for non-link triggers), [popover.md](popover.md)
(press-to-open, non-modal tab order), [tooltip.md](tooltip.md) (hover intent and the delay
group), [collapsible.md](collapsible.md) (the sources list disclosure),
[streaming-message.md](streaming-message.md) (markers appear while the text streams; the
completion announcement) and [message-thread.md](message-thread.md) (a citation inside a
message; scroll anchoring), [floating-positioning.md](floating-positioning.md), and the
cross-cutting notes [accessibility.md](accessibility.md) §1.3 (`aria-details`, ARIA 1.3), §1.5
(APG Link), §4.3 (portalled non-modal popups), §7.5, rules 11, 19, 20, 22, 23,
[assistive-tech-and-a11y-testing.md](assistive-tech-and-a11y-testing.md) causes A, C, D, J.

Sources read (GitHub API, `gh`, the providers' public docs and the W3C pages, 2026-10-26):

| Library | Files |
|---|---|
| Vercel AI Elements | `vercel/ai-elements` `packages/elements/src/inline-citation.tsx` (296 lines: `InlineCitation`, `InlineCitationText`, `InlineCitationCard`, `…CardTrigger`, `…CardBody`, `…Carousel*`, `…Source`, `…Quote`), `sources.tsx` (77 lines: `Sources`, `SourcesTrigger`, `SourcesContent`, `Source`), `packages/shadcn-ui/components/ui/badge.tsx` (head) |
| prompt-kit | `components/prompt-kit/source.tsx` (129 lines: `Source`, `SourceTrigger`, `SourceContent`), file tree searched for "source", "citation", "reference" |
| assistant-ui | `packages/ui/src/components/react/assistant-ui/elements/inline-citation.tsx` (143 lines: `Citation`, `InlineCitation`), its test names, `apps/docs/content/elements/inline-citation.mdx` (grepped for keyboard and accessibility text), `apps/docs/components/demo/elements/inline-citation.tsx` |
| Vercel AI SDK | `packages/ai/src/ui/ui-messages.ts` (`TextUIPart.citations`, `SourceUrlUIPart`, `SourceDocumentUIPart`), `packages/ai/src/types/citation.ts` |
| Providers | Anthropic "Citations" (`platform.claude.com/docs/en/build-with-claude/citations`: location types, `cited_text`, `citations_delta`), OpenAI "Web search" guide (`url_citation` annotations); OpenAI streaming event name from a third-party guide (marked) |
| Behaviour of products | Perplexity and ChatGPT only through third-party UX teardowns (aiuxplayground.com) and a how-to page; nothing from the products' own documentation |
| Trackers | `vercel/ai-elements`, `assistant-ui/assistant-ui`, `vercel/streamdown`, `mui/base-ui`, hover-card.md's table for Radix, Reka, React Aria |
| Platform | WAI-ARIA 1.2 `link`, ARIA 1.3 `aria-details` (accessibility.md §1.3), DPUB-ARIA 1.1 (`doc-biblioref`, `doc-noteref`, `doc-backlink`, `doc-bibliography`), WCAG 2.2 1.4.13, 2.1.1, 2.4.4, 2.5.3, 2.5.8, 3.1.2 |

Radix, React Aria, Base UI, Headless UI, Ariakit, Ark/Zag, Reka UI, Bits UI and Kobalte ship no
Citation; they ship the hover card (Radix `HoverCard`, Base UI `PreviewCard`, React Aria
`PreviewTrigger`) that the kits build it from. Perplexity's and ChatGPT's own accessibility behaviour was not found in any source; the
products were not used for this research.

## Pattern

- WAI-ARIA APG: **none for the whole**. The marker is an APG **Link** (`<a href>`, Enter) or a
  **Button** (Enter and Space). The preview is a non-modal `dialog`, as in hover-card.md: "Hover
  Card is *not* a tooltip" (accessibility.md §1.5), because it can hold links.
- DPUB-ARIA is the closest semantic vocabulary and is not a pattern: `doc-noteref` ("a reference
  to a footnote or endnote, typically appearing as a superscripted number") and `doc-biblioref`
  ("a reference to a bibliography entry") are subclasses of `link` and must sit on a link; the
  target list is `doc-bibliography` (a landmark that must contain a list) or `doc-endnotes` /
  `doc-footnote` ([DPUB-ARIA 1.1](https://www.w3.org/TR/dpub-aria-1.1/)). Whether screen readers
  say anything useful for them was not found in a source (open question).
- ARIA 1.3 `aria-details` takes several IDREFs; accessibility.md §1.3 already lists
  "Citation → source card" as its use. Every IDREF must resolve (accessibility.md rule 2), so a reference to
  a card that is not mounted is not allowed.
- **The usage rule from hover-card.md applies in full**: everything in the preview is also
  reachable without it. For a citation the equivalent is the list of sources of the answer, and
  the source's own link.
- OpenAI states the requirement on the provider side: "inline citations must be made clearly
  visible and clickable in your user interface" ([web search guide](https://developers.openai.com/api/docs/guides/tools-web-search)).
  A hover-only marker does not meet it for keyboard or touch users.
- WCAG: 2.1.1 (keyboard), 1.4.13 (content on hover or focus: dismissible, hoverable,
  persistent: hover-card.md), 2.5.3 Label in Name (the name must contain the visible `1`), 2.5.8
  Target Size (Minimum) has an exception for inline targets in a sentence, which a marker is;
  a chip is not inline and needs 24 CSS px, 2.4.4 Link Purpose, 3.1.2 Language of Parts (a source
  title in another language gets its own `lang`), 4.1.3 does not apply (nothing is announced).

## How the others built it

| | AI Elements `InlineCitation` | assistant-ui `Citation` | prompt-kit `Source` |
|---|---|---|---|
| Marker | `Badge` (shadcn, a `span`) with the first source's hostname and "+N", inside Radix `HoverCardTrigger asChild` | a real `<button type="button">` showing the 1-based index | a real `<a href target="_blank" rel="noopener noreferrer">` (`SourceTrigger`) showing the `label` (a number) or the hostname, optionally a favicon |
| Name | the badge text (hostname) | `aria-label="Source {n}: {title}"` | the link text (label or hostname); the favicon `img` has `alt="favicon"` |
| Opens | hover; `openDelay={0}` and `closeDelay={0}` | hover and focus (Base UI `PreviewCard.Trigger delay={0}`), or controlled by `open` / `onOpenChange` | Radix `HoverCard` `openDelay={150}` `closeDelay={0}` |
| Keyboard | nothing in the source makes the span focusable: no `tabIndex`, no `role`, `asChild` passes the Badge's props through | Tab to the button opens the preview (docs: "Hovering or focusing a marker opens a compact preview") | the trigger is an `a`, so Tab reaches it; opening on focus and reaching the card are whatever Radix does (hover-card.md: tabbables in the card are forced out of the Tab order, RX#2692) |
| Several sources | a `Carousel` with Previous / Next buttons and an `n/m` index (not live) | one source per marker | one `Source` per marker |
| Content | `title` (`h4`), `url` (a `p`, not a link), `description` (3 lines), `Quote` (`blockquote`) | domain and date, `title`, `snippet`, and an "Open source" link with a screen-reader-only "(opens in a new tab)" | the whole card is one `<a>` wrapping favicon, domain, `title` (2 lines), `description` (2 lines) |
| Sources list | `Sources` = Collapsible, "Used {count} sources" (English in the source), `Source` = `<a target="_blank" rel="noreferrer">` | `sources.tsx` (not read) | none |
| URL safety | `new URL(sources[0]).hostname` (throws on a string that is not a URL) | `safeHref`; test "links safe source URLs but leaves unsafe ones inert" | `try { new URL(href).hostname } catch { href.split("/").pop() }`; `href` is not scheme-checked |
| Date and language | none | `Intl.DateTimeFormat("en-US", …)` fixed | none |

### Vercel AI Elements

- `InlineCitation` is a `span` wrapper, `InlineCitationText` the cited words (a background on
  `group-hover`), `InlineCitationCard` is `HoverCard` with both delays 0,
  `InlineCitationCardTrigger` the badge, `InlineCitationCardBody` a `w-80` card.
- The trigger takes a `sources: string[]` of URLs only and derives the label from
  `new URL(sources[0]).hostname`; titles and snippets are rendered separately by
  `InlineCitationSource` with `title`, `url`, `description`. Nothing connects the marker to the
  `Sources` list: no ids, no numbering.
- Markdown is the consumer's problem: issue #252 (closed) reports that an answer containing
  `[id1, id2]` must be split into markdown text and citation components by hand, and #42
  (closed) that there was no documentation for rendering citations with Streamdown.

### prompt-kit

- `Source` is a provider of `{ href, domain }` over a Radix `HoverCard`; `SourceTrigger` renders
  the link itself inside `HoverCardTrigger asChild`, so the marker is focusable and navigable like
  any link. It builds the favicon URL as `https://www.google.com/s2/favicons?sz=64&domain_url=` plus
  the page's URL: each rendered source sends that URL to Google's favicon service. `SourceContent`
  makes the whole card a link, so the title and snippet are one long link name.
- It has `description` as a required string, no sources list, no numbering across markers, and a
  `target="_blank"` link without a notice that it opens a new tab.

### assistant-ui

- The marker is a button with an accessible name that includes the source title ("so the
  numbered label never has to carry the source context alone", from its docs). The preview
  is a Base UI `PreviewCard` (a non-modal popup). `InlineCitation` is a `p`.
- `Source = { domain?, title, snippet, url?, publishedAt? }`; `safeHref(url)` and `hostOf(url)`
  are helpers outside the component.
- The runtime side exists too: the LangGraph adapter handles Anthropic's `citations_delta`
  (issue #6901 below).

### What the providers hand the UI

- **AI SDK**: a text part can carry `citations?: Array<Citation>` where a `Citation` is
  `{ source: url | document, startIndex?, endIndex?, citedText? }` and the source is `{ id,
  url, title? }` or `{ id, mediaType, title, filename? }`; standalone `source-url` and
  `source-document` parts carry no position.
- **Anthropic**: a text block carries `citations` of type `char_location`, `page_location` or
  `content_block_location`, each with `cited_text` ("not counted toward output tokens"), `document_index`, `document_title`
  and, for `char_location`, `start_char_index` and `end_char_index` (0-indexed, the end exclusive). Streaming: "citations arrive as a `citations_delta` delta type
  inside `content_block_delta` events", one citation per delta, attached to the current text
  block.
- **OpenAI**: `url_citation` annotations with `type`, `start_index`, `end_index`, `url`, `title`;
  per a third-party guide each arrives as a `response.output_text.annotation.added` event while
  streaming and the final event repeats them. Whether the indices count characters or bytes
  was not stated in the sources read.
- So a citation arrives as (a) a marker typed in the text by the model (`[1]`) and later
  resolved against a list, (b) a character range plus a source, or (c) a passage in a document.
  The component must not assume which.

### Product behaviour (secondary sources only)

- Perplexity, per a UX teardown: numbered markers; hovering shows title, domain, date and an
  excerpt; clicking opens the source in a new tab. ChatGPT: a publisher chip (favicon and name)
  after the claim, a card with headline and snippet on hover or click, and a separate Sources
  list. Both from third-party descriptions, not from the products.

## Bug history

Search: the trackers above for "citation", "source", "footnote", "preview card" and "hover card"
(open and closed); hover-card.md's table of 25 rows is the base for everything about the card
and is summarised, not repeated. Entries marked "title only" were not opened.

| Library | Issue | Symptom | Root cause | Fix / status | Lesson for rind-ui |
|---|---|---|---|---|---|
| AI Elements | `inline-citation.tsx` (source, no issue) | the marker cannot be focused; nothing opens for a keyboard or touch user | a `span` badge under `HoverCardTrigger asChild`; Radix hover cards are pointer-only (hover-card.md RX#2692) | open (by design) | the marker is an `a` or a `button`, always |
| AI Elements | `inline-citation.tsx` (source) | `new URL(sources[0])` throws on a string that is not a URL, and the whole message tree fails | no validation of a model-supplied value | open | a URL is parsed in `try`; the marker never throws; an unparsable URL gives an inert marker with plain text |
| AI Elements | `inline-citation.tsx`, `sources.tsx` (source) | "Used {count} sources", "Previous", "Next" are English strings in the component | no messages | open | every AT-facing string is in `messages` (accessibility.md rule 7) |
| AI Elements | [#252](https://github.com/vercel/ai-elements/issues/252) | citation ids in `[id1, id2]` form cannot be rendered with markdown; the answer must be split by hand | the component owns the paragraph, not the marker | closed | the component is the marker and its card; text is the consumer's; give a pure helper that splits a string at ranges |
| AI Elements | [#42](https://github.com/vercel/ai-elements/issues/42) | no documentation for citations with Streamdown | integration undocumented | closed | docs page with a markdown renderer recipe |
| Streamdown | [#23](https://github.com/vercel/streamdown/issues/23) (title only), [#564](https://github.com/vercel/streamdown/issues/564), [#178](https://github.com/vercel/streamdown/issues/178), [#149](https://github.com/vercel/streamdown/issues/149) (title only) | footnote and reference links do nothing or are blocked | #564: `user-content-` id prefix applied twice, so `href` and target `id` differ | closed | markers that point at a list entry resolve ids in one place; test that the target id equals the href fragment |
| assistant-ui | [#6901](https://github.com/assistant-ui/assistant-ui/issues/6901) | the literal "undefined" is appended to the answer | Anthropic's `citations_delta` arrives as a block with `citations` and no `text`; the adapter concatenates `text` | closed | a citation delta is data, not text; the adapter's job, but the types say `text` may be absent |
| assistant-ui | [#3032](https://github.com/assistant-ui/assistant-ui/issues/3032) | request for inline citations in message primitives | not shipped then | closed | the demand is for a marker inside prose, not a block |
| prompt-kit | `source.tsx` (source, no issue) | the favicon is requested from `google.com/s2/favicons` with the source page's URL; `alt="favicon"`; the card is one link | design | open | no third-party requests from the component; decorative images have `alt=""`; links in the card are separate |
| assistant-ui | `inline-citation.tsx` (source) | the date is always formatted for `en-US` | hard-coded locale | open | `Intl` with the component's `lang` |
| assistant-ui | [#9404](https://github.com/assistant-ui/assistant-ui/issues/9404) (title only) | the generative-UI Citation accepts strings only in its text props | typing | closed | text props accept nodes |
| Base UI | [#5583](https://github.com/mui/base-ui/issues/5583) (title), [#4170](https://github.com/mui/base-ui/issues/4170) | the preview card is not accessible to keyboard, screen reader or touch users; no a11y note in the docs | visual-only design | open / closed | keyboard parity and a named dialog (hover-card.md); the usage rule |
| Base UI | [#4778](https://github.com/mui/base-ui/issues/4778) | "Touch support" for the preview card | pointer-only by design | closed | the answer for a non-link marker is press, not long press: `kind="button"` |
| Base UI | [#5122](https://github.com/mui/base-ui/issues/5122) (read), [#2064](https://github.com/mui/base-ui/issues/2064) (title) | an inline anchor that wraps over two lines is positioned to the wrong rectangle | positioning to the bounding box | open / closed | a marker is a short inline-block; a wrapped cited span is not the anchor |
| Radix, Reka (via hover-card.md) | RX#2692, RK#802, RX#2138 | tabbables in the card forced to `tabindex=-1`; a link with a card cannot be tapped on mobile; the card opens when a popover focuses its trigger | pointer-only design; `preventDefault` on `touchstart`; any focus opens | closed | card content is keyboard-reachable; touch is never prevented; layer-initiated focus never opens |

## Accessibility decisions

- **The marker is a link when there is a URL and a button when there is not.** `<a href>` for a
  source with a safe `http:` or `https:` URL (Enter follows it: the OpenAI requirement of "visible
  and clickable"); `<button type="button">` for a document source or a source without a URL
  (press toggles the preview, see below). Never a `span`. A URL with any other scheme
  (`javascript:`, `data:`) or one that does not parse is treated as no URL (assistant-ui's test
  names the same rule).
- **Name**: visible text is the index (`1`) or the consumer's chip content; the accessible name
  is `Source {index}: {title}` from `messages.marker` (assistant-ui's form), which contains the
  visible text (2.5.3). The brackets of `[1]` are CSS or `aria-hidden` text, not read as "left
  bracket". The title is the source's, with `lang` when it differs from the answer's.
  With several sources behind one marker the name is "{n} sources: {first title} and {k} more".
- **Disclosure state**: the trigger has `aria-haspopup="dialog"`, `aria-expanded` and
  `aria-controls` while the card is mounted (hover-card.md). A link with `aria-expanded` is the
  hover-card decision applied unchanged.
- **Opening**: pointer rest (pointer type not touch, rule 20) and **keyboard focus** (keyboard
  modality) after the delay open a preview; the virtual cursor does not open it (cause C); Escape
  closes it and focus stays on the marker; Tab moves into the card through `non-modal-tab-order`
  and out of it to the element after the marker; no initial focus.
- **Pinning**: a `button` marker, and a `link` marker pressed with the pointer **on a
  device with a coarse primary pointer and no hover**, does not follow anything and toggles a
  **pinned** state (the card stays until Escape, an outside press, focus leaving both, or the
  marker is pressed again). This answers the hover-card open question "long press for Citation":
  no long press (it replaces the platform's link menu); a press, because a button has no
  platform menu to replace. A link marker on touch follows the link (RK#802), and its preview is
  reached through the sources list.
- **Card semantics**: non-modal `dialog` named by the title through `aria-labelledby`
  (hover-card.md names it by the trigger by default; for a citation the title is better, and
  falls back to the marker's name). Title is a `p`, not a heading: a card that appears and
  disappears must not be in the heading outline (AI Elements renders an `h4`). The URL is shown
  as text and as the link's accessible name is the title; the snippet is a `blockquote`
  with `cite` when a URL exists. A link that opens a new tab says so in text (`messages.newTab`).
- **Nothing is announced.** No live region, no Announcer call: a citation appearing in a
  streaming answer is not news (accessibility.md §7.5: the completion announcement belongs to
  Streaming Message and may say "with 3 sources" through the consumer's `messages`).
- **The sources list is the accessible twin**, not decoration: a Collapsible disclosure "Used 3
  sources" followed by an ordered list of links, with the same `Source` parts as the card. A
  marker carries `aria-details` pointing to its list entry when that entry is in the DOM (not a
  closed collapsed panel; open question on AT support). Each list entry has an `id` the marker
  can link to; activating a marker with the keyboard on a document source can also move focus
  to the entry (`behavior: "reveal"`, consumer's choice).
- **Streaming**: a marker that arrives before its source (the model wrote `[2]`, the list comes at
  the end) renders as `data-state="pending"`: plain text, not a link, not a button, not
  focusable, no card; it upgrades in place when the source resolves, and keeps its open state.
  No marker opens by itself and none takes focus.
- **Nested interactive content**: a marker inside a link or a button is invalid HTML (nested
  interactive content); the component warns in development and the markdown recipe lifts it out.
- **Forced colors, size and motion**: the marker has a visible border or underline in forced
  colors (a background alone disappears); an inline marker needs no 24 px target (2.5.8 inline
  exception), a chip does; focus ring at 2 px; presence waits for running animations only;
  reduced motion removes the scale transition (assistant-ui does with `motion-reduce`).
- **Untrusted text**: title, URL and snippet come from a model or the web; they are rendered as
  text, never as HTML, with `overflow-wrap: anywhere` for long URLs; the favicon or image is the
  consumer's (`img` with `alt=""`), and a favicon request to a third party tells that party which
  sites the user is reading (prompt-kit's `source.tsx` builds exactly such a request to
  `www.google.com/s2/favicons`), so the component never fetches one.

## Testing notes

- Machine in Node: hover and focus open after the delay, leave and blur close, press pins, Escape
  and outside press unpin, layer-initiated focus never opens, `pending` upgrade keeps the state,
  controlled `open`; the delay group (second marker opens without delay within the window).
- Model-based: every event in every state; invariants "a pinned card is open", "`pending`
  renders no interactive element", "`aria-expanded` equals the open state".
- Pure: `safeHref` and `hostOf` (schemes, relative, empty, whitespace, very long, IDN),
  `splitByCitations(text, citations)` (ranges adjacent, overlapping, empty, out of range, a range
  inside a surrogate pair), message formatting.
- Browser (three engines): Tab to a marker opens after the delay and not when tabbing quickly;
  Escape returns focus to the marker; Tab enters the card and leaves to the next element; a
  marker in the middle of wrapped text and at the end of a line; the card never covers the focused
  marker (2.4.11); touch emulation: a link marker follows, a button marker pins; axe with the card
  open, pinned, pending, invalid URL, long title, RTL title; zoom 200% and a 320 px viewport.
- Manual AT: VoiceOver and NVDA read the marker's name and "collapsed / expanded" state;
  `aria-details` and DPUB roles on tier-1 AT.

## Decisions for `add-citation`

- **One component, not a hover card plus glue.** `Citation` composes the hover-card machine and
  adds a `pinned` state; it does not copy it (open/closed: a new behaviour is a new state). The
  Sources list is a documented composition of Collapsible and the shared `Source` parts, not a
  second machine.
- **Parts**: `Root` (the machine; no element), `Trigger` (`a` or `button`, chosen by the
  source), `Label` (the visible text, optional), `Positioner`, `Content` (`role="dialog"`),
  `Arrow`, `Source` (a group: title, URL, snippet, link; used in the card and in the list),
  `SourceTitle`, `SourceUrl`, `SourceSnippet`, `SourceLink`, `CitedText` (optional wrapper for the
  cited words; `data-state` follows the card, replacing AI Elements' `group-hover`). `Portal` is the
  shared part.
- **Machine** `citation`: states `closed | opening | open | closing | pinned`. Events (the
  hover-card set): `HOVER.START`, `HOVER.END`, `FOCUS`, `BLUR`, `CLOSE { reason }`, plus
  `PRESS { modality }` (toggles `pinned` for a `button`; no-op for a link unless the primary
  pointer is coarse), `PIN`, `UNPIN`, `SOURCE.CHANGE` (pending to resolved), `POSITION.*`.
  Effects while open or pinned: `layer` (non-modal), `hoverIntent` (not while pinned),
  `nonModalTabOrder`, `trackPosition`.
- **Props**: `source` (`{ id, title, url?, snippet?, domain?, publishedAt?, lang?, mediaType? }`) or
  `sources` (array, several behind one marker), `index` (the number the marker shows; the
  consumer's, no registry by mount order: CopilotKit #7695 in tool-call.md), `open`,
  `defaultOpen`, `onOpenChange(open, details)`, `openDelay` (300), `closeDelay` (200),
  `target` (`"_self"` default), `positioning`, `messages`, `lang`, `pending` (derived from a
  missing source, also a prop). The URL policy is a pure function `safeHref(url, { schemes })`.
- **`data-*`**: `data-scope="citation"`; Trigger `data-state` (`closed | open | pinned |
  pending`), `data-kind` (`link | button`), `data-hover`, `data-focus`, `data-focus-visible`,
  `data-pinned`, `data-invalid-url`; Positioner and Content `data-state`, `data-side`,
  `data-align`, `data-count`; Source `data-index`; CitedText `data-state`.
- **Contract** (`citationContract`): locate the marker by role `link` or `button` and name
  ("Source 1: …"), else the nth marker in the target; actions `show`, `hide`, `press`,
  `pressEscape`, `pressOutside`, `tab`, `shiftTab`, `follow`, `waitForUnmount`; queries `isOpen`,
  `isPinned`, `kind`, `href`, `source` (title, url, snippet), `sources`, `hasFocus`, `isTopmost`,
  plus the positioning fragment. Env: `setHoverCapability(coarse | fine)` for the press rule.
  Traits `layer`, `presence`, `anchored`, `restores-focus`.
- **Pure helper in `core/ai`**: `splitByCitations(text, citations)` returns an array of text and
  marker segments from character ranges (the AI SDK and OpenAI shape), with UTF-16 offsets
  documented; `safeHref`; `domainOf`. No markdown parsing. The Streamdown / react-markdown recipe
  goes in the docs.
- **Reuse**: hover-card machine and its `hover-intent`, `non-modal-tab-order`, layer, presence,
  floating positioning; the tooltip `delay-group` (adjacent markers open without the delay
  inside the group window: AI Elements and assistant-ui use no delay at all and prompt-kit 150 ms, which opens the
  card for every pointer pass); Collapsible for the list; Link behaviour of `dom/link`; `Intl`.
- **Deliberately different**: marker is a real link or button (AI Elements' span); card is
  keyboard-reachable and keeps its open state when a source resolves late; touch has a defined
  path (a pinned button, a followed link plus the list) rather than none (Base UI #4778); no
  carousel (a list, no extra controls and no `n/m` text); no announcement; no fetching;
  `Intl` and `messages` instead of fixed English and `en-US`; a delay group where hover-card has
  none, because markers cluster.
- **Non-goals**: parsing markdown or model text into markers; fetching titles, favicons or page
  previews; opening a document at a page or highlighting the cited passage in a PDF (Anthropic's
  `page_location`; the consumer's viewer); citation styles (APA, MLA); the sources panel or a
  side-by-side layout; the retrieval or the model; deduplicating sources (the consumer assigns
  `index`).

## Open questions

- **DPUB roles and `aria-details`.** Is `doc-noteref` / `doc-biblioref` on the marker spoken
  usefully by VoiceOver, NVDA and JAWS, or only noise? Same for `aria-details` pointing at the
  list entry. Default: neither is emitted; `role` and `aria-details` are pass-through until a
  tier-1 AT pass.
- **Open delay.** 300 / 200 with a delay group is a guess between hover-card's 700 / 300 and
  the kits' 0 / 0. No data found on citation hover timing.
- **Touch for a link marker.** Follow-only plus the list, or a first tap that previews and a second
  that follows (a pattern that breaks on assistive technology). Assumed follow-only.
- **Offset units.** The AI SDK's `startIndex` / `endIndex` unit is not stated in what was read, and
  OpenAI's were not stated at all; the helper uses UTF-16 code units and a test with surrogate
  pairs. Anthropic's `char_location` indexes are document offsets, not answer offsets.
- **Late sources.** A marker whose source arrives after the text (`pending`): the upgrade
  announces nothing; is that enough for a screen-reader user who already read "1"?
- **Several sources per marker**: one marker with a list in one card (assumed), or several adjacent
  markers `[1][2]`; AI Elements merges with "+N" and a carousel.
- **`target="_blank"` default.** Both kits open sources in a new tab; the safe default for an
  answer the user is still reading is a new tab, which costs the back button. The component
  defaults to `_self` and the docs recommend `_blank`; revisit with the docs examples.
- **Markers inside links, headings and tables** (nested interactive content): the component warns;
  whether to render a non-interactive marker plus the list entry in those places.
