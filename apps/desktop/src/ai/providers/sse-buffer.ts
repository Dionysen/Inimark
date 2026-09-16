/**
 * Shared SSE line buffering: feed raw chunks, get complete `data:` payloads.
 */

export function consumeSseDataLines(buffer: string): {
  payloads: string[];
  rest: string;
} {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n");
  const rest = parts.pop() ?? "";
  const payloads: string[] = [];

  for (const line of parts) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trimStart();
    if (payload) payloads.push(payload);
  }

  return { payloads, rest };
}

/**
 * Anthropic-style SSE: accumulate event blocks separated by blank lines.
 * Returns complete blocks (`event:…\ndata:…`) and leftover buffer.
 */
export function consumeSseBlocks(buffer: string): {
  blocks: string[];
  rest: string;
} {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const parts = normalized.split("\n\n");
  const rest = parts.pop() ?? "";
  const blocks = parts.map((b) => b.trim()).filter(Boolean);
  return { blocks, rest };
}

export function parseSseBlock(block: string): { event: string; data: string } {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  return { event, data: dataLines.join("\n") };
}
