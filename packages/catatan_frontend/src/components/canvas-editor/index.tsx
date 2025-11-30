import {
  onMount,
  onCleanup,
  createSignal,
  useContext,
  createEffect,
} from "solid-js";
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
import { YataContext } from "~/context/yata";
import { EditorSyncContext } from "~/context/editor-sync";

export function CanvasEditor(props: { initialContent?: string }) {
  let canvasRef!: HTMLCanvasElement;
  let animationId: number;

  const cursorContext = useContext(CursorContext);
  const yataContext = useContext(YataContext);
  const editorSyncContext = useContext(EditorSyncContext);

  const [state, setState] = createSignal<EditorState>(
    createState(props.initialContent ?? ""),
  );
  const [scrollOffset, setScrollOffset] = createSignal(0);

  const updateCursorPosition = (editorState: EditorState) => {
    if (!cursorContext || !yataContext) return;

    const { cursor } = editorState;
    cursorContext.updateFromPosition(cursor, yataContext.positionToElement);
  };

  const applyAndSync = (
    oldState: EditorState,
    newState: EditorState,
    operationType: "insert" | "delete" | "replace",
    insertedText?: string,
    deleteElementIds?: string[],
  ) => {
    setState(newState);
    updateCursorPosition(newState);

    if (!editorSyncContext) return;

    const oldLength = Doc.length(oldState.doc);
    const newLength = Doc.length(newState.doc);

    if (operationType === "insert" && insertedText) {
      const insertPos = newState.cursor - insertedText.length;
      editorSyncContext.syncLocalInsert(insertPos, insertedText);
    } else if (operationType === "delete") {
      // Use pre-calculated element IDs if provided
      if (deleteElementIds && deleteElementIds.length > 0) {
        editorSyncContext.syncLocalDeleteByIds(deleteElementIds);
      } else {
        // Fallback to position-based delete (less reliable)
        const deleteCount = oldLength - newLength;
        if (deleteCount > 0) {
          const deletePos = newState.cursor;
          editorSyncContext.syncLocalDelete(deletePos, deleteCount);
        }
      }
    } else if (operationType === "replace" && insertedText) {
      const selStart = Math.min(
        oldState.cursor,
        oldState.anchor ?? oldState.cursor,
      );
      const selEnd = Math.max(
        oldState.cursor,
        oldState.anchor ?? oldState.cursor,
      );
      const deleteCount = selEnd - selStart;

      // For replace operations, use pre-calculated element IDs if provided
      if (deleteElementIds && deleteElementIds.length > 0) {
        editorSyncContext.syncLocalDeleteByIds(deleteElementIds);
      } else if (deleteCount > 0) {
        editorSyncContext.syncLocalDelete(selStart, deleteCount);
      }
      editorSyncContext.syncLocalInsert(selStart, insertedText);
    }
  };

  createEffect(() => {
    if (!editorSyncContext) return;

    const pendingOps = editorSyncContext.pendingRemoteOps();
    if (pendingOps.length === 0) return;

    let currentState = state();

    for (const op of pendingOps) {
      if (op.type === "insert") {
        currentState = {
          ...currentState,
          doc: Doc.insertAt(currentState.doc, op.pos, op.content),
          cursor:
            op.pos <= currentState.cursor
              ? currentState.cursor + op.content.length
              : currentState.cursor,
          anchor:
            currentState.anchor !== null && op.pos <= currentState.anchor
              ? currentState.anchor + op.content.length
              : currentState.anchor,
        };
      } else if (op.type === "delete") {
        const deleteEnd = op.pos + op.count;
        currentState = {
          ...currentState,
          doc: Doc.deleteRange(currentState.doc, op.pos, deleteEnd),
          cursor:
            currentState.cursor > deleteEnd
              ? currentState.cursor - op.count
              : currentState.cursor > op.pos
                ? op.pos
                : currentState.cursor,
          anchor:
            currentState.anchor !== null
              ? currentState.anchor > deleteEnd
                ? currentState.anchor - op.count
                : currentState.anchor > op.pos
                  ? op.pos
                  : currentState.anchor
              : null,
        };
      }
    }

    setState(currentState);
    editorSyncContext.clearPendingOps();
  });

  onMount(() => {
    const ctx = canvasRef.getContext("2d", {
      alpha: false,
    });
    if (!ctx) return;

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const width = window.innerWidth - 20;
      const height = window.innerHeight - 120;

      canvasRef.style.width = `${width}px`;
      canvasRef.style.height = `${height}px`;
      canvasRef.width = Math.floor(width * dpr);
      canvasRef.height = Math.floor(height * dpr);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
    };

    resize();
    window.addEventListener("resize", resize);

    let lastBlink = 0;
    let cursorVisible = true;
    const BLINK_INTERVAL = 530;

    const resetBlink = () => {
      cursorVisible = true;
      lastBlink = performance.now();
    };

    let layoutCache = createLayoutCache();

    const loop = (time: number) => {
      if (time - lastBlink > BLINK_INTERVAL) {
        cursorVisible = !cursorVisible;
        lastBlink = time;
      }

      const currentState = state();
      const canvasWidth = canvasRef.width / dpr;
      const canvasHeight = canvasRef.height / dpr;
      const maxTextWidth = canvasWidth - PADDING_X * 2;

      const { layout, cache: newCache } = getLayout(
        layoutCache,
        ctx,
        currentState,
        maxTextWidth,
      );
      layoutCache = newCache;

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

      render(
        rc,
        currentState,
        layout,
        cursorVisible,
        cursorContext?.remoteCursors(),
        yataContext?.elementToPosition,
      );
      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);

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
      const oldLength = Doc.length(currentState.doc);

      // handleKeyEvent now returns deleteRange metadata for CRDT sync
      const {
        state: newState,
        handled,
        deleteRange,
      } = handleKeyEvent(e, currentState);

      if (handled) {
        const newLength = Doc.length(newState.doc);
        resetBlink();

        if (newLength > oldLength) {
          const insertedLength = newLength - oldLength;
          const insertPos = newState.cursor - insertedLength;
          const insertedText = Doc.getText(newState.doc).slice(
            insertPos,
            insertPos + insertedLength,
          );
          applyAndSync(currentState, newState, "insert", insertedText);
        } else if (newLength < oldLength) {
          // Use deleteRange from handleKeyEvent to get element IDs for CRDT sync
          let deleteElementIds: string[] = [];
          if (deleteRange && editorSyncContext) {
            deleteElementIds = editorSyncContext.getDeleteTargetRange(
              deleteRange.start,
              deleteRange.count,
            );
          }
          applyAndSync(
            currentState,
            newState,
            "delete",
            undefined,
            deleteElementIds,
          );
        } else {
          setState(newState);
          updateCursorPosition(newState);
        }
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      canvasRef.focus();
      e.preventDefault();

      const { x, y } = getMousePos(e);
      const currentState = state();
      const canvasWidth = canvasRef.width / dpr;
      const maxTextWidth = canvasWidth - PADDING_X * 2;

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

      mouseState = { isDragging: true, startPos: pos };

      if (e.shiftKey && currentState.anchor !== null) {
        const newState = { ...currentState, cursor: pos };
        setState(newState);
        updateCursorPosition(newState);
      } else {
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

      // Pre-calculate delete targets for cut operation
      let deleteElementIds: string[] = [];
      if (editorSyncContext && currentState.anchor !== null) {
        const selStart = Math.min(currentState.cursor, currentState.anchor);
        const selEnd = Math.max(currentState.cursor, currentState.anchor);
        deleteElementIds = editorSyncContext.getDeleteTargetRange(
          selStart,
          selEnd - selStart,
        );
      }

      const { text, state: newState } = cut(currentState);
      if (text && e.clipboardData) {
        e.clipboardData.setData("text/plain", text);
        applyAndSync(
          currentState,
          newState,
          "delete",
          undefined,
          deleteElementIds,
        );
        resetBlink();
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      const text = e.clipboardData?.getData("text/plain");
      if (text) {
        const currentState = state();
        const hasSelection =
          currentState.anchor !== null &&
          currentState.anchor !== currentState.cursor;

        // Pre-calculate delete targets for replace operation
        let deleteElementIds: string[] = [];
        if (hasSelection && editorSyncContext) {
          const selStart = Math.min(currentState.cursor, currentState.anchor!);
          const selEnd = Math.max(currentState.cursor, currentState.anchor!);
          deleteElementIds = editorSyncContext.getDeleteTargetRange(
            selStart,
            selEnd - selStart,
          );
        }

        const newState = insertText(currentState, text);

        if (hasSelection) {
          applyAndSync(
            currentState,
            newState,
            "replace",
            text,
            deleteElementIds,
          );
        } else {
          applyAndSync(currentState, newState, "insert", text);
        }
        resetBlink();
      }
    };

    canvasRef.addEventListener("keydown", onKeyDown);
    canvasRef.addEventListener("mousedown", onMouseDown);
    canvasRef.addEventListener("mousemove", onMouseMove);
    canvasRef.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mouseup", onMouseUp);
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
