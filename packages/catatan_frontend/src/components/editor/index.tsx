import { createEditor, $getRoot, $createParagraphNode } from "lexical";
import { createSignal, onMount, onCleanup } from "solid-js";
import { $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { createEmptyHistoryState, registerHistory } from "@lexical/history";
import { HeadingNode, QuoteNode, registerRichText } from "@lexical/rich-text";

import { mergeRegister } from "@lexical/utils";

export function Editor() {
  let editorRoot!: HTMLDivElement;
  const [_text, setText] = createSignal("");
  const [_markdown, setMarkdown] = createSignal("");

  onMount(() => {
    if (!editorRoot) return;
    const editor = createEditor({
      namespace: "main-editor",
      nodes: [HeadingNode, QuoteNode],
      theme: {
        paragraph: "editor-paragraph",
      },
      editable: true,
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

    editor.update(() => {
      const root = $getRoot();
      if (root.isEmpty()) {
        root.append($createParagraphNode());
      }
    });

    const unregister = editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const root = $getRoot();
        setText(root.getTextContent());
        const markdownContent = $convertToMarkdownString(TRANSFORMERS);
        setMarkdown(markdownContent);
      });
    });

    editorRoot.focus();
    onCleanup(() => {
      unregister();
      editor.setRootElement(null);
    });
  });

  return (
    <div
      ref={editorRoot}
      contenteditable
      class="w-full py-4 lg:px-10 px-5 text-base min-h-dvh focus:outline-none focus:ring-0"
    ></div>
  );
}
