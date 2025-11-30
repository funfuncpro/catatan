import { EditorState, Doc, Node } from "../operation/index";
import { RenderContext, Layout, VisualLine, TextStyle } from "./type";
import {
  PADDING_X,
  PADDING_Y,
  LINE_HEIGHT,
  FONT_SIZE,
  FONT_FAMILY,
} from "./constant";
import { buildFont } from "./styles";
import { getVisibleRange } from "./viewport";
import { posToVisual } from "./layout";
import { Actor } from "~/types/actor";

export const renderVisualLine = (
  rc: RenderContext,
  state: EditorState,
  vl: VisualLine,
  y: number,
): void => {
  const { ctx, isDark } = rc;

  const root = state.doc.root;
  const node = root.children[vl.logicalLine];

  const logicalLine = Doc.getLine(state.doc, vl.logicalLine);
  const vlText = logicalLine.slice(vl.startOffset, vl.endOffset);

  if (Node.isParagraphNode(node)) {
    let x = PADDING_X;
    let charIndex = 0;

    for (const child of node.children) {
      if (Node.isTextNode(child)) {
        const childStart = charIndex;
        const childEnd = charIndex + child.text.length;

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

export const renderCursor = (
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

  const logicalLine = Doc.getLine(state.doc, vl.logicalLine);
  const textBefore = logicalLine.slice(
    vl.startOffset,
    vl.startOffset + visualOffset,
  );

  const cursorX = Math.round(PADDING_X + ctx.measureText(textBefore).width);
  const cursorY = Math.round(
    PADDING_Y + visualLine * LINE_HEIGHT - scrollOffset,
  );

  if (cursorY >= -LINE_HEIGHT && cursorY < height + LINE_HEIGHT) {
    ctx.fillStyle = isDark ? "#FFFFFF" : "#000000";
    ctx.fillRect(cursorX, cursorY + 2, 2, LINE_HEIGHT - 4);
  }
};

export type ElementToPositionFn = (
  afterElement: Actor.ElementId,
  offset: number,
) => number;

export const renderRemoteCursor = (
  rc: RenderContext,
  doc: Doc.Document,
  layout: Layout,
  cursor: Actor.Cursor,
  elementToPosition: ElementToPositionFn,
): void => {
  const { ctx, height, scrollOffset, isDark } = rc;

  const pos = elementToPosition(cursor.after_element, cursor.offset);

  const { visualLine, visualOffset } = posToVisual(layout, doc, pos);
  const vl = layout.lines[visualLine];
  if (!vl) return;

  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;

  const logicalLine = Doc.getLine(doc, vl.logicalLine);
  const textBefore = logicalLine.slice(
    vl.startOffset,
    vl.startOffset + visualOffset,
  );

  const cursorX = Math.round(PADDING_X + ctx.measureText(textBefore).width);
  const cursorY = Math.round(
    PADDING_Y + visualLine * LINE_HEIGHT - scrollOffset,
  );

  if (cursorY >= -LINE_HEIGHT && cursorY < height + LINE_HEIGHT) {
    ctx.fillStyle = cursor.color ?? (isDark ? "#FFFFFF4D" : "#0000004D");
    ctx.fillRect(cursorX, cursorY + 2, 2, LINE_HEIGHT - 4);
  }
};

export const renderSelection = (
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

export const render = (
  rc: RenderContext,
  state: EditorState,
  layout: Layout,
  cursorVisible: boolean,
  remoteCursors?: Record<string, Actor.Cursor>,
  elementToPosition?: ElementToPositionFn,
): void => {
  const { ctx, width, height, scrollOffset, isDark } = rc;

  ctx.fillStyle = isDark ? "#1a1a1a" : "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.textBaseline = "alphabetic";

  const { start, end } = getVisibleRange(rc, layout.totalLines);

  for (let i = start; i < end; i++) {
    const vl = layout.lines[i];
    if (!vl) continue;

    const y = PADDING_Y + i * LINE_HEIGHT - scrollOffset + FONT_SIZE;
    renderVisualLine(rc, state, vl, y);
  }

  if (state.anchor !== null && state.anchor !== state.cursor) {
    renderSelection(rc, state, layout);
  }

  if (remoteCursors && elementToPosition) {
    for (const cursor of Object.values(remoteCursors)) {
      renderRemoteCursor(rc, state.doc, layout, cursor, elementToPosition);
    }
  }

  if (cursorVisible) {
    renderCursor(rc, state, layout);
  }
};
