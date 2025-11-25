import { EditorState, Doc } from "../operation/index";
import { Layout, LayoutCache, VisualLine, VisualPosition } from "./type";
import {
  FONT_SIZE,
  FONT_FAMILY,
  PADDING_X,
  PADDING_Y,
  LINE_HEIGHT,
} from "./constant";

// ============================================================================
// Layout Cache (Dirty Region Optimization)
// ============================================================================

/** Create an empty layout cache */
export const createLayoutCache = (): LayoutCache => ({
  layout: { lines: [], logicalToVisual: [], totalLines: 0 },
  textRef: null,
  maxWidth: 0,
  lineCache: new Map(),
});

/**
 * Get layout from cache or compute if dirty.
 * Uses reference equality on doc.text to detect changes.
 */
export const getLayout = (
  cache: LayoutCache,
  ctx: CanvasRenderingContext2D,
  state: EditorState,
  maxWidth: number,
): { layout: Layout; cache: LayoutCache } => {
  // Check if cache is valid
  const textRef = state.doc.text; // Rope reference
  const isCacheValid = cache.textRef === textRef && cache.maxWidth === maxWidth;

  if (isCacheValid) {
    return { layout: cache.layout, cache };
  }

  // Cache is invalid - recompute layout
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;

  const lines: VisualLine[] = [];
  const logicalToVisual: number[] = [];
  const lineCount = Doc.lineCount(state.doc);

  for (let i = 0; i < lineCount; i++) {
    logicalToVisual.push(lines.length);
    const lineText = Doc.getLine(state.doc, i);
    const wrapped = wrapLine(ctx, lineText, maxWidth, i);
    lines.push(...wrapped);
  }

  const newLayout: Layout = {
    lines,
    logicalToVisual,
    totalLines: lines.length,
  };

  const newCache: LayoutCache = {
    layout: newLayout,
    textRef,
    maxWidth,
    lineCache: new Map(),
  };

  return { layout: newLayout, cache: newCache };
};

// ============================================================================
// Layout Computation (Line Wrapping)
// ============================================================================

/** Wrap a single logical line into visual lines */
export const wrapLine = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  logicalLine: number,
): VisualLine[] => {
  // Empty line
  if (text.length === 0) {
    return [{ logicalLine, startOffset: 0, endOffset: 0, text: "" }];
  }

  const lines: VisualLine[] = [];
  let start = 0;

  while (start < text.length) {
    // Find how much text fits on this line
    let end = start + 1;

    // Expand until we exceed maxWidth or reach end
    while (end <= text.length) {
      const segment = text.slice(start, end);
      if (ctx.measureText(segment).width > maxWidth) {
        break;
      }
      end++;
    }
    end--; // Back off one

    // If we couldn't fit even one character, force at least one
    if (end <= start) {
      end = start + 1;
    }

    // If we're not at the end, try to break at a word boundary
    if (end < text.length) {
      const segment = text.slice(start, end);
      const lastSpace = segment.lastIndexOf(" ");

      // Only break at space if it's not too far back (at least 30% of the line)
      if (lastSpace > segment.length * 0.3) {
        end = start + lastSpace + 1; // Include the space
      }
    }

    // Store the visual line (keep trailing spaces for cursor positioning)
    const lineText = text.slice(start, end);
    lines.push({
      logicalLine,
      startOffset: start,
      endOffset: end,
      text: lineText,
    });

    start = end;
  }

  return lines;
};

// ============================================================================
// Position/Visual Conversions
// ============================================================================

/** Find visual line and offset for a document position */
export const posToVisual = (
  layout: Layout,
  doc: Doc.Document,
  pos: number,
): VisualPosition => {
  const logicalLine = Doc.posToLine(doc, pos);
  const lineStart = Doc.lineToPos(doc, logicalLine);
  const offsetInLogical = pos - lineStart;

  const firstVisual = layout.logicalToVisual[logicalLine] ?? 0;

  // Find which visual line contains this offset
  for (let i = firstVisual; i < layout.lines.length; i++) {
    const vl = layout.lines[i];
    if (vl.logicalLine !== logicalLine) break;

    // Check if offset is within this visual line
    // For the last visual line of a logical line, include the end offset
    const isLastVisualOfLogical =
      i + 1 >= layout.lines.length ||
      layout.lines[i + 1].logicalLine !== logicalLine;

    const inRange = isLastVisualOfLogical
      ? offsetInLogical >= vl.startOffset && offsetInLogical <= vl.endOffset
      : offsetInLogical >= vl.startOffset && offsetInLogical < vl.endOffset;

    if (inRange) {
      return {
        visualLine: i,
        visualOffset: offsetInLogical - vl.startOffset,
      };
    }
  }

  // Fallback: end of last visual line for this logical line
  let lastVisual = firstVisual;
  while (
    lastVisual + 1 < layout.lines.length &&
    layout.lines[lastVisual + 1].logicalLine === logicalLine
  ) {
    lastVisual++;
  }

  const vl = layout.lines[lastVisual];
  return {
    visualLine: lastVisual,
    visualOffset: vl ? vl.text.length : 0,
  };
};

/** Convert canvas coordinates to document position */
export const coordsToPos = (
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  doc: Doc.Document,
  x: number,
  y: number,
  scrollOffset: number,
): number => {
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;

  // Adjust for scroll and padding
  const adjustedY = y + scrollOffset - PADDING_Y;
  const adjustedX = x - PADDING_X;

  // Find which visual line was clicked
  const visualLineIndex = Math.floor(adjustedY / LINE_HEIGHT);

  // Clamp to valid range
  if (visualLineIndex < 0) {
    return 0;
  }
  if (visualLineIndex >= layout.lines.length) {
    return Doc.length(doc);
  }

  const vl = layout.lines[visualLineIndex];
  if (!vl) return 0;

  // Get actual text from logical line
  const logicalLineText = Doc.getLine(doc, vl.logicalLine);
  const vlText = logicalLineText.slice(vl.startOffset, vl.endOffset);

  // If click is before start of text, return start of visual line
  if (adjustedX <= 0) {
    const lineStart = Doc.lineToPos(doc, vl.logicalLine);
    return lineStart + vl.startOffset;
  }

  // Binary search to find the character position
  let left = 0;
  let right = vlText.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const textWidth = ctx.measureText(vlText.slice(0, mid)).width;

    if (textWidth < adjustedX) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  // Check if we should snap to the previous or next character
  if (left > 0) {
    const prevWidth = ctx.measureText(vlText.slice(0, left - 1)).width;
    const currWidth = ctx.measureText(vlText.slice(0, left)).width;

    // Snap to nearest character boundary
    if (adjustedX - prevWidth < currWidth - adjustedX) {
      left = left - 1;
    }
  }

  // Clamp to visual line length
  left = Math.min(left, vlText.length);

  // Convert to absolute document position
  const lineStart = Doc.lineToPos(doc, vl.logicalLine);
  return lineStart + vl.startOffset + left;
};
