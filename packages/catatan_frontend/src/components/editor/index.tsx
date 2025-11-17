import { createEditor, $getRoot, $createParagraphNode } from "lexical";
import type { LexicalEditor } from "lexical";
import { onMount, onCleanup, useContext, createEffect } from "solid-js";
import {
  $convertToMarkdownString,
  $convertFromMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { createEmptyHistoryState, registerHistory } from "@lexical/history";
import { HeadingNode, QuoteNode, registerRichText } from "@lexical/rich-text";

import { mergeRegister } from "@lexical/utils";
import { EditorContext } from "~/context/editor-client";
import { SetBodyPayload, SetBodyResponse } from "~/lib/websocket";

interface EditorProps {
  readOnly?: boolean;
  initialContent?: string;
}

export function Editor(props: EditorProps) {
  const context = useContext(EditorContext);
  let editorRoot!: HTMLDivElement;
  let editorInstance: LexicalEditor | null = null;
  let lastAppliedMarkdown: string | null = null;
  let skipNextMarkdownSync = false;

  onMount(() => {
    if (!editorRoot) return;

    const editor = createEditor({
      namespace: "main-editor",
      nodes: [HeadingNode, QuoteNode],
      theme: {
        paragraph: "editor-paragraph",
      },
      editable: !props.readOnly,
      onError(error) {
        console.error(error);
      },
    });

    editorInstance = editor;
    editor.setRootElement(editorRoot);
    const historyState = createEmptyHistoryState();
    mergeRegister(
      registerRichText(editor),
      registerHistory(editor, historyState, 300),
    );

    editor.setEditable(!props.readOnly);

    const initialMarkdown = props.initialContent ?? context?.markdown();

    editor.update(() => {
      const root = $getRoot();
      root.clear();

      if (initialMarkdown) {
        $convertFromMarkdownString(initialMarkdown, TRANSFORMERS);
      } else {
        if (root.isEmpty()) {
          root.append($createParagraphNode());
        }
      }
    });

    lastAppliedMarkdown = initialMarkdown ?? "";

    let unregister: (() => void) | null = null;
    let sendTimeout: number | null = null;

    if (!props.readOnly && context) {
      unregister = editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const root = $getRoot();
          const textContent = root.getTextContent();
          const markdownContent = $convertToMarkdownString(TRANSFORMERS);

          skipNextMarkdownSync = true;
          lastAppliedMarkdown = markdownContent;

          context.setText(textContent);
          context.setMarkdown(markdownContent);
          context.setIsDirty(true);
          context.setLastChanged(new Date());

          if (sendTimeout) {
            clearTimeout(sendTimeout);
          }

          sendTimeout = window.setTimeout(async () => {
            const currentChannel = context.channel();
            const currentNoteId = context.noteId();

            if (currentChannel && currentNoteId && context.isConnected()) {
              try {
                await currentChannel.push<SetBodyPayload, SetBodyResponse>(
                  "set_body",
                  {
                    id: currentNoteId,
                    body: markdownContent,
                  },
                );
                context.setLastSaved(new Date());
                context.setIsDirty(false);
              } catch (error) {
                console.error("Failed to send update via WebSocket:", error);
              }
            }
          }, 300);
        });
      });
    }

    if (!props.readOnly) {
      editorRoot.focus();
    }

    onCleanup(() => {
      if (sendTimeout) {
        clearTimeout(sendTimeout);
      }
      if (unregister) {
        unregister();
      }
      editor.setRootElement(null);
      editorInstance = null;
    });
  });

  createEffect(() => {
    if (!context) return;
    const latestMarkdown = context.markdown();
    if (!editorInstance) return;

    if (skipNextMarkdownSync) {
      skipNextMarkdownSync = false;
      return;
    }

    if (latestMarkdown === lastAppliedMarkdown) {
      return;
    }

    editorInstance.update(() => {
      const root = $getRoot();
      root.clear();

      if (latestMarkdown) {
        $convertFromMarkdownString(latestMarkdown, TRANSFORMERS);
      } else {
        root.append($createParagraphNode());
      }
    });

    lastAppliedMarkdown = latestMarkdown ?? "";
  });

  return (
    <div
      ref={editorRoot}
      contenteditable={!props.readOnly}
      class={`w-full py-4 lg:px-10 px-5 text-base min-h-dvh focus:outline-none focus:ring-0 ${props.readOnly ? "cursor-default select-text" : ""}`}
    ></div>
  );
}
