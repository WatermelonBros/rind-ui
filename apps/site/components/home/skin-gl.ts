// The Skin: one of rind's own components (a Switch, a Checkbox or a Button, a different one per
// visit) built in 3D and wearing the site's look. Crisp is hard, bevelled and outlined in ink
// with an offset shadow; juicy inflates it into a soft balloon. Scrolling peels the skin off
// along a plane: underneath is the bare component (the browser's look) and its skeleton, drawn
// as contour lines of its distance field. One fragment shader raymarches the scene.
// Decorative only: the real component sits under it (skin-scene.tsx).
import { Mesh, Program, Renderer, Triangle } from "ogl"
import { zoom } from "../zoom"

const VERTEX = /* glsl */ `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`

const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 color;

uniform vec2 uRes;      // canvas size in pixels
uniform vec2 uCenter;   // the component's centre, in canvas pixels from the bottom left
uniform float uSize;    // its half width, in canvas pixels
uniform float uAspect;  // its width / height
uniform float uKind;    // 0 switch, 1 checkbox, 2 button, 3 avatar
uniform float uPress;   // 0 to 1: the button held down
uniform float uAlpha;   // the whole object's opacity (a phone dissolves it mid-flight)
uniform float uCustom;  // 0 to 1: how much it wears the visitor's skin from the builder
uniform vec3 uBrand;    // the builder's brand colour
uniform vec3 uSurface;  // the builder's surface colour
uniform vec3 uAccent;   // the builder's accent (a gradient's end)
uniform float uRound;   // the builder's radius, 0 square to 1 round
uniform float uOutline; // the builder's border, in canvas pixels (an outline round the object)
uniform float uMat;     // the builder's shadow, as a material: 0 flat 1 soft 2 hard 3 glow 4 bevel 5 clay
uniform float uFill;    // the builder's fill: 0 solid 1 gradient 2 glass 3 outline
uniform float uPhase;   // 0 crisp, 1 juicy
uniform float uChecked; // 0 to 1, sprung by the script (it overshoots in juicy)
uniform float uPeel;    // 0 skin on, 1 skin off
uniform vec2 uTilt;     // pointer tilt, radians
uniform float uTime;
uniform vec3 uInk;
uniform vec3 uAcc;
uniform vec3 uOn;
uniform vec3 uCard;
uniform vec3 uSoft;

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// How soft the object is, 0 hard (crisp) to 1 inflated (juicy): the page's phase, or, as far as
// it wears the visitor's skin, the material their shadow names (main sets it before the march)
float PH;
float materialSoftness(float m) {
  return m < 0.5 ? 0.35 : m < 1.5 ? 1.0 : m < 2.5 ? 0.0 : m < 3.5 ? 0.8 : m < 4.5 ? 0.0 : 1.0;
}
// the corner radius the builder asks for, from a square corner to fully round, as far as worn
float shaped(float own, float square, float round) {
  return mix(own, mix(square, round, uRound), uCustom);
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// a 2D rounded rectangle, then pulled out along z with a bevel of radius e
float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float extrude(float d2, float z, float depth, float e) {
  vec2 w = vec2(d2 + e, abs(z) - depth + e);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - e;
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0));
}
// a stroke from a to b drawn up to fraction f (0 hides it; so does a sliver: the state's spring
// settles a hair above 0, and a stroke that short drew a stray dot on an unchecked box)
float stroke(vec2 p, vec2 a, vec2 b, float f) {
  return f <= 0.04 ? 1e3 : sdSegment(p, a, mix(a, b, clamp(f, 0.0, 1.0)));
}

// crisp is a solid slab with rounded edges (the bevel is what catches the cel bands), juicy a
// soft pillow
// a small crisp object gets a deeper slab, so its side still shows a few pixels at builder and
// test sizes (uSize is its half width in pixels)
float bodyDepth() {
  float small = 1.0 - smoothstep(60.0, 200.0, uSize);
  return mix(mix(0.22, 0.36, small), 0.26, PH);
}
float bevel(float depth) { return mix(0.1, depth * 0.95, PH); }
// a mark (thumb, check, arrow) lying on the body's face: a raised stroke or a sunk-in ball
float onFace(float d2, vec3 p, float depth) {
  return extrude(d2, p.z - depth - mix(0.06, -0.02, PH), mix(0.08, 0.07, PH), 0.03);
}

// The avatar (the 404's 0): an Avatar's round frame with a well in its face where the picture
// sits, and in the well a bust (a head on shoulders, cut to the well) whose face is alive: the
// eyes follow the pointer and blink every few seconds; the mouth is lost (a crooked line) and,
// while touched (uChecked), surprised (a small o). A status dot sits on the rim.
// .y: 0 frame, 1 the bust, 2 the face's features, 3 the status dot
vec2 mapAvatar(vec3 p, float depth, float swell) {
  float frame = extrude(length(p.xy) - (0.9 + swell), p.z, depth, bevel(depth));
  float well = extrude(length(p.xy) - 0.74, p.z - depth, 0.14, 0.04);
  frame = max(frame, -well);
  float floor_ = depth - 0.12;
  // scaled spheres: each distance divided by its largest scale, so the march never overshoots
  float head = (length((p - vec3(0.0, 0.14, floor_)) * vec3(1.0, 0.95, 1.25)) - 0.3) / 1.25;
  float shoulders = (length((p - vec3(0.0, -0.66, floor_ - 0.04)) * vec3(0.9, 1.45, 2.2)) - 0.5) / 2.2;
  float bust = smin(head, max(shoulders, length(p.xy) - 0.72), 0.06);
  float front = floor_ + 0.23;
  vec2 g = clamp(vec2(-uTilt.x, uTilt.y) * 0.4, -0.05, 0.05);
  float open_ = 1.0 - 0.92 * smoothstep(0.0, 0.025, 0.025 - abs(fract(uTime * 0.23) - 0.5));
  vec3 e = vec3(abs(p.x - g.x) - 0.11, (p.y - g.y - 0.18) / open_, p.z - front);
  float eyes = (length(e) - (0.045 + 0.018 * uChecked)) * open_;
  // lost: a small frown (the top half of a circle); surprised: an open mouth, a dark oval
  vec2 m = p.xy - vec2(0.0, -0.03);
  float arc = m.y > 0.0 ? abs(length(m) - 0.07)
    : min(length(m - vec2(0.07, 0.0)), length(m + vec2(0.07, 0.0)));
  float lost = length(vec2(arc, p.z - front + 0.02)) - 0.022;
  vec3 r = vec3(0.05, 0.065, 0.03);
  float wow = (length((p - vec3(0.0, 0.0, front - 0.015)) / r) - 1.0) * 0.03;
  float face = min(eyes, mix(lost, wow, uChecked));
  // the status dot: online green, standing out of the rim
  float dot_ = length(p - vec3(0.63, -0.63, depth * 0.8)) - 0.18;
  float d = min(min(frame, bust), min(face, dot_));
  return vec2(d, dot_ <= d + 1e-5 ? 3.0 : face <= d + 1e-5 ? 2.0 : bust <= d + 1e-5 ? 1.0 : 0.0);
}

// .x distance, .y part (0 body, 1 mark)
vec2 map(vec3 p) {
  float swell = PH * (0.02 * sin(uTime * 1.6) + 0.04);
  float depth = bodyDepth() + swell;
  if (uKind > 2.5) return mapAvatar(p, depth, swell);
  float body;
  float mark;
  float foot = 1e3;
  // a squashed space stretches the field: divide it back, or the march steps through the surface
  float squash = 1.0;
  if (uKind < 0.5) {
    // Switch: a pill track; crisp lays a disc on it, juicy sinks a ball into it
    float h = 0.46 + swell;
    foot = sdRoundRect(p.xy, vec2(1.0 + swell, h), shaped(h, h * 0.12, h));
    body = extrude(foot, p.z, depth, bevel(depth));
    float travel = mix(0.54, 0.52, PH);
    vec3 t = p - vec3(mix(-travel, travel, uChecked), 0.0, depth + mix(0.05, -0.02, PH));
    float moving = clamp(uChecked * (1.0 - uChecked) * 4.0, 0.0, 1.0);
    t.x /= 1.0 + 0.3 * moving * PH;
    float r = mix(0.34, 0.36, PH);
    mark = mix(extrude(length(t.xy) - r, t.z, 0.1, 0.06), length(t * vec3(1.0, 1.0, 1.15)) - r, PH);
  } else if (uKind < 1.5) {
    // Checkbox: a rounded square; the check draws itself along its two strokes
    float half_ = 0.86 + swell;
    foot = sdRoundRect(p.xy, vec2(half_), shaped(mix(0.16, 0.36, PH), 0.05, 0.62));
    body = extrude(foot, p.z, depth, bevel(depth));
    vec2 a = vec2(-0.42, -0.02), b = vec2(-0.12, -0.32), c = vec2(0.44, 0.32);
    float l1 = length(b - a), l2 = length(c - b);
    float f = uChecked * (l1 + l2);
    float check = min(stroke(p.xy, a, b, f / l1), stroke(p.xy, b, c, (f - l1) / l2)) - 0.11;
    mark = onFace(check, p, depth);
  } else if (uKind < 2.5) {
    // Button: a pill that sinks into its own shadow when pressed (crisp) or squashes (juicy)
    p.xy -= vec2(0.092, -0.092) * uPress * (1.0 - PH);
    squash = 1.0 + 0.5 * uPress * PH;
    p.z *= squash;
    float h = 0.4 + swell;
    foot = sdRoundRect(p.xy, vec2(1.0 + swell, h), shaped(h, h * 0.12, h));
    body = extrude(foot, p.z, depth, bevel(depth));
    vec2 tip = vec2(0.3, 0.0);
    float arrow = min(sdSegment(p.xy, vec2(-0.32, 0.0), tip),
      min(sdSegment(p.xy, vec2(0.08, 0.2), tip), sdSegment(p.xy, vec2(0.08, -0.2), tip))) - 0.075;
    mark = onFace(arrow, p, depth);
  }
  float d = mix(min(body, mark), smin(body, mark, 0.08), PH) / squash;
  // the peel's curl: while the skin comes off, the part already lifted rolls back on itself
  // along the edge, a tube of skin standing off the face (inside the object's outline only)
  if (uPeel > 0.002 && uPeel < 0.998) {
    float e = dot(p.xy, normalize(vec2(1.0, 0.65))) - mix(1.7, -1.7, uPeel);
    float R = mix(0.1, 0.16, PH);
    float tube = abs(length(vec2(e - R * 0.6, p.z - depth - R * 0.9)) - R) - 0.022;
    tube = max(tube, foot - 0.01);
    if (tube < d) return vec2(tube, 4.0);
  }
  return vec2(d, mark < body ? 1.0 : 0.0);
}
vec3 normalAt(vec3 p) {
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(
    map(p + e.xyy).x - map(p - e.xyy).x,
    map(p + e.yxy).x - map(p - e.yxy).x,
    map(p + e.yyx).x - map(p - e.yyx).x));
}
// .x distance travelled (-1 on a miss), .y how close the ray came, .z part
vec3 march(vec3 ro, vec3 rd) {
  float t = 3.0;
  float closest = 1e3;
  for (int i = 0; i < 72; i++) {
    vec3 p = ro + rd * t;
    vec2 h = map(p);
    closest = min(closest, h.x);
    if (h.x < 0.0008) return vec3(t, 0.0, h.y);
    t += h.x;
    if (t > 8.0) break;
  }
  return vec3(-1.0, closest, 0.0);
}
void ray(vec2 frag, out vec3 ro, out vec3 rd) {
  vec2 q = (frag - uCenter) / uSize * 0.82;
  ro = vec3(0.0, 0.0, 5.0);
  rd = normalize(vec3(q / 4.0, -1.0));
  // crisp rests a little turned, so its thickness and bevel show; the pointer tilts from there
  float rest = 1.0 - PH;
  mat2 rx = rot(uTilt.y + 0.32 * rest), ry = rot(-uTilt.x - 0.26 * rest);
  ro.yz = rx * ro.yz; rd.yz = rx * rd.yz;
  ro.xz = ry * ro.xz; rd.xz = ry * rd.xz;
}

void main() {
  PH = mix(uPhase, materialSoftness(uMat), uCustom);
  vec2 frag = vUv * uRes;
  // outside the component's box (and its shadow) nothing can be hit: skip the march
  if (any(greaterThan(abs(frag - uCenter), vec2(uSize * 1.4, uSize / uAspect * 1.4 + uSize * 0.4)))) {
    color = vec4(0.0);
    return;
  }
  vec3 ro, rd;
  ray(frag, ro, rd);
  vec3 hit = march(ro, rd);

  if (hit.x < 0.0) {
    // crisp: an ink outline around the silhouette, and the silhouette again as a hard offset shadow;
    // juicy: no outline, a soft shadow below
    float px = mix(3.0, max(uOutline, 0.0), uCustom) / uSize;
    // the page's crisp draws one; a visitor's skin draws one as wide as its border, if any
    float drawn = mix(1.0 - PH, step(0.5, uOutline), uCustom);
    float outline = (1.0 - smoothstep(px * 0.5, px, hit.y)) * drawn * (1.0 - uPeel);
    // a pressed crisp button has sunk into its shadow: the shadow shrinks under it
    float sink = uKind > 1.5 ? 1.0 - uPress * (1.0 - PH) : 1.0;
    vec2 off = mix(vec2(0.09, -0.09) * sink, vec2(0.0, -0.12), PH) * uSize;
    vec3 sro, srd;
    ray(frag - off, sro, srd);
    vec3 sh = march(sro, srd);
    // the hard shadow's edge, anti-aliased over a pixel of the miss distance
    float hard = sh.x > 0.0 ? 1.0 : 1.0 - smoothstep(0.0, px * 0.5, sh.y);
    float soft = (1.0 - smoothstep(0.0, 0.3, sh.y)) * 0.6;
    // the shadow is part of the look: it comes off with the skin
    float shadow = mix(hard, soft, PH) * (1.0 - uPeel);
    vec3 c = outline > shadow ? uInk : mix(uInk, uSoft, PH);
    float a = max(outline, shadow);
    // the visitor's material: flat casts nothing, glow a halo of its brand
    if (uCustom > 0.0) {
      if (uMat < 0.5) a = mix(a, outline, uCustom);
      if (uMat > 2.5 && uMat < 3.5) {
        float halo = (1.0 - smoothstep(0.0, 0.45, hit.y)) * 0.75;
        c = mix(c, uBrand, uCustom);
        a = mix(a, max(outline, halo), uCustom);
      }
    }
    color = vec4(c, a * uAlpha);
    return;
  }

  vec3 p = ro + rd * hit.x;
  vec3 n = normalAt(p);
  vec3 L = normalize(vec3(-0.5, 0.7, 0.6));
  vec3 V = -rd;
  float ndl = dot(n, L);
  // the peel's curl (map: 4) is skin, rolled back
  bool isCurl = hit.z > 3.5;
  bool isMark = hit.z > 0.5 && !isCurl;
  // the avatar's eyes and mouth: ink on the picture, in both phases
  bool isFeature = hit.z > 1.5 && hit.z < 2.5;
  bool isStatus = hit.z > 2.5 && !isCurl;
  float on = smoothstep(0.3, 0.7, uChecked);

  // skinned: the page's own look. Body: card when off, ink (crisp) or pink (juicy) when on; a
  // button is always on. Mark: the switch's thumb is ink then acid (crisp) or white (juicy);
  // the check and the arrow are acid (crisp) or white (juicy).
  vec3 filled = mix(uInk, uAcc, PH);
  vec3 body = uKind > 1.5 ? filled : mix(uCard, filled, on);
  vec3 mark = uKind < 0.5 ? mix(mix(uInk, uOn, on), uCard, PH) : mix(uOn, uCard, PH);
  vec3 base = isStatus ? vec3(0.18, 0.76, 0.47) : isFeature ? uInk : isMark ? mark : body;
  float rim = pow(1.0 - max(dot(n, V), 0.0), 2.4);
  float spec = pow(max(dot(reflect(-L, n), V), 0.0), 40.0);
  // crisp is cel-shaded, not flat: hard bands (shadow, base, lit, top), a light bevel where the
  // face turns and a hard glint. The lit bands lighten towards white, so an ink body has depth
  // too. Each band edge is a narrow ramp: a hard step stair-steps along a curved rim
  float facing = abs(n.z);
  vec3 crisp = mix(base * 0.62, base, smoothstep(-0.17, -0.13, ndl));
  crisp = mix(crisp, mix(base, vec3(1.0), 0.16), smoothstep(0.33, 0.37, ndl));
  crisp = mix(crisp, mix(base, vec3(1.0), 0.42), smoothstep(0.83, 0.87, ndl));
  float bevel = smoothstep(0.3, 0.34, facing) * (1.0 - smoothstep(0.5, 0.54, facing))
    * smoothstep(0.1, 0.2, ndl);
  crisp = mix(crisp, mix(base, vec3(1.0), 0.55), bevel);
  // crisp's flat faces end in an ink edge, like the page's 3px borders
  // the side is its own face, a lifted ink catching a little light, so it does not fuse with the
  // ink outline into one blob
  vec3 side = mix(uInk, vec3(1.0), 0.13 + 0.12 * max(ndl, 0.0));
  crisp = mix(side, crisp, smoothstep(0.18, 0.3, facing));
  // the glint: small, and only on the top band (never a streak across the face)
  crisp = mix(crisp, vec3(1.0), smoothstep(0.7, 0.75, spec) * smoothstep(0.8, 0.86, ndl));
  vec3 juicy = mix(base * 0.82, base, ndl * 0.5 + 0.5) + rim * 0.2 + spec * 0.75;
  vec3 skin = mix(crisp, juicy, PH);

  // bare: the browser's own switch-ish grey, and the skeleton as blue contour lines
  // bare: no look at all. Neutral greys, a hairline where the faces turn, the state only as a
  // darker grey; the skeleton shows as faint contour lines
  vec3 bareBody = mix(vec3(0.9, 0.9, 0.91), vec3(0.7, 0.7, 0.73), uKind < 1.5 ? on : 0.0);
  vec3 bareMark = uKind < 0.5 ? vec3(0.98) : vec3(0.3, 0.3, 0.33);
  vec3 bare = (isFeature ? vec3(0.25) : isMark ? bareMark : bareBody) * (0.9 + 0.1 * max(ndl, 0.0));
  bare = mix(vec3(0.45, 0.45, 0.48), bare, smoothstep(0.08, 0.16, abs(n.z)));
  float lines = abs(fract(p.z * 10.0 + 0.5) - 0.5);
  bare = mix(bare, vec3(0.35, 0.4, 0.55), (1.0 - smoothstep(0.0, 0.05, lines)) * 0.25);

  // the peel: a straight edge sweeps from top right to bottom left. The lifted lip catches the
  // light, and the skin still on casts a short shadow onto the bare part beyond it
  float edge = dot(p.xy, normalize(vec2(1.0, 0.65))) - mix(1.7, -1.7, uPeel);
  float skinned = 1.0 - smoothstep(-0.008, 0.008, edge);
  float peeling = step(0.002, uPeel) * step(uPeel, 0.998);
  float lip = (1.0 - smoothstep(0.0, 0.07, abs(edge + 0.035))) * peeling;
  float dusk = (1.0 - smoothstep(0.0, 0.22, edge)) * step(0.0, edge) * peeling;
  // the visitor's skin, from the builder: brand where the component is on, surface elsewhere;
  // it is a skin like the site's, so the peel still lifts it off the skeleton
  // its fill: the brand, the brand running into the accent (gradient), or only an outline of it
  vec3 brand = uFill > 0.5 && uFill < 1.5
    ? mix(uBrand, uAccent, smoothstep(-0.9, 0.9, p.x - p.y * 0.4)) : uBrand;
  vec3 cBody = uKind > 1.5 ? brand : mix(uSurface, brand, on);
  if (uFill > 2.5) cBody = uSurface;
  vec3 cMark = uKind < 0.5 ? mix(brand, uSurface, on) : (uFill > 2.5 ? uBrand : uSurface);
  vec3 cb = isMark ? cMark : cBody;
  // and its material, from the builder's shadow
  float lam = max(ndl, 0.0);
  vec3 lit;
  if (uMat < 0.5) lit = cb * (0.94 + 0.06 * lam);
  else if (uMat < 1.5) lit = mix(cb * 0.8, cb, ndl * 0.5 + 0.5) + rim * 0.18 + spec * 0.55;
  else if (uMat < 2.5) {
    lit = mix(cb * 0.62, cb, smoothstep(-0.17, -0.13, ndl));
    lit = mix(lit, mix(cb, vec3(1.0), 0.18), smoothstep(0.33, 0.37, ndl));
    lit = mix(lit, mix(cb, vec3(1.0), 0.4), smoothstep(0.83, 0.87, ndl));
    lit = mix(side, lit, smoothstep(0.18, 0.3, facing));
  } else if (uMat < 3.5) lit = cb * (0.72 + 0.28 * lam) + uBrand * rim * 1.3 + spec * 0.4;
  else if (uMat < 4.5) {
    // bevelled: the faces as flat steps, light from the top left, dark below
    float step_ = floor((ndl * 0.5 + 0.5) * 4.0) / 4.0;
    lit = cb * (0.55 + 0.6 * step_);
    lit = mix(lit, mix(cb, vec3(1.0), 0.6), bevel);
  } else lit = cb * (0.78 + 0.22 * (ndl * 0.5 + 0.5)) * (0.86 + 0.14 * facing);
  // an outline fill's ring of the brand where the faces turn
  if (uFill > 2.5) lit = mix(lit, uBrand, smoothstep(0.5, 0.7, rim));
  // glass: a fresnel sheen, clear in the middle (alpha, below)
  if (uFill > 1.5 && uFill < 2.5) lit = mix(lit, vec3(1.0), rim * 0.55) + spec * 0.6;
  skin = mix(skin, lit, uCustom);
  vec3 c = mix(bare * (1.0 - 0.35 * dusk), skin, skinned);
  c = mix(c, mix(uCard, vec3(1.0), 0.5), lip * 0.9);
  // the curl is the skin's own back: paler, lit along its roll, darker where it turns under
  if (isCurl) c = mix(skin, vec3(1.0), 0.28) * (0.62 + 0.38 * lam) + spec * 0.35;
  float glass = uFill > 1.5 && uFill < 2.5 ? mix(1.0, mix(0.62, 1.0, rim), uCustom) : 1.0;

  color = vec4(c, uAlpha * glass);
}`

type Rgb = [number, number, number]

function hex(value: string, fallback: Rgb): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(value.trim())
  if (!m?.[1]) return fallback
  const n = Number.parseInt(m[1], 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** The phase's tokens (globals.css): the switch wears exactly what the page wears. */
function palette() {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string) => s.getPropertyValue(name)
  return {
    phase: document.documentElement.dataset["phase"] === "juicy" ? 1 : 0,
    ink: hex(v("--ink"), [0.04, 0.04, 0.05]),
    acc: hex(v("--acc"), [1, 0.24, 0.55]),
    on: hex(v("--on"), [0.83, 1, 0.23]),
    card: hex(v("--card"), [1, 1, 1]),
    soft: hex(v("--soft"), [0.79, 0.74, 0.95]),
  }
}

/** What of the builder's skin the object is rebuilt in, as wear() names it (skins.ts). */
export interface ObjectMaterial {
  readonly accent: string
  /** 0 to 28 px */
  readonly radius: number
  /** 0 to 4 px */
  readonly border: number
  readonly shadow: "flat" | "soft" | "hard" | "glow" | "bevel" | "clay"
  readonly fill: "solid" | "gradient" | "glass" | "outline"
}
const MATERIALS = ["flat", "soft", "hard", "glow", "bevel", "clay"] as const
const FILLS = ["solid", "gradient", "glass", "outline"] as const

/** The components the hero can show; the page picks one per visit (app/layout.tsx). */
export const KINDS = ["switch", "checkbox", "button"] as const
export type Kind = (typeof KINDS)[number]
/** What can be drawn: the hero's kinds, and the avatar (the 404's 0, lost-zero.tsx). */
export type Shape = Kind | "avatar"

export interface SkinHandle {
  /** Follows the real Switch or Checkbox it stands in for. */
  readonly setChecked: (checked: boolean) => void
  /** Follows the real Button: held down or not. */
  readonly setPress: (pressed: boolean) => void
  /** 0 skin on, 1 skin off; `now` skips the easing (an object in flight is never half-peeled). */
  readonly setPeel: (peel: number, now?: boolean) => void
  /** The page scrolled: draw again if the component was off screen. */
  readonly wake: () => void
  /** How much it wears the builder's skin (0 to 1), in the builder's two colours (hex). */
  readonly setLook: (brand: string, surface: string, amount: number) => void
  /** The rest of the builder's skin: the object is rebuilt in it (shape, outline, material). */
  readonly setMaterial: (m: ObjectMaterial) => void
  readonly dispose: () => void
}

/**
 * Mounts the component on `canvas` (fixed over the viewport), drawn wherever `rectAt` says.
 * Returns null when WebGL 2 is not available: the page keeps its plain version.
 */
export function mountSkin(
  canvas: HTMLCanvasElement,
  /** Where the component stands this frame, in viewport pixels (null: nowhere), and how opaque. */
  rectAt: () => DOMRect | null,
  kind: Shape,
  onFirstFrame: () => void,
  alphaAt: () => number,
  initial: { checked: boolean; peel: number },
): SkinHandle | null {
  const renderer = new Renderer({
    canvas,
    alpha: true,
    premultipliedAlpha: false,
    dpr: Math.min(window.devicePixelRatio, 1.5),
    webgl: 2,
  })
  if (!renderer.isWebgl2) return null
  const gl = renderer.gl
  // no GPU (a software rasteriser draws the raymarch on the CPU, 100 ms and more a frame, which
  // freezes the page: a machine without one, or a test lab's headless Chrome): the plain version
  const info = gl.getExtension("WEBGL_debug_renderer_info")
  const gpu = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
  if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu)) {
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    return null
  }
  gl.clearColor(0, 0, 0, 0)

  const start = palette()
  const u = {
    uRes: { value: [1, 1] },
    uCenter: { value: [0, 0] },
    uSize: { value: 100 },
    uAspect: { value: 2 },
    uKind: { value: kind === "avatar" ? 3 : KINDS.indexOf(kind) },
    uPress: { value: 0 },
    uAlpha: { value: 1 },
    uCustom: { value: 0 },
    uBrand: { value: [0.09, 0.09, 0.11] },
    uSurface: { value: [1, 1, 1] },
    uAccent: { value: [1, 0.56, 0.64] },
    uRound: { value: 0.5 },
    uOutline: { value: 3 },
    uMat: { value: 1 },
    uFill: { value: 0 },
    uPhase: { value: start.phase },
    uChecked: { value: 0 },
    uPeel: { value: 0 },
    uTilt: { value: [0, 0] },
    uTime: { value: 0 },
    uInk: { value: [...start.ink] },
    uAcc: { value: [...start.acc] },
    uOn: { value: [...start.on] },
    uCard: { value: [...start.card] },
    uSoft: { value: [...start.soft] },
  }
  const program = new Program(gl, {
    vertex: VERTEX,
    fragment: FRAGMENT,
    uniforms: u,
    transparent: true,
    depthTest: false,
  })
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program })

  let target = start
  const observer = new MutationObserver(() => {
    target = palette()
  })
  // the phase, or a skin worn on the page (wear.ts writes the tokens inline on <html>)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-phase", "style", "data-worn"],
  })

  // the canvas is fixed over the viewport; the component's rect comes from the page each frame,
  // so it can travel from one place on the page to another
  let present = true
  const place = () => {
    const s = canvas.getBoundingClientRect()
    // canvas pixels per viewport pixel: the device ratio, over the page's zoom (zoom.ts)
    const dpr = gl.canvas.width / Math.max(1, s.width)
    const a = rectAt()
    u.uAlpha.value = alphaAt()
    present = Boolean(a && a.bottom > -a.height && a.top < s.height + a.height)
    if (!a) return
    u.uCenter.value = [
      (a.left - s.left + a.width / 2) * dpr,
      (s.bottom - a.top - a.height / 2) * dpr,
    ]
    u.uSize.value = (a.width / 2) * dpr
    u.uAspect.value = a.width / Math.max(a.height, 1)
  }
  // the canvas covers the viewport: size it from the window (setSize writes its CSS size inline,
  // so measuring the element would freeze it at whatever it measured first)
  const resize = () => {
    // in the zoomed page's own pixels, so it still covers the viewport exactly (zoom.ts)
    const z = zoom()
    renderer.setSize(window.innerWidth / z, window.innerHeight / z)
    u.uRes.value = [gl.canvas.width, gl.canvas.height]
    place()
  }
  window.addEventListener("resize", resize)
  resize()

  const tilt = [0, 0]
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return
    tilt[0] = (e.clientX / window.innerWidth - 0.5) * 0.6
    tilt[1] = (e.clientY / window.innerHeight - 0.5) * 0.4
  }
  window.addEventListener("pointermove", onMove, { passive: true })

  let visible = true
  const io = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? false
    if (visible) loop()
  })
  io.observe(canvas)
  const onVisibility = () => {
    if (!document.hidden) loop()
  }
  document.addEventListener("visibilitychange", onVisibility)
  let lost = false
  const onLost = (e: Event) => {
    e.preventDefault()
    lost = true
  }
  canvas.addEventListener("webglcontextlost", onLost)

  // checked rides a spring: a hard snap in crisp, a bounce in juicy
  let checked = initial.checked ? 1 : 0
  let goal = checked
  let velocity = 0
  let peel = initial.peel
  let peelGoal = peel
  let press = 0
  let pressGoal = 0
  const ease = (value: number[], to: Rgb, k: number) => {
    for (let i = 0; i < 3; i++) value[i] = (value[i] ?? 0) + ((to[i] ?? 0) - (value[i] ?? 0)) * k
  }
  let raf = 0
  let asleep = false
  let slow = 0
  let first = true
  let last = performance.now()
  function frame(now: number) {
    raf = 0
    if (!visible || document.hidden || lost) return
    const raw = (now - last) / 1000
    const dt = Math.min(raw, 0.05)
    last = now
    // a slow GPU gets fewer pixels, not a stutter: drop the resolution while frames run long
    slow = slow * 0.95 + (raw > 0.024 ? 0.05 : 0)
    if (slow > 0.6 && renderer.dpr > 0.75) {
      renderer.dpr = Math.max(0.75, renderer.dpr - 0.5)
      slow = 0
      resize()
    }
    u.uTime.value += dt
    const k = 1 - Math.exp(-dt * 4)
    u.uPhase.value += (target.phase - u.uPhase.value) * k
    ease(u.uInk.value, target.ink, k)
    ease(u.uAcc.value, target.acc, k)
    ease(u.uOn.value, target.on, k)
    ease(u.uCard.value, target.card, k)
    ease(u.uSoft.value, target.soft, k)
    const stiffness = 600 - 380 * u.uPhase.value
    const damping = 44 - 32 * u.uPhase.value
    // fixed sub-steps: a slow frame (dt 50 ms) would make a stiff spring diverge
    for (let left = dt; left > 0; left -= 1 / 240) {
      const h = Math.min(left, 1 / 240)
      velocity += ((goal - checked) * stiffness - velocity * damping) * h
      checked += velocity * h
    }
    u.uChecked.value = checked
    // the peel takes about a second, so the edge is seen sweeping across
    peel += (peelGoal - peel) * (1 - Math.exp(-dt * 3.2))
    u.uPeel.value = peel
    press += (pressGoal - press) * (1 - Math.exp(-dt * 30))
    u.uPress.value = press
    const t = u.uTilt.value
    t[0] = (t[0] ?? 0) + ((tilt[0] ?? 0) - (t[0] ?? 0)) * k
    t[1] = (t[1] ?? 0) + ((tilt[1] ?? 0) - (t[1] ?? 0)) * k
    place()
    // off screen: clear once and sleep until the page scrolls it back (wake)
    if (!present) {
      gl.clear(gl.COLOR_BUFFER_BIT)
      asleep = true
      return
    }
    renderer.render({ scene: mesh })
    if (first) {
      first = false
      onFirstFrame()
    }
    loop()
  }
  function loop() {
    asleep = false
    if (!raf) raf = requestAnimationFrame(frame)
  }
  loop()

  return {
    setChecked: (value) => {
      goal = value ? 1 : 0
      loop()
    },
    setPress: (value) => {
      pressGoal = value ? 1 : 0
      loop()
    },
    setLook: (brand, surface, amount) => {
      u.uBrand.value = hex(brand, [0.09, 0.09, 0.11])
      u.uSurface.value = hex(surface, [1, 1, 1])
      u.uCustom.value = Math.min(1, Math.max(0, amount))
      loop()
    },
    setMaterial: (m) => {
      u.uAccent.value = hex(m.accent, [1, 0.56, 0.64])
      u.uRound.value = Math.min(1, m.radius / 22)
      // a border is a line round the object a little heavier than the component's, in proportion
      u.uOutline.value = m.border > 0 ? 2 + m.border * 1.5 : 0
      u.uMat.value = MATERIALS.indexOf(m.shadow)
      u.uFill.value = FILLS.indexOf(m.fill)
      loop()
    },
    wake: () => {
      if (asleep) loop()
    },
    setPeel: (value, now) => {
      peelGoal = Math.min(1, Math.max(0, value))
      if (now) {
        peel = peelGoal
        u.uPeel.value = peel
      }
      loop()
    },
    dispose: () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener("resize", resize)
      io.disconnect()
      window.removeEventListener("pointermove", onMove)
      document.removeEventListener("visibilitychange", onVisibility)
      canvas.removeEventListener("webglcontextlost", onLost)
      gl.getExtension("WEBGL_lose_context")?.loseContext()
    },
  }
}
