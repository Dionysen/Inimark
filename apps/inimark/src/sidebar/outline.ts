export type OutlineItem = {
  level: number;
  text: string;
  line: number;
};

export type OutlineNode = {
  item: OutlineItem;
  children: OutlineNode[];
};

/** Parse ATX headings from markdown, skipping fenced code blocks. */
export function parseOutline(markdown: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  const lines = markdown.split("\n");
  let inCodeBlock = false;
  let codeFence: { char: string; length: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const fenceMatch = line.match(/^(`{3,}|~{3,})/);

    if (fenceMatch) {
      const fence = fenceMatch[1]!;
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeFence = { char: fence[0]!, length: fence.length };
      } else if (
        codeFence &&
        fence[0] === codeFence.char &&
        fence.length >= codeFence.length
      ) {
        inCodeBlock = false;
        codeFence = null;
      }
      continue;
    }

    if (inCodeBlock) continue;

    const m = line.match(/^(#{1,6})\s+(.+)/);
    if (m) {
      items.push({ level: m[1]!.length, text: m[2]!.trim(), line: i + 1 });
    }
  }

  return items;
}

export function buildOutlineTree(items: OutlineItem[]): OutlineNode[] {
  const root: OutlineNode[] = [];
  const stack: Array<{ node: OutlineNode; level: number }> = [];

  for (const item of items) {
    const node: OutlineNode = { item, children: [] };

    while (stack.length > 0 && stack[stack.length - 1]!.level >= item.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1]!.node.children.push(node);
    }

    stack.push({ node, level: item.level });
  }

  return root;
}
