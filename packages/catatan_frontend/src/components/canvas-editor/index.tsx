import { onMount, onCleanup, createSignal, useContext } from "solid-js";
import {
  createState,
  handleKeyEvent,
  EditorState,
  getSelectedText,
  insertText,
  cut,
  Doc,
} from "./operation/index";
import { RenderContext, MouseState } from "./editor/type";
import { PADDING_X, PADDING_Y, LINE_HEIGHT } from "./editor/constant";
import {
  createLayoutCache,
  getLayout,
  coordsToPos,
  posToVisual,
} from "./editor/layout";
import { render } from "./editor/render";
import { calcScrollOffset } from "./editor/viewport";
import { CursorContext } from "~/context/cursor";

export function CanvasEditor() {
  let canvasRef!: HTMLCanvasElement;
  let animationId: number;

  const cursorContext = useContext(CursorContext);

  const [state, setState] = createSignal<EditorState>(createState(""));
  const [scrollOffset, setScrollOffset] = createSignal(0);

  // Helper function to update cursor position in context
  const updateCursorPosition = (editorState: EditorState) => {
    if (!cursorContext) return;

    const { doc, cursor } = editorState;
    const line = Doc.posToLine(doc, cursor) + 1; // 1-based line number
    const lineStart = Doc.lineToPos(doc, line - 1); // 0-based for lineToPos
    const column = cursor - lineStart + 1; // 1-based column number

    cursorContext.setLine(line);
    cursorContext.setColumn(column);
  };

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
        updateCursorPosition(newState);
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
        const newState = { ...currentState, cursor: pos };
        setState(newState);
        updateCursorPosition(newState);
      } else {
        // Start new selection/cursor position
        const newState = { ...currentState, cursor: pos, anchor: null };
        setState(newState);
        updateCursorPosition(newState);
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
      const newState = {
        ...currentState,
        cursor: pos,
        anchor: mouseState.startPos,
      };
      setState(newState);
      updateCursorPosition(newState);

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
        updateCursorPosition(newState);
        resetBlink();
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain");
      if (text) {
        const newState = insertText(state(), text);
        setState(newState);
        updateCursorPosition(newState);
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
