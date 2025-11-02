import { createFileRoute } from "@tanstack/solid-router";
import { Editor } from "~/components/editor";
import { Header } from "~/components/layout/header";

export const Route = createFileRoute("/")({
  component: Login,
});

function Login() {
  return (
    <div class="flex flex-col relative w-full text-base ">
      <Header />
      <div class="relative w-full my-16">
        <Editor />
      </div>
    </div>
  );
}
