import { RenderContext } from "./type";
import { LINE_HEIGHT, PADDING_Y } from "./constant";

export const getVisibleRange = (
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

export const calcScrollOffset = (
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
