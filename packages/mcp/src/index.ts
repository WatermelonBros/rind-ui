#!/usr/bin/env node
// stdio transport: one JSON-RPC message per line in, one per line out. Logs go to stderr only:
// stdout belongs to the protocol.
import { createInterface } from "node:readline"
import { handle } from "./server"

const lines = createInterface({ input: process.stdin })
lines.on("line", async (line) => {
  if (!line.trim()) return
  let message: unknown
  try {
    message = JSON.parse(line)
  } catch {
    process.stdout.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`,
    )
    return
  }
  const response = await handle(message)
  if (response) process.stdout.write(`${JSON.stringify(response)}\n`)
})
