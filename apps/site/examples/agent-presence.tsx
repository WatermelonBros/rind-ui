"use client"

import type { AgentState } from "@rind-ui/core"
import { AgentPresence } from "@rind-ui/react"
import { useCallback, useRef, useState } from "react"
import type { States, Variants } from "./types"

export const states: States = { "agent-presence": { live: "Basic" } }

const STATES: readonly AgentState[] = [
  "idle",
  "connecting",
  "listening",
  "thinking",
  "speaking",
  "error",
]

/** A fake level: a slow swell plus noise, as a microphone would give. */
function useFakeLevel() {
  const t0 = useRef(Date.now())
  return () => {
    const t = (Date.now() - t0.current) / 1000
    return Math.min(1, Math.max(0, 0.45 + 0.35 * Math.sin(t * 3.1) + 0.2 * Math.sin(t * 11.7)))
  }
}

/*
 * The orb: Siri-like bands of light inside a glass ball, refracted at its rim. Ported to WebGL2
 * from the "Glass Liquid" Siri preset of github.com/LerSent001/orb (MIT, © LerSent001).
 */
const ORB_VERTEX = `#version 300 es
void main() {
  vec2 p = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0))[gl_VertexID];
  gl_Position = vec4(p, 0.0, 1.0);
}`

const ORB_FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform float uTime;     // the phase: time already multiplied by the speed
uniform float uAmp;      // wave height (the voice swells it)
uniform float uWarp;     // how far apart the coloured bands sit
uniform float uRidge;
uniform float uExposure;
uniform vec3 uA, uB, uC, uD, uHighlight;
out vec4 outColor;

const float RADIUS = 0.72;
const float ZOOM = 0.36;
const float SHADE = 0.12;
const float SHEEN = 0.28;
const float GLOSS = 0.24;
const float GLASS = 0.44;
const float SHELL_MID = 0.18;
const float SHELL_EDGE = 0.18;
const vec3 CANVAS = vec3(0.012, 0.016, 0.035);
const vec3 SHELL_INNER = vec3(1.0);
const vec3 SHELL_COOL = vec3(0.608, 0.957, 1.0);
const vec3 SHELL_WARM = vec3(0.773, 0.663, 1.0);
const vec3 SHEEN_COLOR = vec3(0.918, 0.957, 1.0);
const vec3 SPEC_COLOR = vec3(0.863, 0.918, 1.0);

vec2 band(vec2 q, float drift, float offset, float amp, float mainY, float env, float soft) {
  float y = amp * env * sin(q.x + drift + offset);
  float d = abs(q.y - y);
  float line = 0.018 / (sqrt(d * d + soft * soft) + 0.026);
  float bandD = max(0.0, max(q.y - max(mainY, y), min(mainY, y) - q.y));
  return vec2(line, 0.018 / (bandD + 0.075));
}

vec3 fluid(vec2 p, float t) {
  vec2 q = p / (0.74 + ZOOM * 0.34);
  float e = cos(1.57079633 * min(abs(0.9 * q.x), 1.0));
  float env = e * e;
  float low = 0.5 + 0.5 * cos(t * 0.37);
  float mid = 0.5 + 0.5 * sin(t * 0.51 + 1.2);
  float high = 0.5 + 0.5 * cos(t * 0.73 + 2.1);
  float drift = t * 2.4;
  float mainAmp = (0.25 + uRidge * 0.075 + low * 0.018) * uAmp;
  float bandAmp = mainAmp + (mid * 0.025 + high * 0.018) * uAmp;
  float mainY = mainAmp * env * sin(q.x * 1.1 + drift);
  float sep = 1.85 + uWarp * 0.2 + mid * 0.28;
  float soft = 0.035 + (1.0 - uRidge) * 0.018 + mid * 0.006;
  vec2 b0 = band(q, drift, -sep, bandAmp, mainY, env, soft);
  vec2 b1 = band(q, drift, -sep * 0.34, bandAmp, mainY, env, soft);
  vec2 b2 = band(q, drift, sep * 0.34, bandAmp, mainY, env, soft);
  vec2 b3 = band(q, drift, sep, bandAmp, mainY, env, soft);
  float w0 = b0.x + b0.y, w1 = b1.x + b1.y, w2 = b2.x + b2.y, w3 = b3.x + b3.y;
  float d0 = w0 * w0, d1 = w1 * w1, d2 = w2 * w2, d3 = w3 * w3;
  vec3 spectral = (uA * d0 + uC * d1 + uB * d2 + uD * d3) / max(d0 + d1 + d2 + d3, 0.0001);
  float energy = (1.0 - exp(-(w0 + w1 + w2 + w3) * 0.58)) * env;
  float md = abs(q.y - mainY);
  float core = exp(-md * md / 0.0028) * env;
  vec3 color = mix(uD, uB, smoothstep(-0.7, 0.7, q.y)) * 0.018 + spectral * energy * 1.14;
  color += uHighlight * core * (0.18 + 0.1 * low);
  color = color / (vec3(1.0) + color * 0.18);
  color = mix(color, uHighlight, SHADE * 0.22 * smoothstep(0.15, 1.15, dot(p, vec2(-0.32, 0.78))));
  color *= 1.0 - SHADE * 0.34 * smoothstep(-0.1, 1.2, dot(p, vec2(0.45, -0.62)));
  color *= 1.0 - SHADE * 0.22 * smoothstep(0.72, 1.08, length(p));
  return clamp(color, 0.0, 1.0);
}

vec3 over(vec3 dst, vec3 src, float a) {
  float k = clamp(a, 0.0, 1.0);
  return src * k + dst * (1.0 - k);
}

float lobe(vec2 n, vec2 dir, float cut, float power) {
  return pow(clamp((dot(n, dir) - cut) / max(1.0 - cut, 0.001), 0.0, 1.0), power);
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  float side = max(min(uSize.x, uSize.y), 1.0);
  vec2 uv = (2.0 * fc - uSize) / side;
  float r = length(uv);
  if (r > RADIUS * 1.01) { outColor = vec4(0.0); return; }
  float t = uTime;
  vec2 p = uv / RADIUS;
  float pd = length(p);
  vec2 n = r > 0.0001 ? uv / r : vec2(0.0);

  // the glass bends the light near its rim, each channel a little differently
  float clearFa = 1.0 - smoothstep(0.995, 1.04, pd);
  float edgeDepth = max(1.0 - pd, 0.0);
  float depth = clamp(edgeDepth / (0.015 + 0.95 * SHELL_MID), 0.0, 1.0);
  float profile = pow(1.0 - sqrt(max(1.0 - (1.0 - depth) * (1.0 - depth), 0.0)), 0.68);
  vec2 rp = p - n * 1.6 * GLASS * profile;
  float split = 0.14 * GLOSS * GLASS * profile;
  vec3 f = vec3(fluid(rp - n * split, t).r, fluid(rp, t).g, fluid(rp + n * split, t).b);
  float lum = dot(f, vec3(0.213, 0.715, 0.072));
  vec3 col = over(CANVAS, clamp(vec3(lum) + (f - vec3(lum)) * 1.22, 0.0, 1.0), 0.99 * clearFa);

  // the shell: an inner rim, cool and warm dispersion, a shadow and two highlights
  float shell = (1.0 - smoothstep(0.0, 0.026 + 0.055 * SHELL_EDGE, edgeDepth)) * clearFa;
  float rim = pow(shell, 1.8);
  col = over(col, SHELL_INNER, rim * GLASS * 0.45);
  float dispersion = rim * GLOSS * (0.8 + 0.8 * SHELL_EDGE);
  col = over(col, SHELL_COOL, dispersion * lobe(n, normalize(vec2(0.84, 0.54)), -0.32, 1.8));
  col = over(col, SHELL_WARM, dispersion * lobe(n, normalize(vec2(-0.62, -0.78)), -0.28, 2.0));
  col *= 1.0 - rim * (0.015 + 0.15 * SHELL_EDGE) * (0.15 + 0.85 * max(dot(n, vec2(0.45, -0.89)), 0.0));
  col = over(col, SHEEN_COLOR, rim * lobe(n, normalize(vec2(-0.68, 0.73)), 0.2, 2.8) * SHEEN * 1.4);
  col = over(col, SPEC_COLOR, rim * lobe(n, normalize(vec2(0.74, -0.67)), 0.4, 3.6) * SHEEN);

  float ball = 1.0 - smoothstep(0.99, 1.01, pd);
  col = clamp(col * uExposure, 0.0, 1.0) * ball;
  float alpha = clamp(max(ball, max(col.r, max(col.g, col.b))), 0.0, 1.0);
  outColor = vec4(col, alpha);
}`

type Rgb = readonly [number, number, number]
interface OrbLook {
  readonly speed: number
  readonly amp: number
  /** How much the audio level adds to the wave height and the exposure. */
  readonly gain: number
  readonly warp: number
  readonly ridge: number
  readonly exposure: number
  /** The four band colours, then the highlight. */
  readonly colors: readonly Rgb[]
}

const hex = (h: string): Rgb => {
  const n = Number.parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
const LIT = [
  hex("#ffd86b"),
  hex("#82f4ff"),
  hex("#ff7bd5"),
  hex("#8e6cff"),
  hex("#ffffff"),
] as const
const DIM = [
  hex("#b5a674"),
  hex("#5e8794"),
  hex("#9a648a"),
  hex("#635b8a"),
  hex("#b6c4d2"),
] as const
const COOL = [
  hex("#82f4ff"),
  hex("#6bb8ff"),
  hex("#5a7dff"),
  hex("#8e6cff"),
  hex("#e8fbff"),
] as const
const DEEP = [
  hex("#ff7bd5"),
  hex("#c58bff"),
  hex("#8e6cff"),
  hex("#6b4dff"),
  hex("#ffe6f7"),
] as const
const GREY = [
  hex("#6b6f7a"),
  hex("#7a8590"),
  hex("#6f6a78"),
  hex("#5a5866"),
  hex("#c4c8d0"),
] as const
const RED = [
  hex("#ff9f6b"),
  hex("#ff6b6b"),
  hex("#ff4d6d"),
  hex("#b3264a"),
  hex("#ffd0d0"),
] as const

/** Each state is a look; the orb eases from one to the next. */
const LOOKS: Record<AgentState, OrbLook> = {
  idle: { speed: 0.25, amp: 0.55, gain: 0, warp: 1.7, ridge: 0.24, exposure: 1.36, colors: DIM },
  connecting: { speed: 1.4, amp: 0.3, gain: 0, warp: 0.6, ridge: 0.1, exposure: 1.2, colors: GREY },
  listening: {
    speed: 0.6,
    amp: 0.55,
    gain: 1.6,
    warp: 1.6,
    ridge: 0.4,
    exposure: 1.7,
    colors: COOL,
  },
  thinking: { speed: 3, amp: 1.3, gain: 0, warp: 7, ridge: 0.5, exposure: 2, colors: DEEP },
  speaking: { speed: 0.9, amp: 1, gain: 2.6, warp: 3.2, ridge: 0.5, exposure: 2.2, colors: LIT },
  error: { speed: 0.1, amp: 0.25, gain: 0, warp: 1, ridge: 0.1, exposure: 1.4, colors: RED },
}

/**
 * Draws the orb in a canvas put inside AgentPresence.Visual. It reads the state from the
 * Visual's `data-state` and the smoothed level from the Root's `--rind-agent-presence-level`
 * each frame, so nothing re-renders; it pauses off-screen and stands still under reduced motion.
 */
function useShaderOrb() {
  return useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) return
    // ponytail: without WebGL2 the canvas stays blank; draw a CSS orb there if that matters
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true })
    if (!gl) return
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type) as WebGLShader
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      return shader
    }
    const program = gl.createProgram()
    gl.attachShader(program, compile(gl.VERTEX_SHADER, ORB_VERTEX))
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, ORB_FRAGMENT))
    gl.linkProgram(program)
    // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook
    gl.useProgram(program)
    const at = (name: string) => gl.getUniformLocation(program, name)
    const u = {
      size: at("uSize"),
      time: at("uTime"),
      amp: at("uAmp"),
      warp: at("uWarp"),
      ridge: at("uRidge"),
      exposure: at("uExposure"),
      colors: ["uA", "uB", "uC", "uD", "uHighlight"].map(at),
    }
    const visual = canvas.parentElement
    const root = canvas.closest<HTMLElement>('[data-scope="agent-presence"][data-part="root"]')
    const still = matchMedia("(prefers-reduced-motion: reduce)")
    let look: OrbLook = LOOKS.idle
    let phase = 0
    let last = performance.now()
    let visible = true
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
    })
    io.observe(canvas)
    let frame = requestAnimationFrame(function draw(now) {
      frame = requestAnimationFrame(draw)
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      if (!visible) return
      const target = LOOKS[(visual?.dataset["state"] as AgentState | undefined) ?? "idle"]
      const k = 1 - Math.exp(-dt / 0.25)
      const ease = (a: number, b: number) => a + (b - a) * k
      look = {
        speed: ease(look.speed, target.speed),
        amp: ease(look.amp, target.amp),
        gain: ease(look.gain, target.gain),
        warp: ease(look.warp, target.warp),
        ridge: ease(look.ridge, target.ridge),
        exposure: ease(look.exposure, target.exposure),
        colors: look.colors.map((c, i) => {
          const to = target.colors[i] as Rgb
          return [ease(c[0], to[0]), ease(c[1], to[1]), ease(c[2], to[2])] as const
        }),
      }
      const level = Number.parseFloat(
        root?.style.getPropertyValue("--rind-agent-presence-level") ?? "",
      )
      const voice = (Number.isFinite(level) ? level : 0) * look.gain
      if (!still.matches) phase += dt * look.speed * (1 + voice * 0.5)
      const dpr = Math.min(devicePixelRatio, 2)
      const w = Math.round(canvas.clientWidth * dpr)
      const h = Math.round(canvas.clientHeight * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
      gl.uniform2f(u.size, w, h)
      gl.uniform1f(u.time, phase)
      gl.uniform1f(u.amp, look.amp * (1 + voice))
      gl.uniform1f(u.warp, look.warp + voice)
      gl.uniform1f(u.ridge, look.ridge)
      gl.uniform1f(u.exposure, look.exposure * (1 + voice * 0.25))
      for (const [i, c] of look.colors.entries())
        gl.uniform3f(u.colors[i] ?? null, c[0], c[1], c[2])
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    })
    return () => {
      cancelAnimationFrame(frame)
      io.disconnect()
    }
  }, [])
}

export function Basic() {
  const [state, setState] = useState<AgentState>("listening")
  const level = useFakeLevel()
  const orb = useShaderOrb()
  return (
    <div className="stack presence-demo">
      <AgentPresence.Root state={state} getLevel={level} reason="microphone unavailable">
        <AgentPresence.Visual>
          <canvas ref={orb} style={{ display: "block", inlineSize: 168, blockSize: 168 }} />
        </AgentPresence.Visual>
        <AgentPresence.Label>Assistant</AgentPresence.Label>
        <AgentPresence.Status />
        {state === "error" && <AgentPresence.Detail>Microphone unavailable</AgentPresence.Detail>}
      </AgentPresence.Root>
      <fieldset className="row presence-states">
        <legend className="note">Simulate a state</legend>
        {STATES.map((s) => (
          <button key={s} type="button" aria-pressed={s === state} onClick={() => setState(s)}>
            {s}
          </button>
        ))}
      </fieldset>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Voice assistant",
    description:
      "A WebGL orb in the Visual: it reads the state and the level from the DOM each frame, so nothing re-renders; the state is spoken once per change.",
  },
}
