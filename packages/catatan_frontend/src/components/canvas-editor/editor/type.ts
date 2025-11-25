export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  isDark: boolean;
  scrollOffset: number;
  maxTextWidth: number;
}

export interface TextStyle {
  bold: boolean;
  italic: boolean;
  code: boolean;
}

/** A visual line after wrapping */
export interface VisualLine {
  /** Index of logical line (paragraph) */
  logicalLine: number;
  /** Start offset within the logical line */
  startOffset: number;
  /** End offset within the logical line */
  endOffset: number;
  /** The text content */
  text: string;
}

/** Layout info for the document */
export interface Layout {
  /** All visual lines */
  lines: VisualLine[];
  /** Map from logical line to first visual line index */
  logicalToVisual: number[];
  /** Total visual line count */
  totalLines: number;
}

/** Mouse state for drag selection */
export interface MouseState {
  isDragging: boolean;
  startPos: number | null;
}

/**
 * Layout cache to avoid recomputing layout on every frame.
 * Layout is only recomputed when:
 * - Document text changes (different rope reference)
 * - Canvas width changes (affects line wrapping)
 */
export interface LayoutCache {
  /** Cached layout result */
  layout: Layout;
  /** Reference to the document's rope (for identity comparison) */
  textRef: unknown;
  /** Max width used for wrapping */
  maxWidth: number;
  /** Per-line cache: maps logical line index to its visual lines */
  lineCache: Map<number, VisualLine[]>;
}

/** Find visual line and offset for a document position */
export interface VisualPosition {
  visualLine: number;
  visualOffset: number;
}
