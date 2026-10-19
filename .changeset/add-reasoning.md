---
"@rind-ui/core": minor
"@rind-ui/react": minor
"@rind-ui/testing": minor
"@rind-ui/theme": minor
---

Reasoning: a model's chain of thought in a disclosure that opens by itself while the model thinks and closes a second after it answers. Only live changes toggle it (a reloaded message never does), the user's toggle wins, focus inside keeps it open; the duration comes from your runtime or the Environment's clock; "Thinking…" and "Thought for N seconds" are announced, the trace is not. Core: `DomEnvironmentOptions.clock`. Testing: `getReasoning`; `virtualClock().clock`. Theme: `reasoning.css` with a shimmer that stops under reduced motion.
