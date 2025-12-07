import { Link } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { useAuth } from "~/context/auth";
import { login } from "~/lib/auth";

export function Header() {
  const auth = useAuth();

  const testAuth = async () => {
    console.log("testAuth called");
    const token = localStorage.getItem("catatan_access_token");
    if (!token) {
      console.error("No access token found");
      return;
    }

    try {
      console.log("Sending request to /api/v1/test-auth");
      const response = await fetch("http://localhost:8000/api/v1/test-auth", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      console.log("Test auth response:", data);
    } catch (error) {
      console.error("Test auth error:", error);
    }
  };

  return (
    <header class="fixed flex flex-row justify-between bg-background backdrop-blur-md w-full items-center py-4 lg:px-10 px-5 border-b z-20">
      <Link to="/">
        <span class="text-lg tracking-wide font-medium select-none">
          Catatan.
        </span>
      </Link>

      <div class="flex items-center gap-4">
        <Show
          when={auth.isAuthenticated()}
          fallback={
            <button
              onClick={() => login()}
              class="px-4 py-2 text-sm font-medium bg-black text-white dark:bg-white dark:text-black hover:opacity-80 transition-opacity rounded"
            >
              Login
            </button>
          }
        >
          <div class="flex items-center gap-4">
            <button
              onClick={testAuth}
              class="text-sm text-muted hover:text-foreground transition-colors cursor-pointer"
            >
              {auth.user()?.email}
            </button>
            <button
              onClick={() => auth.logout()}
              class="px-4 py-2 text-sm font-medium border border-custom hover:bg-secondary transition-colors rounded"
            >
              Logout
            </button>
          </div>
        </Show>
      </div>
    </header>
  );
}
