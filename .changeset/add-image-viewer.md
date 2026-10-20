---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Image Viewer: zoom and pan an image in place. Ctrl-wheel, trackpad pinch (Safari's gesture events too), touch pinch and double click zoom about the pointer; drag pans; + / − / 0 and arrows on the focusable viewport; ZoomIn / ZoomOut / Reset buttons that keep focus at the limits. Every change is clamped (zoom limits, the image never leaves the view, no pinch overshoot); a plain wheel scrolls the page unless `wheel="zoom"`; the zoom is announced once per keyboard burst. Core: `image-viewer.geometry` (`clampPan`), `core/dom/zoom-gestures`. Contract env: the "0" key. Testing: `getImageViewer`. Theme: `image-viewer.css`.
