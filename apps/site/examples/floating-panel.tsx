"use client"

import { FloatingPanel } from "@rind-ui/react"
import type { States, Variants } from "./types"

export const states: States = { "floating-panel": { idle: "Basic" } }

export function Basic() {
  return (
    <div className="panel-stage">
      <FloatingPanel.Root
        defaultOpen
        defaultPosition={{ x: 24, y: 56 }}
        defaultSize={{ width: 300, height: 200 }}
      >
        <FloatingPanel.Trigger>Inspector</FloatingPanel.Trigger>
        <FloatingPanel.Positioner>
          <FloatingPanel.Content>
            <FloatingPanel.Header>
              <FloatingPanel.DragTrigger>⠿</FloatingPanel.DragTrigger>
              <FloatingPanel.Title>Inspector</FloatingPanel.Title>
              <FloatingPanel.Control>
                <FloatingPanel.StageTrigger stage="minimized">–</FloatingPanel.StageTrigger>
                <FloatingPanel.StageTrigger stage="maximized">□</FloatingPanel.StageTrigger>
                <FloatingPanel.CloseTrigger>×</FloatingPanel.CloseTrigger>
              </FloatingPanel.Control>
            </FloatingPanel.Header>
            <FloatingPanel.Body>
              <dl className="inspector">
                <dt>Element</dt>
                <dd>button.primary</dd>
                <dt>Size</dt>
                <dd>120 × 40</dd>
                <dt>Contrast</dt>
                <dd>7.2 : 1</dd>
              </dl>
            </FloatingPanel.Body>
            {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const).map((axis) => (
              <FloatingPanel.ResizeTrigger key={axis} axis={axis} />
            ))}
          </FloatingPanel.Content>
        </FloatingPanel.Positioner>
      </FloatingPanel.Root>
    </div>
  )
}

export const variants: Variants = {
  Basic: {
    title: "Inspector",
    description:
      "Drag the grip or the edges; with the grip focused, arrows move it, Alt+arrows resize, Enter maximises. It stays inside the stage.",
  },
}
