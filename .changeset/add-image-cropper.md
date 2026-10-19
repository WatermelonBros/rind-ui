---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Image Cropper: Ark's capabilities (crop in the viewport over an image placed by zoom, any-angle rotation, flip and pan; fixed crop area; aspect ratio, circle, min / max sizes; nudge steps 1 / 10 / 50; wheel and pinch zoom; the crop in natural pixels as a rect and a corner quad) with exact coverage (the image always covers the crop's corners, raising zoom when a rotation needs it), one focusable crop area that stays usable with a fixed area, one announcement per keyboard burst instead of a live root, and `cropImage(image, data)` with typed `CropError`s. Core: pure geometry, `core/dom/crop-gestures`, `core/dom/crop-image`. Contract env: the "+" and "-" keys. Testing: `getImageCropper`. Theme: `image-cropper.css`.
