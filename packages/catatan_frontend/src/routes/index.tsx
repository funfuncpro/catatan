import { createFileRoute } from "@tanstack/solid-router";
import { Editor } from "~/components/editor";

export const Route = createFileRoute("/")({
  component: Login,
});

function Login() {
  return (
    <div class="relative w-full text-base">
      <Editor />
    </div>
  );
}
