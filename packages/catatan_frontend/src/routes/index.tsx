import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/")({
  component: Login,
});

function Login() {
  return (
    <div class="relative w-full flex h-dvh flex-col items-center justify-center tracking-wide text-2xl">
      Catatan.
    </div>
  );
}
