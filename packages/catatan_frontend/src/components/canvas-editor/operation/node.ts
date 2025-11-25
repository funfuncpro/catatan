export const nodeType = [
  "root",
  "paragraph",
  "heading",
  "text",
  "linebreak",
  "code",
  "quote",
  "list",
  "listitem",
] as const;
export type NodeType = (typeof nodeType)[number];

export interface TextFormat {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  code: boolean;
}

export const createTextFormat = (
  overrides: Partial<TextFormat> = {},
): TextFormat => ({
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  code: false,
  ...overrides,
});

export interface BaseNode {
  readonly type: NodeType;
  readonly key: string;
}

export interface TextNode extends BaseNode {
  readonly type: "text";
  readonly text: string;
  readonly format: TextFormat;
}

export interface LineBreakNode extends BaseNode {
  readonly type: "linebreak";
}

export interface ElementNode extends BaseNode {
  readonly children: ReadonlyArray<EditorNode>;
}

export interface RootNode extends ElementNode {
  readonly type: "root";
}

export interface ParagraphNode extends ElementNode {
  readonly type: "paragraph";
  readonly indent: number;
}

export interface HeadingNode extends ElementNode {
  readonly type: "heading";
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
}

export interface CodeBlockNode extends ElementNode {
  readonly type: "code";
  readonly language: string;
}

export interface QuoteNode extends ElementNode {
  readonly type: "quote";
}

export interface ListNode extends ElementNode {
  readonly type: "list";
  readonly listType: "bullet" | "number" | "check";
  readonly start: number;
}

export interface ListItemNode extends ElementNode {
  readonly type: "listitem";
  readonly checked?: boolean;
}

export type LeafNode = TextNode | LineBreakNode;

export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | CodeBlockNode
  | QuoteNode
  | ListNode
  | ListItemNode;

export type EditorNode = RootNode | BlockNode | LeafNode;

export const isTextNode = (node: EditorNode): node is TextNode =>
  node.type === "text";

export const isLineBreakNode = (node: EditorNode): node is LineBreakNode =>
  node.type === "linebreak";

export const isLeafNode = (node: EditorNode): node is LeafNode =>
  node.type === "text" || node.type === "linebreak";

export type AnyElementNode =
  | RootNode
  | ParagraphNode
  | HeadingNode
  | CodeBlockNode
  | QuoteNode
  | ListNode
  | ListItemNode;

export const isElementNode = (node: EditorNode): node is AnyElementNode =>
  !isLeafNode(node);

export const isParagraphNode = (node: EditorNode): node is ParagraphNode =>
  node.type === "paragraph";

export const isHeadingNode = (node: EditorNode): node is HeadingNode =>
  node.type === "heading";

export const isRootNode = (node: EditorNode): node is RootNode =>
  node.type === "root";

export const isListNode = (node: EditorNode): node is ListNode =>
  node.type === "list";

export const isListItemNode = (node: EditorNode): node is ListItemNode =>
  node.type === "listitem";

let keyCounter = () => {
  let counter = 0;
  return {
    get: () => {
      return `node_${counter++}`;
    },
    reset: () => {
      counter = 0;
    },
  };
};

export const generateKey = (): string => {
  return keyCounter().get();
};

export const createTextNode = (
  text: string,
  format: Partial<TextFormat> = {},
): TextNode => ({
  type: "text",
  key: generateKey(),
  text,
  format: createTextFormat(format),
});

export const createLineBreakNode = (): LineBreakNode => ({
  type: "linebreak",
  key: generateKey(),
});

export const createParagraphNode = (
  children: EditorNode[] = [],
  indent: number = 0,
): ParagraphNode => ({
  type: "paragraph",
  key: generateKey(),
  children,
  indent,
});

export const createHeadingNode = (
  level: 1 | 2 | 3 | 4 | 5 | 6,
  children: EditorNode[] = [],
): HeadingNode => ({
  type: "heading",
  key: generateKey(),
  level,
  children,
});

export const createCodeBlockNode = (
  language: string = "",
  children: EditorNode[] = [],
): CodeBlockNode => ({
  type: "code",
  key: generateKey(),
  language,
  children,
});

export const createQuoteNode = (children: EditorNode[] = []): QuoteNode => ({
  type: "quote",
  key: generateKey(),
  children,
});

export const createListNode = (
  listType: "bullet" | "number" | "check",
  children: EditorNode[] = [],
  start: number = 1,
): ListNode => ({
  type: "list",
  key: generateKey(),
  listType,
  start,
  children,
});

export const createListItemNode = (
  children: EditorNode[] = [],
  checked?: boolean,
): ListItemNode => ({
  type: "listitem",
  key: generateKey(),
  children,
  checked,
});

export const createRootNode = (children: EditorNode[] = []): RootNode => ({
  type: "root",
  key: generateKey(),
  children,
});

export const updateTextContent = (node: TextNode, text: string): TextNode => ({
  ...node,
  text,
});

export const updateTextFormat = (
  node: TextNode,
  format: Partial<TextFormat>,
): TextNode => ({
  ...node,
  format: { ...node.format, ...format },
});

export const toggleFormat = (
  node: TextNode,
  formatKey: keyof TextFormat,
): TextNode => ({
  ...node,
  format: { ...node.format, [formatKey]: !node.format[formatKey] },
});

export const appendChild = <T extends AnyElementNode>(
  parent: T,
  child: EditorNode,
): T => ({
  ...parent,
  children: [...parent.children, child],
});

export const insertChild = <T extends AnyElementNode>(
  parent: T,
  child: EditorNode,
  index: number,
): T => ({
  ...parent,
  children: [
    ...parent.children.slice(0, index),
    child,
    ...parent.children.slice(index),
  ],
});

export const removeChild = <T extends AnyElementNode>(
  parent: T,
  index: number,
): T => ({
  ...parent,
  children: [
    ...parent.children.slice(0, index),
    ...parent.children.slice(index + 1),
  ],
});

export const replaceChild = <T extends AnyElementNode>(
  parent: T,
  index: number,
  newChild: EditorNode,
): T => ({
  ...parent,
  children: [
    ...parent.children.slice(0, index),
    newChild,
    ...parent.children.slice(index + 1),
  ],
});

export const findNodeByKey = (
  root: EditorNode,
  key: string,
): EditorNode | null => {
  if (root.key === key) return root;

  if (isElementNode(root)) {
    for (const child of root.children) {
      const found = findNodeByKey(child, key);
      if (found) return found;
    }
  }

  return null;
};

export const findParent = (
  root: EditorNode,
  targetKey: string,
): AnyElementNode | null => {
  if (!isElementNode(root)) return null;

  for (const child of root.children) {
    if (child.key === targetKey) return root;
    const found = findParent(child, targetKey);
    if (found) return found;
  }

  return null;
};

export const getTextContent = (node: EditorNode): string => {
  if (isTextNode(node)) return node.text;
  if (isLineBreakNode(node)) return "\n";

  if (isElementNode(node)) {
    return node.children.map(getTextContent).join("");
  }

  return "";
};

export const getAllTextNodes = (node: EditorNode): TextNode[] => {
  if (isTextNode(node)) return [node];

  if (isElementNode(node)) {
    return node.children.flatMap(getAllTextNodes);
  }

  return [];
};

export type NodePath = number[];

export const getNodeAtPath = (
  root: EditorNode,
  path: NodePath,
): EditorNode | null => {
  if (path.length === 0) return root;

  if (!isElementNode(root)) return null;

  const [index, ...rest] = path;
  const child = root.children[index];

  if (!child) return null;

  return getNodeAtPath(child, rest);
};

export const updateNodeAtPath = (
  root: EditorNode,
  path: NodePath,
  updater: (node: EditorNode) => EditorNode,
): EditorNode => {
  if (path.length === 0) return updater(root);

  if (!isElementNode(root)) return root;

  const [index, ...rest] = path;
  const newChildren = [...root.children];

  if (newChildren[index]) {
    newChildren[index] = updateNodeAtPath(newChildren[index], rest, updater);
  }

  return { ...root, children: newChildren } as EditorNode;
};
