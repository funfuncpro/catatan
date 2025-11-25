import * as Rope from "./rope";
import {
  RootNode,
  TextNode,
  TextFormat,
  EditorNode,
  createTextFormat,
  createRootNode,
  createParagraphNode,
  createTextNode,
  getTextContent,
  isTextNode,
  isElementNode,
} from "./node";

export interface Document {
  readonly text: Rope.Rope;
  readonly root: RootNode;
  readonly formats: FormatSpan[];
}

export interface FormatSpan {
  readonly start: number;
  readonly end: number;
  readonly format: Partial<TextFormat>;
}

export const empty = (): Document => ({
  text: Rope.empty(),
  root: createRootNode([createParagraphNode([createTextNode("")])]),
  formats: [],
});

export const fromText = (text: string): Document => ({
  text: Rope.fromString(text),
  root: textToNodes(text),
  formats: [],
});

export const fromRope = (rope: Rope.Rope): Document => ({
  text: rope,
  root: textToNodes(Rope.toString(rope)),
  formats: [],
});

export const insertAt = (doc: Document, pos: number, str: string): Document => {
  const newText = Rope.insert(doc.text, pos, str);
  const newFormats = shiftFormats(doc.formats, pos, str.length);

  return {
    text: newText,
    root: textToNodes(Rope.toString(newText), newFormats),
    formats: newFormats,
  };
};

export const deleteRange = (
  doc: Document,
  start: number,
  end: number,
): Document => {
  const newText = Rope.remove(doc.text, start, end);
  const newFormats = shrinkFormats(doc.formats, start, end - start);

  return {
    text: newText,
    root: textToNodes(Rope.toString(newText), newFormats),
    formats: newFormats,
  };
};

export const deleteAt = (doc: Document, pos: number): Document =>
  deleteRange(doc, pos, pos + 1);

export const replaceRange = (
  doc: Document,
  start: number,
  end: number,
  str: string,
): Document => {
  const newText = Rope.replace(doc.text, start, end, str);
  let newFormats = shrinkFormats(doc.formats, start, end - start);
  newFormats = shiftFormats(newFormats, start, str.length);

  return {
    text: newText,
    root: textToNodes(Rope.toString(newText), newFormats),
    formats: newFormats,
  };
};

export const applyFormat = (
  doc: Document,
  start: number,
  end: number,
  format: Partial<TextFormat>,
): Document => {
  const newFormats = mergeFormat(doc.formats, { start, end, format });

  return {
    ...doc,
    root: textToNodes(Rope.toString(doc.text), newFormats),
    formats: newFormats,
  };
};

export const toggleFormat = (
  doc: Document,
  start: number,
  end: number,
  key: keyof TextFormat,
): Document => {
  const hasFormat = doc.formats.some(
    (f) => f.start <= start && f.end >= end && f.format[key],
  );

  return applyFormat(doc, start, end, { [key]: !hasFormat });
};

export const length = (doc: Document): number => Rope.length(doc.text);
export const getText = (doc: Document): string => Rope.toString(doc.text);
export const slice = (doc: Document, start: number, end?: number): string =>
  Rope.slice(doc.text, start, end);
export const lineCount = (doc: Document): number => Rope.lineCount(doc.text);

export const getLine = (doc: Document, index: number): string =>
  Rope.getLine(doc.text, index);

export const getFormatAt = (doc: Document, pos: number): TextFormat => {
  const base = createTextFormat();

  for (const span of doc.formats) {
    if (span.start <= pos && span.end > pos) {
      Object.assign(base, span.format);
    }
  }

  return base;
};

export const posToLine = (doc: Document, pos: number): number => {
  const text = Rope.slice(doc.text, 0, pos);
  return (text.match(/\n/g) || []).length;
};

export const lineToPos = (doc: Document, line: number): number => {
  const starts = Rope.lineStarts(doc.text);
  return starts[line] ?? Rope.length(doc.text);
};

export const lineRange = (
  doc: Document,
  line: number,
): { start: number; end: number } => {
  const starts = Rope.lineStarts(doc.text);
  const start = starts[line] ?? 0;
  const end =
    starts[line + 1] !== undefined
      ? starts[line + 1] - 1
      : Rope.length(doc.text);

  return { start, end };
};

const shiftFormats = (
  formats: FormatSpan[],
  pos: number,
  amount: number,
): FormatSpan[] =>
  formats.map((f) => ({
    ...f,
    start: f.start >= pos ? f.start + amount : f.start,
    end: f.end >= pos ? f.end + amount : f.end,
  }));

const shrinkFormats = (
  formats: FormatSpan[],
  pos: number,
  amount: number,
): FormatSpan[] =>
  formats
    .map((f) => {
      if (f.end <= pos) return f;
      if (f.start >= pos + amount) {
        return { ...f, start: f.start - amount, end: f.end - amount };
      }
      const newStart = Math.min(f.start, pos);
      const newEnd = Math.max(pos, f.end - amount);
      return newEnd > newStart ? { ...f, start: newStart, end: newEnd } : null;
    })
    .filter((f): f is FormatSpan => f !== null);

const mergeFormat = (formats: FormatSpan[], span: FormatSpan): FormatSpan[] => {
  return [...formats, span];
};

const textToNodes = (text: string, formats: FormatSpan[] = []): RootNode => {
  if (text.length === 0) {
    return createRootNode([createParagraphNode([createTextNode("")])]);
  }

  const lines = text.split("\n");
  const paragraphs = lines.map((line, lineIndex) => {
    const lineStart =
      lines.slice(0, lineIndex).join("\n").length + (lineIndex > 0 ? 1 : 0);

    const segments = getFormattedSegments(line, lineStart, formats);

    return createParagraphNode(
      segments.length > 0 ? segments : [createTextNode("")],
    );
  });

  return createRootNode(paragraphs);
};

const getFormattedSegments = (
  line: string,
  lineStart: number,
  formats: FormatSpan[],
): TextNode[] => {
  if (line.length === 0) return [createTextNode("")];

  const boundaries = new Set<number>([0, line.length]);
  for (const f of formats) {
    const relStart = f.start - lineStart;
    const relEnd = f.end - lineStart;

    if (relStart > 0 && relStart < line.length) boundaries.add(relStart);
    if (relEnd > 0 && relEnd < line.length) boundaries.add(relEnd);
  }

  const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
  const segments: TextNode[] = [];

  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const start = sortedBoundaries[i];
    const end = sortedBoundaries[i + 1];
    const segmentText = line.slice(start, end);

    const format: Partial<TextFormat> = {};
    for (const f of formats) {
      const absStart = lineStart + start;
      const absEnd = lineStart + end;

      if (f.start <= absStart && f.end >= absEnd) {
        Object.assign(format, f.format);
      }
    }

    segments.push(createTextNode(segmentText, format));
  }

  return segments.length > 0 ? segments : [createTextNode(line)];
};

const extractFormats = (
  node: EditorNode,
  offset: number = 0,
): { formats: FormatSpan[]; length: number } => {
  if (isTextNode(node)) {
    const len = node.text.length;
    const hasFormat = Object.values(node.format).some(Boolean);

    if (hasFormat && len > 0) {
      return {
        formats: [{ start: offset, end: offset + len, format: node.format }],
        length: len,
      };
    }

    return { formats: [], length: len };
  }

  if (node.type === "linebreak") {
    return { formats: [], length: 1 };
  }

  if (isElementNode(node)) {
    const result: FormatSpan[] = [];
    let pos = offset;

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const { formats, length } = extractFormats(child, pos);
      result.push(...formats);
      pos += length;

      if (node.type === "root" && i < node.children.length - 1) {
        pos += 1;
      }
    }

    return { formats: result, length: pos - offset };
  }

  return { formats: [], length: 0 };
};

export const fromNodes = (root: RootNode): Document => {
  const text = getTextContent(root);
  const { formats } = extractFormats(root);

  return {
    text: Rope.fromString(text),
    root,
    formats,
  };
};
