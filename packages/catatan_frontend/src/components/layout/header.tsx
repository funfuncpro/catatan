import { Link } from "@tanstack/solid-router";
import { useContext } from "solid-js";
import { WriterContext } from "~/context/writer";

export function Header() {
  const writerContext = useContext(WriterContext);

  return (
    <header class="fixed flex flex-row justify-between bg-background backdrop-blur-md w-full items-center py-4 lg:px-10 px-5 border-b z-20">
      <Link to="/">
        <span class="text-lg tracking-wide font-medium select-none">
          Catatan.
        </span>
      </Link>
    </header>
  );
}
