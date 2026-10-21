// The Skin: a WebGL membrane, the one thing rind does not ship (the look). Its material follows
// the site's phase: crisp is faceted and hard, outlined in ink with an offset shadow; juicy is
// inflated and smooth, lit like a balloon. Decorative only; skin-scene.tsx decides whether it runs.
import { Camera, Mesh, Program, Renderer, Sphere, Transform, Vec3 } from "ogl"

const NOISE = /* glsl */ `
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
// 3D simplex noise (Ashima Arts, MIT)
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y +
    vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}`

const VERTEX = /* glsl */ `#version 300 es
in vec3 position;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform float uTime;
uniform float uPhase;
uniform float uMode;
uniform float uOutline;
uniform vec2 uOffset;
uniform vec3 uPointer;
out vec3 vView;
out vec3 vNormal;
${NOISE}
void main() {
  vec3 p = normalize(position);
  // crisp: sharper, slower folds; juicy: a soft swell, pumped up a little
  float crisp = snoise(p * 1.1 + vec3(0.0, 0.0, uTime * 0.12)) * 0.15;
  float juicy = snoise(p * 0.85 + vec3(uTime * 0.09)) * 0.1 + 0.07;
  vec3 pos = p * (1.0 + mix(crisp, juicy, uPhase));
  // the outline is the same body, pushed out along its normal and drawn from the inside
  if (uMode > 0.5 && uMode < 1.5) pos += p * uOutline;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  // the pointer presses the membrane: a dent that follows it, in view space
  vec2 toward = mv.xy - uPointer.xy;
  float press = exp(-dot(toward, toward) * 3.0) * uPointer.z;
  mv.xyz -= vec3(0.0, 0.0, press * 0.35);
  // the shadow copy slides off in view space, like the site's offset shadows
  // and sits behind the body, so it never draws over it
  if (uMode > 1.5) mv.xyz += vec3(uOffset, -0.6);
  vView = mv.xyz;
  vNormal = normalMatrix * p;
  gl_Position = projectionMatrix * mv;
}`

const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
uniform float uPhase;
uniform float uMode;
uniform vec3 uFill;
uniform vec3 uInk;
uniform vec3 uSoft;
uniform vec3 uLight;
in vec3 vView;
in vec3 vNormal;
out vec4 color;
void main() {
  if (uMode > 1.5) { color = vec4(mix(uInk, uSoft, uPhase), mix(1.0, 0.7, uPhase)); return; }
  if (uMode > 0.5) { color = vec4(uInk, 1.0 - uPhase); return; }
  // crisp shows its facets (flat normals), juicy hides them (the sphere's own normals)
  vec3 flatN = normalize(cross(dFdx(vView), dFdy(vView)));
  vec3 n = normalize(mix(flatN, normalize(vNormal), uPhase));
  vec3 L = normalize(vec3(-0.45, 0.75, 0.6));
  vec3 V = normalize(-vView);
  float ndl = dot(n, L);
  // crisp: three hard tones, like a sticker printed in flat ink
  vec3 crisp = mix(uFill * 0.62, uFill, step(-0.05, ndl));
  crisp = mix(crisp, mix(uFill, uLight, 0.35), step(0.62, ndl));
  // juicy: a soft gradient, a pale rim and one glossy highlight
  float rim = pow(1.0 - max(dot(n, V), 0.0), 2.5);
  float spec = pow(max(dot(reflect(-L, n), V), 0.0), 40.0);
  vec3 juicy = mix(uFill * 0.78, mix(uFill, uLight, 0.25), ndl * 0.5 + 0.5);
  juicy += rim * 0.35 * uLight + spec * 0.85;
  color = vec4(mix(crisp, juicy, uPhase), 1.0);
}`

type Rgb = [number, number, number]

/** A CSS hex colour as linear-ish 0–1 floats; anything else keeps the fallback. */
function hex(value: string, fallback: Rgb): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(value.trim())
  if (!m?.[1]) return fallback
  const n = Number.parseInt(m[1], 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** The palette the membrane wears, read from the phase's tokens (globals.css). */
function palette() {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string) => s.getPropertyValue(name)
  return {
    phase: document.documentElement.dataset["phase"] === "juicy" ? 1 : 0,
    fill: hex(v("--acc"), [1, 0.24, 0.55]),
    ink: hex(v("--ink"), [0.04, 0.04, 0.05]),
    soft: hex(v("--soft"), [0.79, 0.74, 0.95]),
    light: hex(v("--card"), [1, 1, 1]),
  }
}

/**
 * Mounts the membrane on `canvas`. Returns its teardown, or null when WebGL 2 is not available
 * (the page then stays as it is without it).
 */
export function mountSkin(
  canvas: HTMLCanvasElement,
  onFirstFrame: () => void,
): (() => void) | null {
  const renderer = new Renderer({
    canvas,
    alpha: true,
    premultipliedAlpha: false,
    antialias: true,
    dpr: Math.min(window.devicePixelRatio, 1.5),
    webgl: 2,
  })
  if (!renderer.isWebgl2) return null
  const gl = renderer.gl
  gl.clearColor(0, 0, 0, 0)

  const camera = new Camera(gl, { fov: 35 })
  camera.position.z = 6
  const scene = new Transform()
  const body = new Transform()
  body.setParent(scene)

  const start = palette()
  const uniforms = {
    uTime: { value: 0 },
    uPhase: { value: start.phase },
    uOutline: { value: 0.035 },
    uOffset: { value: [0.16, -0.16] },
    uPointer: { value: new Vec3(0, 0, 0) },
    uFill: { value: [...start.fill] },
    uInk: { value: [...start.ink] },
    uSoft: { value: [...start.soft] },
    uLight: { value: [...start.light] },
  }
  const geometry = new Sphere(gl, { radius: 1, widthSegments: 72 })
  // one geometry, three passes: the offset shadow, the ink outline, the membrane itself
  const pass = (mode: number, order: number, options: Record<string, unknown>) => {
    const program = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms: { ...uniforms, uMode: { value: mode } },
      ...options,
    })
    const mesh = new Mesh(gl, { geometry, program, renderOrder: order })
    mesh.setParent(body)
    return mesh
  }
  pass(2, 0, { transparent: true, depthWrite: false })
  pass(1, 1, { transparent: true, cullFace: gl.FRONT })
  pass(0, 2, {})

  // the target the colours and the phase ease towards
  let target = start
  const observer = new MutationObserver(() => {
    target = palette()
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-phase"],
  })

  let halfH = 1
  let halfW = 1
  // measured on the stage, not the canvas: setSize writes the canvas's own size inline
  const stage = canvas.parentElement ?? canvas
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = stage
    renderer.setSize(w, h)
    camera.perspective({ aspect: w / h })
    halfH = Math.tan((35 * Math.PI) / 360) * camera.position.z
    halfW = halfH * (w / h)
    const narrow = w / h < 0.9
    // beside the copy on wide screens, behind the specimens below it on narrow ones
    body.position.set(narrow ? 0 : halfW * 0.42, narrow ? -halfH * 0.35 : 0, 0)
    // on a phone the hero is tall: size by the width, or the membrane swallows the page
    body.scale.set(narrow ? halfW * 0.8 : halfH * 0.56)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(stage)
  resize()

  // pointer in view-space units at the membrane's depth; its press eases in and out
  let press = 0
  let pressTarget = 0
  const pointer = [0, 0]
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    pointer[0] = (((e.clientX - r.left) / r.width) * 2 - 1) * halfW
    pointer[1] = -(((e.clientY - r.top) / r.height) * 2 - 1) * halfH
    pressTarget = e.pointerType === "mouse" ? 1 : 0
  }
  const onLeave = () => {
    pressTarget = 0
  }
  window.addEventListener("pointermove", onMove, { passive: true })
  document.addEventListener("pointerleave", onLeave)

  // render only while the canvas is on screen and the tab is visible
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

  const ease = (value: number[], to: Rgb, k: number) => {
    for (let i = 0; i < 3; i++) value[i] = (value[i] ?? 0) + ((to[i] ?? 0) - (value[i] ?? 0)) * k
  }
  let raf = 0
  let first = true
  let last = performance.now()
  function frame(now: number) {
    raf = 0
    if (!visible || document.hidden || lost) return
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    uniforms.uTime.value += dt
    // the phase eases over about a second: the switch visibly re-dresses the membrane
    const k = 1 - Math.exp(-dt * 4)
    uniforms.uPhase.value += (target.phase - uniforms.uPhase.value) * k
    ease(uniforms.uFill.value, target.fill, k)
    ease(uniforms.uInk.value, target.ink, k)
    ease(uniforms.uSoft.value, target.soft, k)
    ease(uniforms.uLight.value, target.light, k)
    const p = uniforms.uPhase.value
    uniforms.uOutline.value = 0.035 * (1 - p)
    uniforms.uOffset.value = [0.16 * (1 - p), -0.16 - 0.06 * p]
    press += (pressTarget - press) * (1 - Math.exp(-dt * 6))
    uniforms.uPointer.value.set(pointer[0] ?? 0, pointer[1] ?? 0, press)
    // crisp turns in steps of a slow tick, juicy drifts
    body.rotation.y += dt * (0.18 - 0.06 * p)
    body.rotation.x = Math.sin(uniforms.uTime.value * 0.3) * 0.25
    renderer.render({ scene, camera })
    if (first) {
      first = false
      onFirstFrame()
    }
    loop()
  }
  function loop() {
    if (!raf) raf = requestAnimationFrame(frame)
  }
  loop()

  return () => {
    cancelAnimationFrame(raf)
    observer.disconnect()
    ro.disconnect()
    io.disconnect()
    window.removeEventListener("pointermove", onMove)
    document.removeEventListener("pointerleave", onLeave)
    document.removeEventListener("visibilitychange", onVisibility)
    canvas.removeEventListener("webglcontextlost", onLost)
    gl.getExtension("WEBGL_lose_context")?.loseContext()
  }
}
