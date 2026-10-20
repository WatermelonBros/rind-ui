# Image Viewer — research

An image you can zoom and pan in place: a product photo, a diagram, a scan, a map. The input
side is where the trouble is:
- wheel, trackpad pinch (a ctrl-wheel in Chromium and Firefox, `gesture*` events in Safari),
  touch pinch, drag, double click;
- a keyboard and button route with the same reach (WCAG 2.5.7: no dragging-only action);
- the image never lost off-screen;
- a zoom level a screen reader can hear.

A lightbox (a gallery in a dialog) is a composition: Dialog + Carousel + this viewer.

None of the nine headless libraries ships it. Sources read (October 2026):
- react-zoom-pan-pinch (BetterTyped);
- yet-another-react-lightbox's Zoom plugin (`useZoomSensors.ts`);
- PhotoSwipe;
- Viewer.js;
- their trackers; rind-ui's Image Cropper (`core/dom/crop-gestures.ts`, `geometry.ts`).

## How the others built it

### react-zoom-pan-pinch

- A transform wrapper with `scale`, `positionX/Y`, `minScale`, `maxScale`, wheel / pinch /
  double click / pan options, `limitToBounds`, and controls (`zoomIn`, `zoomOut`,
  `resetTransform`, `centerView`).
- No keyboard support, no roles, no announcements.
- #543 (open): no wheel zoom while panning. #366 (open): controlled state is awkward. #371
  (open): breaks under shadow DOM. #385 (open): no pan inside an iframe on mobile.

### yet-another-react-lightbox (Zoom plugin)

- Keys:
  - `+` / `-`, and with the platform modifier `=` / `_`;
  - Ctrl+0 resets;
  - arrows pan by `keyboardMoveDistance` when zoomed.
- Wheel zooms only with Ctrl (the trackpad pinch) unless `scrollToZoom`; double click toggles.
- #380 (closed): zooming out by a fast pinch overshot, so the minimum was reached and then
  zoomed back in. #408, #407 (closed): zoom for custom slides.

### PhotoSwipe

- Lightbox with tap / double-tap / pinch zoom and pan bounds.
- #2184 (open): the dialog needs `aria-modal`, a name, and a counter that announces.
- #1717 (open): links need `role="button"`.
- #1914 (open): flicker when zooming on iOS.
- #2187 (open): `zoomTo` ignored the pan bounds.

### Viewer.js

- Toolbar (zoom, rotate, flip, reset), wheel and touch.
- #492 (closed): Safari's trackpad pinch (`gesturestart` / `gesturechange`) was not handled.
- #615 (closed): zooming from the toolbar used the wrong origin (it should be the centre).
- #663 (open): no reaction when the container is resized.

### rind-ui Image Cropper

Already solves the shared parts:
- an image box fitted in a viewport (`imageBox`) and one affine placement;
- zoom about a point (`zoomAt`);
- wheel and pinch handling (`cropGestures`), with `+` / `-` keys and a polite announcement
  after keyboard bursts.

## Accessibility

- **A named, focusable group** (`role="group"`, `aria-roledescription="image viewer"`), named
  by the image's alt, with instructions in `aria-describedby`: "Plus and minus zoom, arrows
  pan, 0 resets."
- **Zoom level spoken**: after a keyboard or button change, once per burst (polite): "Zoom
  200%". Never a live region that re-reads the image.
- **Buttons as the non-drag route** (WCAG 2.5.7): ZoomIn, ZoomOut and Reset are real buttons,
  disabled at the limits.
- **Pan reachable by keyboard** (arrows, Shift for bigger steps) when zoomed.
- **Reduced motion**: no animated zoom transitions.
- **Do not trap page scroll**: a plain wheel scrolls the page; only ctrl-wheel (the pinch)
  zooms, unless the consumer opts in (react-zoom-pan-pinch traps it by default).

## Bug history (the patterns)

- Pinch overshoot and rubber band at the limits (YARL #380, PhotoSwipe #1914): clamp each step
  in the model, never animate past the limits.
- Safari trackpad pinch missing (Viewer.js #492): handle `gesturestart` / `gesturechange`.
- Zoom origin wrong for buttons (Viewer.js #615): buttons zoom about the viewport centre, the
  wheel and pinch about the pointer.
- Bounds ignored by programmatic zoom (PhotoSwipe #2187): every change goes through one clamp.
- Container resize ignored (Viewer.js #663): a ResizeObserver refits.
- No wheel zoom while panning (react-zoom-pan-pinch #543): the wheel is handled during a drag.

## Decisions

1. **Machine**:
   - states `loading` / `idle` / `panning` (dragging) / `settling` (announcement debounce);
   - controllable `zoom` (1 = fit) and `offset`;
   - `minZoom` 1, `maxZoom` 4, `step` 0.5;
   - every change goes through `clamp`: the image covers the viewport when it is larger than
     it, else stays centred.
2. **Geometry** reuses the Image Cropper's `imageBox`, `zoomAt` and `apply`, with rotation
   0. Zooming about the pointer keeps the point under it.
3. **Gestures**:
   - in `core/dom/zoom-gestures.ts`: drag pans; ctrl-wheel and trackpad pinch zoom about the
     pointer, also during a drag; Safari `gesture*` events; two-finger touch pinch; double
     click toggles between fit and `doubleClickZoom` (2) about the point;
   - plain wheel scrolls the page unless `wheel="zoom"`;
   - ResizeObserver refits.
4. **Keys** on the viewport:
   - `+` / `=` zoom in and `-` zoom out, about the centre;
   - `0` resets;
   - arrows pan by 10% of the viewport, Shift by 50%, only when zoomed;
   - the arrows are not used when there is nothing to pan (the page scrolls).
5. **Parts**:
   - `Root`;
   - `Viewport`, the focusable group;
   - `Image`;
   - `ZoomIn`, `ZoomOut`, `Reset` (buttons);
   - `ZoomText` (the visible percentage).
6. **Announcement**: "Zoom 200%" after keyboard or button changes, debounced 500 ms (as in the
   Image Cropper).
