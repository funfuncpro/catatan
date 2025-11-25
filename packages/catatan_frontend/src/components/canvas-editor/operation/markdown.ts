import {
  EditorNode,
  RootNode,
  TextNode,
  CodeBlockNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  TextFormat,
  createRootNode,
  createParagraphNode,
  createHeadingNode,
  createTextNode,
  createCodeBlockNode,
  createQuoteNode,
  createListNode,
  createListItemNode,
  isTextNode,
  getTextContent,
} from "./node";

interface ParseContext {
  lines: string[];
  index: number;
}

const createContext = (text: string): ParseContext => ({
  lines: text.split("\n"),
  index: 0,
});

const currentLine = (ctx: ParseContext): string | undefined =>
  ctx.lines[ctx.index];

const advance = (ctx: ParseContext): ParseContext => ({
  ...ctx,
  index: ctx.index + 1,
});

const isAtEnd = (ctx: ParseContext): boolean => ctx.index >= ctx.lines.length;

interface InlineToken {
  type: "text" | "bold" | "italic" | "code" | "bolditalic";
  content: string;
}

const parseInlineTokens = (text: string): InlineToken[] => {
  const tokens: InlineToken[] = [];
  let remaining = text;

  const patterns: Array<{
    regex: RegExp;
    type: InlineToken["type"];
  }> = [
    { regex: /^\*\*\*(.+?)\*\*\*/, type: "bolditalic" },
    { regex: /^___(.+?)___/, type: "bolditalic" },
    { regex: /^\*\*(.+?)\*\*/, type: "bold" },
    { regex: /^__(.+?)__/, type: "bold" },
    { regex: /^\*([^*]+?)\*/, type: "italic" },
    { regex: /^_([^_]+?)_/, type: "italic" },
    { regex: /^`([^`]+?)`/, type: "code" },
  ];

  while (remaining.length > 0) {
    let matched = false;

    for (const { regex, type } of patterns) {
      const match = remaining.match(regex);
      if (match) {
        tokens.push({ type, content: match[1] });
        remaining = remaining.slice(match[0].length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      const nextSpecial = remaining.search(/[*_`]/);
      if (nextSpecial === -1) {
        tokens.push({ type: "text", content: remaining });
        remaining = "";
      } else if (nextSpecial === 0) {
        tokens.push({ type: "text", content: remaining[0] });
        remaining = remaining.slice(1);
      } else {
        tokens.push({ type: "text", content: remaining.slice(0, nextSpecial) });
        remaining = remaining.slice(nextSpecial);
      }
    }
  }

  return tokens;
};

const tokenToTextNode = (token: InlineToken): TextNode => {
  const format: Partial<TextFormat> = {};

  switch (token.type) {
    case "bold":
      format.bold = true;
      break;
    case "italic":
      format.italic = true;
      break;
    case "code":
      format.code = true;
      break;
    case "bolditalic":
      format.bold = true;
      format.italic = true;
      break;
  }

  return createTextNode(token.content, format);
};

const parseInlineContent = (text: string): EditorNode[] => {
  if (text.length === 0) {
    return [createTextNode("")];
  }

  const tokens = parseInlineTokens(text);
  return tokens.map(tokenToTextNode);
};

const parseHeading = (
  line: string,
): { level: 1 | 2 | 3 | 4 | 5 | 6; content: string } | null => {
  const match = line.match(/^(#{1,6})\s+(.*)$/);
  if (!match) return null;

  const level = match[1].length as 1 | 2 | 3 | 4 | 5 | 6;
  return { level, content: match[2] };
};

const isCodeBlockStart = (line: string): { language: string } | null => {
  const match = line.match(/^```(\w*)$/);
  if (!match) return null;
  return { language: match[1] || "" };
};

const isCodeBlockEnd = (line: string): boolean => line.trim() === "```";

const isQuoteLine = (line: string): string | null => {
  const match = line.match(/^>\s?(.*)$/);
  return match ? match[1] : null;
};

const parseListItem = (
  line: string,
): {
  type: "bullet" | "number" | "check";
  content: string;
  checked?: boolean;
} | null => {
  const checkMatch = line.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/);
  if (checkMatch) {
    return {
      type: "check",
      content: checkMatch[2],
      checked: checkMatch[1].toLowerCase() === "x",
    };
  }

  const bulletMatch = line.match(/^[-*+]\s+(.*)$/);
  if (bulletMatch) {
    return { type: "bullet", content: bulletMatch[1] };
  }

  const numberMatch = line.match(/^\d+\.\s+(.*)$/);
  if (numberMatch) {
    return { type: "number", content: numberMatch[1] };
  }

  return null;
};

const parseCodeBlock = (
  ctx: ParseContext,
  language: string,
): { node: CodeBlockNode; ctx: ParseContext } => {
  let newCtx = advance(ctx);
  const lines: string[] = [];

  while (!isAtEnd(newCtx) && !isCodeBlockEnd(currentLine(newCtx) ?? "")) {
    lines.push(currentLine(newCtx) ?? "");
    newCtx = advance(newCtx);
  }

  if (!isAtEnd(newCtx)) {
    newCtx = advance(newCtx);
  }

  const content = lines.join("\n");
  const node = createCodeBlockNode(language, [createTextNode(content)]);

  return { node, ctx: newCtx };
};

const parseQuoteBlock = (
  ctx: ParseContext,
): { node: QuoteNode; ctx: ParseContext } => {
  const lines: string[] = [];
  let newCtx = ctx;

  while (!isAtEnd(newCtx)) {
    const quotedContent = isQuoteLine(currentLine(newCtx) ?? "");
    if (quotedContent === null) break;

    lines.push(quotedContent);
    newCtx = advance(newCtx);
  }

  const innerContent = lines.join("\n");
  const innerRoot = parseMarkdown(innerContent);
  const node = createQuoteNode(innerRoot.children as EditorNode[]);

  return { node, ctx: newCtx };
};

const parseList = (
  ctx: ParseContext,
): { node: ListNode; ctx: ParseContext } => {
  const items: ListItemNode[] = [];
  let newCtx = ctx;
  let listType: "bullet" | "number" | "check" | null = null;

  while (!isAtEnd(newCtx)) {
    const line = currentLine(newCtx) ?? "";
    const listItem = parseListItem(line);

    if (!listItem) break;

    if (listType === null) {
      listType = listItem.type;
    }

    const children = parseInlineContent(listItem.content);
    items.push(createListItemNode(children, listItem.checked));
    newCtx = advance(newCtx);
  }

  const node = createListNode(listType ?? "bullet", items);
  return { node, ctx: newCtx };
};

const parseBlock = (
  ctx: ParseContext,
): { node: EditorNode | null; ctx: ParseContext } => {
  const line = currentLine(ctx);

  if (line === undefined) {
    return { node: null, ctx };
  }

  if (line.trim() === "") {
    return { node: null, ctx: advance(ctx) };
  }

  const codeStart = isCodeBlockStart(line);
  if (codeStart) {
    return parseCodeBlock(ctx, codeStart.language);
  }

  const heading = parseHeading(line);
  if (heading) {
    const children = parseInlineContent(heading.content);
    return {
      node: createHeadingNode(heading.level, children),
      ctx: advance(ctx),
    };
  }

  if (isQuoteLine(line) !== null) {
    return parseQuoteBlock(ctx);
  }

  if (parseListItem(line)) {
    return parseList(ctx);
  }

  const children = parseInlineContent(line);
  return {
    node: createParagraphNode(children),
    ctx: advance(ctx),
  };
};

export const parseMarkdown = (text: string): RootNode => {
  let ctx = createContext(text);
  const children: EditorNode[] = [];

  while (!isAtEnd(ctx)) {
    const { node, ctx: newCtx } = parseBlock(ctx);
    ctx = newCtx;

    if (node) {
      children.push(node);
    }
  }

  if (children.length === 0) {
    children.push(createParagraphNode([createTextNode("")]));
  }

  return createRootNode(children);
};

const formatToMarkdown = (text: string, format: TextFormat): string => {
  let result = text;

  if (format.code) {
    result = `\`${result}\``;
  }

  if (format.bold && format.italic) {
    result = `***${result}***`;
  } else if (format.bold) {
    result = `**${result}**`;
  } else if (format.italic) {
    result = `*${result}*`;
  }

  if (format.strikethrough) {
    result = `~~${result}~~`;
  }

  return result;
};

const serializeInlineNodes = (nodes: readonly EditorNode[]): string => {
  return nodes
    .map((node) => {
      if (isTextNode(node)) {
        return formatToMarkdown(node.text, node.format);
      }
      if (node.type === "linebreak") {
        return "\n";
      }
      return "";
    })
    .join("");
};

const serializeNode = (node: EditorNode, indent: string = ""): string => {
  switch (node.type) {
    case "text":
      return formatToMarkdown(node.text, node.format);

    case "linebreak":
      return "\n";

    case "paragraph":
      return indent + serializeInlineNodes(node.children);

    case "heading": {
      const prefix = "#".repeat(node.level);
      return `${prefix} ${serializeInlineNodes(node.children)}`;
    }

    case "code": {
      const content = getTextContent(node);
      return `\`\`\`${node.language}\n${content}\n\`\`\``;
    }

    case "quote": {
      const innerLines = node.children
        .map((child) => serializeNode(child))
        .join("\n");
      return innerLines
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    }

    case "list": {
      return node.children
        .map((item, i) => {
          if (item.type !== "listitem") return "";

          const content = serializeInlineNodes(item.children);
          let prefix: string;

          switch (node.listType) {
            case "number":
              prefix = `${node.start + i}. `;
              break;
            case "check":
              prefix = item.checked ? "- [x] " : "- [ ] ";
              break;
            default:
              prefix = "- ";
          }

          return `${indent}${prefix}${content}`;
        })
        .join("\n");
    }

    case "listitem":
      return serializeInlineNodes(node.children);

    case "root":
      return node.children.map((child) => serializeNode(child)).join("\n\n");

    default:
      return "";
  }
};

export const serializeToMarkdown = (root: RootNode): string => {
  return serializeNode(root);
};

export const createEmptyDocument = (): RootNode =>
  createRootNode([createParagraphNode([createTextNode("")])]);

export const fromPlainText = (text: string): RootNode => {
  const lines = text.split("\n");
  const paragraphs = lines.map((line) =>
    createParagraphNode([createTextNode(line)]),
  );

  return createRootNode(
    paragraphs.length > 0
      ? paragraphs
      : [createParagraphNode([createTextNode("")])],
  );
};

export const toPlainText = (root: RootNode): string => {
  return getTextContent(root);
};
