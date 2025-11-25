import { onMount, onCleanup, createSignal } from "solid-js";
import {
  createState,
  handleKeyEvent,
  EditorState,
  Doc,
  Node,
  getSelectedText,
  insertText,
  cut,
} from "./operation";

// ============================================================================
// Constants
// ============================================================================

const LINE_HEIGHT = 20;
const FONT_SIZE = 16;
const PADDING_X = 50;
const PADDING_Y = 50;

const FONT_FAMILY = "IBM Plex Sans, sans-serif";

// ============================================================================
// Types
// ============================================================================

interface RenderContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  isDark: boolean;
  scrollOffset: number;
  maxTextWidth: number;
}

interface TextStyle {
  bold: boolean;
  italic: boolean;
  code: boolean;
}

/** A visual line after wrapping */
interface VisualLine {
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
interface Layout {
  /** All visual lines */
  lines: VisualLine[];
  /** Map from logical line to first visual line index */
  logicalToVisual: number[];
  /** Total visual line count */
  totalLines: number;
}

/** Mouse state for drag selection */
interface MouseState {
  isDragging: boolean;
  startPos: number | null;
}

// ============================================================================
// Layout Cache (Dirty Region Optimization)
// ============================================================================

/**
 * Layout cache to avoid recomputing layout on every frame.
 * Layout is only recomputed when:
 * - Document text changes (different rope reference)
 * - Canvas width changes (affects line wrapping)
 */
interface LayoutCache {
  /** Cached layout result */
  layout: Layout;
  /** Reference to the document's rope (for identity comparison) */
  textRef: unknown;
  /** Max width used for wrapping */
  maxWidth: number;
  /** Per-line cache: maps logical line index to its visual lines */
  lineCache: Map<number, VisualLine[]>;
}

/** Create an empty layout cache */
const createLayoutCache = (): LayoutCache => ({
  layout: { lines: [], logicalToVisual: [], totalLines: 0 },
  textRef: null,
  maxWidth: 0,
  lineCache: new Map(),
});

/**
 * Get layout from cache or compute if dirty.
 * Uses reference equality on doc.text to detect changes.
 */
const getLayout = (
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
const wrapLine = (
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

/** Compute layout for entire document */
const computeLayout = (
  ctx: CanvasRenderingContext2D,
  state: EditorState,
  maxWidth: number,
): Layout => {
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;

  const lines: VisualLine[] = [];
  const logicalToVisual: number[] = [];
  const lineCount = Doc.lineCount(state.doc);

  for (let i = 0; i < lineCount; i++) {
    logicalToVisual.push(lines.length);
    const text = Doc.getLine(state.doc, i);
    const wrapped = wrapLine(ctx, text, maxWidth, i);
    lines.push(...wrapped);
  }

  return { lines, logicalToVisual, totalLines: lines.length };
};

/** Find visual line and offset for a document position */
const posToVisual = (
  layout: Layout,
  doc: Doc.Document,
  pos: number,
): { visualLine: number; visualOffset: number } => {
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
const coordsToPos = (
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

// ============================================================================
// Rendering
// ============================================================================

const buildFont = (style: TextStyle): string => {
  const weight = style.bold ? "bold" : "normal";
  const fontStyle = style.italic ? "italic" : "normal";
  const family = style.code ? "monospace" : FONT_FAMILY;
  return `${fontStyle} ${weight} ${FONT_SIZE}px ${family}`;
};

const getVisibleRange = (
  rc: RenderContext,
  totalLines: number,
): { start: number; end: number } => {
  const start = Math.floor(rc.scrollOffset / LINE_HEIGHT);
  const end = Math.min(
    totalLines,
    Math.ceil((rc.scrollOffset + rc.height) / LINE_HEIGHT) + 1,
  );
  return { start: Math.max(0, start), end };
};

const calcScrollOffset = (
  visualLine: number,
  currentOffset: number,
  viewHeight: number,
): number => {
  const cursorY = visualLine * LINE_HEIGHT;
  const cursorScreenY = cursorY - currentOffset;

  if (cursorScreenY < 0) {
    return cursorY;
  }
  if (cursorScreenY > viewHeight - LINE_HEIGHT - PADDING_Y * 2) {
    return cursorY - viewHeight + LINE_HEIGHT + PADDING_Y * 2;
  }
  return currentOffset;
};

/** Render a visual line */
const renderVisualLine = (
  rc: RenderContext,
  state: EditorState,
  vl: VisualLine,
  y: number, // y is the text baseline position (alphabetic)
): void => {
  const { ctx, isDark } = rc;

  // Get the paragraph node for formatting info
  const root = state.doc.root;
  const node = root.children[vl.logicalLine];

  // Get actual text from document (includes spaces)
  const logicalLine = Doc.getLine(state.doc, vl.logicalLine);
  const vlText = logicalLine.slice(vl.startOffset, vl.endOffset);

  if (Node.isParagraphNode(node)) {
    let x = PADDING_X;
    let charIndex = 0;

    for (const child of node.children) {
      if (Node.isTextNode(child)) {
        const childStart = charIndex;
        const childEnd = charIndex + child.text.length;

        // Check if this child overlaps with our visual line range
        if (childEnd > vl.startOffset && childStart < vl.endOffset) {
          const sliceStart = Math.max(0, vl.startOffset - childStart);
          const sliceEnd = Math.min(
            child.text.length,
            vl.endOffset - childStart,
          );
          const text = child.text.slice(sliceStart, sliceEnd);

          if (text.length > 0) {
            const style: TextStyle = {
              bold: child.format.bold,
              italic: child.format.italic,
              code: child.format.code,
            };

            ctx.font = buildFont(style);

            // Code background (y is baseline, so go up by ~80% of font size for top)
            if (style.code) {
              const textWidth = ctx.measureText(text).width;
              ctx.fillStyle = isDark ? "#374151" : "#e5e7eb";
              ctx.fillRect(
                x - 2,
                y - FONT_SIZE + 2,
                textWidth + 4,
                FONT_SIZE + 4,
              );
            }

            ctx.fillStyle = isDark ? "#FFFFFF" : "#000000";
            ctx.fillText(text, x, y);

            if (child.format.strikethrough) {
              const textWidth = ctx.measureText(text).width;
              ctx.fillRect(x, y - FONT_SIZE * 0.35, textWidth, 1);
            }

            if (child.format.underline) {
              const textWidth = ctx.measureText(text).width;
              ctx.fillRect(x, y + 2, textWidth, 1);
            }

            x += ctx.measureText(text).width;
          }
        }

        charIndex = childEnd;
      }
    }
  } else if (Node.isHeadingNode(node)) {
    const sizes = [28, 24, 20, 18, 16, 14] as const;
    const size = sizes[node.level - 1] ?? FONT_SIZE;

    ctx.font = `bold ${size}px ${FONT_FAMILY}`;
    ctx.fillStyle = isDark ? "#FFFFFF" : "#000000";
    ctx.fillText(vlText, PADDING_X, y);
  } else {
    // Default: just render text
    ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
    ctx.fillStyle = isDark ? "#FFFFFF" : "#000000";
    ctx.fillText(vlText, PADDING_X, y);
  }
};

/** Main render function */
const render = (
  rc: RenderContext,
  state: EditorState,
  layout: Layout,
  cursorVisible: boolean,
): void => {
  const { ctx, width, height, scrollOffset, isDark } = rc;

  // Clear with background color (better than clearRect for Safari)
  ctx.fillStyle = isDark ? "#1a1a1a" : "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Set text rendering properties
  ctx.textBaseline = "alphabetic";

  const { start, end } = getVisibleRange(rc, layout.totalLines);

  // Render visible lines
  for (let i = start; i < end; i++) {
    const vl = layout.lines[i];
    if (!vl) continue;

    // Use alphabetic baseline, so add font size to y position
    const y = PADDING_Y + i * LINE_HEIGHT - scrollOffset + FONT_SIZE;
    renderVisualLine(rc, state, vl, y);
  }

  // Render selection (behind cursor)
  if (state.anchor !== null && state.anchor !== state.cursor) {
    renderSelection(rc, state, layout);
  }

  // Render cursor
  if (cursorVisible) {
    renderCursor(rc, state, layout);
  }
};

/** Render cursor */
const renderCursor = (
  rc: RenderContext,
  state: EditorState,
  layout: Layout,
): void => {
  const { ctx, height, scrollOffset, isDark } = rc;

  const { visualLine, visualOffset } = posToVisual(
    layout,
    state.doc,
    state.cursor,
  );
  const vl = layout.lines[visualLine];
  if (!vl) return;

  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;

  // Get the actual text from logical line for accurate cursor positioning
  const logicalLine = Doc.getLine(state.doc, vl.logicalLine);
  const textBefore = logicalLine.slice(
    vl.startOffset,
    vl.startOffset + visualOffset,
  );

  // Round to avoid subpixel rendering issues on Safari
  const cursorX = Math.round(PADDING_X + ctx.measureText(textBefore).width);
  const cursorY = Math.round(
    PADDING_Y + visualLine * LINE_HEIGHT - scrollOffset,
  );

  if (cursorY >= -LINE_HEIGHT && cursorY < height + LINE_HEIGHT) {
    ctx.fillStyle = isDark ? "#FFFFFF" : "#000000";
    ctx.fillRect(cursorX, cursorY + 2, 2, LINE_HEIGHT - 4);
  }
};

/** Render selection */
const renderSelection = (
  rc: RenderContext,
  state: EditorState,
  layout: Layout,
): void => {
  const { ctx, scrollOffset, isDark } = rc;

  const selStart = Math.min(state.cursor, state.anchor!);
  const selEnd = Math.max(state.cursor, state.anchor!);

  const startVis = posToVisual(layout, state.doc, selStart);
  const endVis = posToVisual(layout, state.doc, selEnd);

  ctx.fillStyle = isDark
    ? "rgba(59, 130, 246, 0.3)"
    : "rgba(59, 130, 246, 0.2)";
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;

  for (let i = startVis.visualLine; i <= endVis.visualLine; i++) {
    const vl = layout.lines[i];
    if (!vl) continue;

    // Get actual text from logical line
    const logicalLine = Doc.getLine(state.doc, vl.logicalLine);
    const vlText = logicalLine.slice(vl.startOffset, vl.endOffset);

    let lineSelStart = 0;
    let lineSelEnd = vlText.length;

    if (i === startVis.visualLine) {
      lineSelStart = startVis.visualOffset;
    }
    if (i === endVis.visualLine) {
      lineSelEnd = endVis.visualOffset;
    }

    const x1 = PADDING_X + ctx.measureText(vlText.slice(0, lineSelStart)).width;
    const x2 = PADDING_X + ctx.measureText(vlText.slice(0, lineSelEnd)).width;
    const y = PADDING_Y + i * LINE_HEIGHT - scrollOffset;

    ctx.fillRect(x1, y, Math.max(x2 - x1, 2), LINE_HEIGHT);
  }
};

// ============================================================================
// Component
// ============================================================================

export function CanvasEditor() {
  let canvasRef!: HTMLCanvasElement;
  let animationId: number;

  const [state, setState] = createSignal<EditorState>(createState(""));
  const [scrollOffset, setScrollOffset] = createSignal(0);

  onMount(() => {
    const ctx = canvasRef.getContext("2d", {
      alpha: false, // Opaque canvas for better performance
    });
    if (!ctx) return;

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dpr = window.devicePixelRatio || 1;

    // Track current scale to avoid re-scaling issues
    let currentScale = 1;

    const resize = () => {
      const width = window.innerWidth - 20;
      const height = window.innerHeight - 120;

      canvasRef.style.width = `${width}px`;
      canvasRef.style.height = `${height}px`;
      canvasRef.width = Math.floor(width * dpr);
      canvasRef.height = Math.floor(height * dpr);

      // Reset transform and apply fresh scale (Safari fix)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      currentScale = dpr;

      // Safari: Enable font smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
    };

    resize();
    window.addEventListener("resize", resize);

    // Cursor blink state
    let lastBlink = 0;
    let cursorVisible = true;
    const BLINK_INTERVAL = 530;

    const resetBlink = () => {
      cursorVisible = true;
      lastBlink = performance.now();
    };

    // Layout cache for dirty region optimization
    let layoutCache = createLayoutCache();

    const loop = (time: number) => {
      // Blink cursor
      if (time - lastBlink > BLINK_INTERVAL) {
        cursorVisible = !cursorVisible;
        lastBlink = time;
      }

      const currentState = state();
      const canvasWidth = canvasRef.width / dpr;
      const canvasHeight = canvasRef.height / dpr;
      const maxTextWidth = canvasWidth - PADDING_X * 2;

      // Get layout from cache (only recomputes if document changed)
      const { layout, cache: newCache } = getLayout(
        layoutCache,
        ctx,
        currentState,
        maxTextWidth,
      );
      layoutCache = newCache;

      // Calculate cursor visual position for scrolling
      const { visualLine } = posToVisual(
        layout,
        currentState.doc,
        currentState.cursor,
      );
      const newScrollOffset = calcScrollOffset(
        visualLine,
        scrollOffset(),
        canvasHeight,
      );

      if (newScrollOffset !== scrollOffset()) {
        setScrollOffset(newScrollOffset);
      }

      const rc: RenderContext = {
        ctx,
        width: canvasWidth,
        height: canvasHeight,
        dpr,
        isDark,
        scrollOffset: scrollOffset(),
        maxTextWidth,
      };

      render(rc, currentState, layout, cursorVisible);
      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);

    // Mouse state for drag selection
    let mouseState: MouseState = { isDragging: false, startPos: null };

    const getMousePos = (e: MouseEvent): { x: number; y: number } => {
      const rect = canvasRef.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const currentState = state();
      const { state: newState, handled } = handleKeyEvent(e, currentState);

      if (handled) {
        setState(newState);
        resetBlink();
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      canvasRef.focus();
      e.preventDefault();

      const { x, y } = getMousePos(e);
      const currentState = state();
      const canvasWidth = canvasRef.width / dpr;
      const maxTextWidth = canvasWidth - PADDING_X * 2;

      // Use cached layout
      const { layout, cache: newCache } = getLayout(
        layoutCache,
        ctx,
        currentState,
        maxTextWidth,
      );
      layoutCache = newCache;

      const pos = coordsToPos(
        ctx,
        layout,
        currentState.doc,
        x,
        y,
        scrollOffset(),
      );

      // Start drag selection
      mouseState = { isDragging: true, startPos: pos };

      // Set cursor position, clear selection unless shift is held
      if (e.shiftKey && currentState.anchor !== null) {
        // Extend existing selection
        setState({ ...currentState, cursor: pos });
      } else {
        // Start new selection/cursor position
        setState({ ...currentState, cursor: pos, anchor: null });
      }

      resetBlink();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseState.isDragging || mouseState.startPos === null) return;

      const { x, y } = getMousePos(e);
      const currentState = state();
      const canvasWidth = canvasRef.width / dpr;
      const maxTextWidth = canvasWidth - PADDING_X * 2;

      // Use cached layout
      const { layout, cache: newCache } = getLayout(
        layoutCache,
        ctx,
        currentState,
        maxTextWidth,
      );
      layoutCache = newCache;

      const pos = coordsToPos(
        ctx,
        layout,
        currentState.doc,
        x,
        y,
        scrollOffset(),
      );

      // Update selection: anchor stays at start, cursor follows mouse
      setState({
        ...currentState,
        cursor: pos,
        anchor: mouseState.startPos,
      });

      resetBlink();
    };

    const onMouseUp = () => {
      mouseState = { isDragging: false, startPos: null };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const canvasHeight = canvasRef.height / dpr;
      const maxTextWidth = canvasRef.width / dpr - PADDING_X * 2;

      // Use cached layout
      const { layout, cache: newCache } = getLayout(
        layoutCache,
        ctx,
        state(),
        maxTextWidth,
      );
      layoutCache = newCache;

      const maxScroll = Math.max(
        0,
        layout.totalLines * LINE_HEIGHT - canvasHeight + PADDING_Y * 4,
      );

      setScrollOffset((prev) =>
        Math.max(0, Math.min(prev + e.deltaY, maxScroll)),
      );
    };

    // Clipboard handlers
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      const text = getSelectedText(state());
      if (text && e.clipboardData) {
        e.clipboardData.setData("text/plain", text);
      }
    };

    const onCut = (e: ClipboardEvent) => {
      e.preventDefault();
      const currentState = state();
      const { text, state: newState } = cut(currentState);
      if (text && e.clipboardData) {
        e.clipboardData.setData("text/plain", text);
        setState(newState);
        resetBlink();
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain");
      if (text) {
        setState(insertText(state(), text));
        resetBlink();
      }
    };

    canvasRef.addEventListener("keydown", onKeyDown);
    canvasRef.addEventListener("mousedown", onMouseDown);
    canvasRef.addEventListener("mousemove", onMouseMove);
    canvasRef.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mouseup", onMouseUp); // Handle mouseup outside canvas
    canvasRef.addEventListener("wheel", onWheel, { passive: false });
    canvasRef.addEventListener("copy", onCopy);
    canvasRef.addEventListener("cut", onCut);
    canvasRef.addEventListener("paste", onPaste);
    canvasRef.focus();

    onCleanup(() => {
      cancelAnimationFrame(animationId);
      canvasRef.removeEventListener("keydown", onKeyDown);
      canvasRef.removeEventListener("mousedown", onMouseDown);
      canvasRef.removeEventListener("mousemove", onMouseMove);
      canvasRef.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mouseup", onMouseUp);
      canvasRef.removeEventListener("wheel", onWheel);
      canvasRef.removeEventListener("copy", onCopy);
      canvasRef.removeEventListener("cut", onCut);
      canvasRef.removeEventListener("paste", onPaste);
      window.removeEventListener("resize", resize);
    });
  });

  return (
    <div class="relative w-full h-full flex items-center overflow-hidden">
      <canvas
        ref={canvasRef}
        class="outline-none cursor-text"
        tabindex="0"
        style={{
          "image-rendering": "auto",
          "-webkit-font-smoothing": "antialiased",
          "-moz-osx-font-smoothing": "grayscale",
        }}
      />
    </div>
  );
}
