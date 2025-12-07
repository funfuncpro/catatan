import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal, onMount } from "solid-js";
import { handleCallback } from "~/lib/auth";
import { useAuth } from "~/context/auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [error, setError] = createSignal<string | null>(null);
  const [isProcessing, setIsProcessing] = createSignal(true);

  onMount(async () => {
    try {
      // Get the code from URL query parameters
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");

      if (!code) {
        setError("No authorization code received");
        setIsProcessing(false);
        return;
      }

      // Exchange code for tokens
      const success = await handleCallback(code);

      if (success) {
        // Refresh auth state to pick up the new tokens
        await auth.refreshUser();

        // Redirect to home page after successful authentication
        navigate({ to: "/" });
      } else {
        setError("Failed to complete authentication");
        setIsProcessing(false);
      }
    } catch (err) {
      console.error("Callback error:", err);
      setError("An unexpected error occurred");
      setIsProcessing(false);
    }
  });

  return (
    <div class="flex min-h-screen items-center justify-center bg-white dark:bg-black">
      <div class="text-center">
        {isProcessing() ? (
          <>
            <div class="mb-4 text-2xl">Processing authentication...</div>
            <div class="text-gray-600 dark:text-gray-400">
              Please wait while we complete your login
            </div>
          </>
        ) : (
          <>
            <div class="mb-4 text-2xl text-red-600">Authentication Error</div>
            <div class="text-gray-600 dark:text-gray-400">{error()}</div>
            <button
              onClick={() => (window.location.href = "/")}
              class="mt-4 rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
            >
              Return Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
