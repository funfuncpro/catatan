import { createEditor, $getRoot, $createParagraphNode } from "lexical";
import { onMount, onCleanup, useContext } from "solid-js";
import {
  $convertToMarkdownString,
  $convertFromMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { createEmptyHistoryState, registerHistory } from "@lexical/history";
import { HeadingNode, QuoteNode, registerRichText } from "@lexical/rich-text";

import { mergeRegister } from "@lexical/utils";
import { EditorContext } from "~/context/editor";

interface EditorProps {
  readOnly?: boolean;
  initialContent?: string;
}

export function Editor(props: EditorProps) {
  const context = useContext(EditorContext);
  let editorRoot!: HTMLDivElement;

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

    editor.setRootElement(editorRoot);
    const historyState = createEmptyHistoryState();
    mergeRegister(
      registerRichText(editor),
      registerHistory(editor, historyState, 300),
    );

    // Explicitly set editable state
    editor.setEditable(!props.readOnly);

    // Initialize editor with content
    editor.update(() => {
      const root = $getRoot();
      root.clear(); // Clear any existing content
      
      // Use initialContent prop if provided, otherwise use context
      const initialMarkdown = props.initialContent ?? context?.markdown();
      if (initialMarkdown) {
        // Convert markdown to Lexical nodes
        $convertFromMarkdownString(initialMarkdown, TRANSFORMERS);
      } else {
        // If no content, add an empty paragraph
        if (root.isEmpty()) {
          root.append($createParagraphNode());
        }
      }
    });

    // Only register update listener if not in read-only mode
    let unregister: (() => void) | null = null;
    
    if (!props.readOnly && context) {
      unregister = editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const root = $getRoot();
          const textContent = root.getTextContent();
          const markdownContent = $convertToMarkdownString(TRANSFORMERS);

          context.setText(textContent);
          context.setMarkdown(markdownContent);
          context.setIsDirty(true);
          context.setLastChanged(new Date());
        });
      });
    }

    if (!props.readOnly) {
      editorRoot.focus();
    }
    
    onCleanup(() => {
      if (unregister) {
        unregister();
      }
      editor.setRootElement(null);
    });
  });

  return (
    <div
      ref={editorRoot}
      contenteditable={!props.readOnly}
      class={`w-full py-4 lg:px-10 px-5 text-base min-h-dvh focus:outline-none focus:ring-0 ${props.readOnly ? 'cursor-default select-text' : ''}`}
    ></div>
  );
}
