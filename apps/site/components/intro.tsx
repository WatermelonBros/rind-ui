/*
 * The whole intro runs while the HTML is parsed, right after the page (this component sits after
 * it in the layout), so it keeps the same time on a slow phone as on a fast desktop: it never
 * waits for the page's JavaScript. It copies the header and main into a layer that shows them
 * with no CSS at all; the layer hangs off <html>, outside the tree React hydrates, so hydration
 * never touches it. A drop falls (globals.css: #rind-intro-drop) and, as it lands, the styled
 * page spreads out from that point inside a view transition; a click, scroll or key skips to it.
 * The real page is styled from its first paint and never changes layout, so the effect costs no
 * layout shift; the copy only covers it, then goes.
 */
const DROP_MS = 450
const REVEAL_MS = 800
const SCRIPT = `(function(){var r=document.documentElement;try{if(!r.classList.contains("intro"))return;var l=document.createElement("div");l.id="rind-intro-layer";l.setAttribute("aria-hidden","true");l.inert=true;["header","main"].forEach(function(s){var e=document.querySelector(s);if(e)l.appendChild(e.cloneNode(true))});r.appendChild(l);var d=document.createElement("span");d.id="rind-intro-drop";d.setAttribute("aria-hidden","true");r.appendChild(d);var done=false,skip=["pointerdown","keydown","wheel","touchstart"];function finish(){l.remove();d.remove();r.classList.remove("intro")}function reveal(){if(done)return;done=true;clearTimeout(t);skip.forEach(function(k){removeEventListener(k,reveal)});if(!document.startViewTransition)return finish();document.startViewTransition(finish).ready.then(function(){r.animate({clipPath:["circle(0% at 50% 42%)","circle(150% at 50% 42%)"]},{duration:${REVEAL_MS},easing:"cubic-bezier(0.7, 0, 0.2, 1)",pseudoElement:"::view-transition-new(root)"})},function(){})}var t=setTimeout(reveal,${DROP_MS});skip.forEach(function(k){addEventListener(k,reveal,{passive:true})})}finally{r.setAttribute("data-intro-ready","")}})()`

/**
 * Every load of the landing: the page appears as the browser's raw HTML, a drop falls, and the
 * styles spread out from where it lands. Click, scroll or press a key to skip. Never runs under
 * reduced motion (the inline script in <head> only sets html.intro without it).
 */
export function Intro() {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: static inline script, no user input
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
    />
  )
}
