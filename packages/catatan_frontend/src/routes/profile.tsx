import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal, createEffect, Show } from "solid-js";
import { useAuth } from "~/context/auth";
import { getAuthHeader } from "~/lib/auth";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

interface ProfileData {
  user: {
    user_id: string;
    email: string;
    external_id: string;
  };
}

function ProfilePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [profileData, setProfileData] = createSignal<ProfileData | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);

  createEffect(() => {
    // Redirect to home if not authenticated
    if (!auth.isLoading() && !auth.isAuthenticated()) {
      navigate({ to: "/" });
    }
  });

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const headers = getAuthHeader();

      if (!headers) {
        setError("No authentication token found");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/profile`,
        {
          headers,
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch profile");
        return;
      }

      const data = await response.json();
      if (data.success && data.data) {
        setProfileData(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  createEffect(() => {
    if (auth.isAuthenticated()) {
      fetchProfile();
    }
  });

  return (
    <div class="flex min-h-screen items-center justify-center bg-white p-4 dark:bg-black">
      <div class="w-full max-w-2xl rounded-lg border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-black">
        <h1 class="mb-6 text-3xl font-bold">Profile</h1>

        <Show when={isLoading()}>
          <div class="text-gray-600 dark:text-gray-400">Loading profile...</div>
        </Show>

        <Show when={error()}>
          <div class="rounded bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error()}
          </div>
        </Show>

        <Show when={!isLoading() && !error() && profileData()}>
          <div class="space-y-6">
            <div>
              <h2 class="mb-4 text-xl font-semibold">
                Authentication Status: ✅ Authenticated
              </h2>
            </div>

            <div class="space-y-4">
              <div class="rounded border border-gray-200 p-4 dark:border-gray-800">
                <div class="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                  User ID
                </div>
                <div class="font-mono text-sm">
                  {profileData()?.user.user_id}
                </div>
              </div>

              <div class="rounded border border-gray-200 p-4 dark:border-gray-800">
                <div class="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                  Email
                </div>
                <div class="text-lg">{profileData()?.user.email}</div>
              </div>

              <div class="rounded border border-gray-200 p-4 dark:border-gray-800">
                <div class="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                  External ID
                </div>
                <div class="font-mono text-sm">
                  {profileData()?.user.external_id || "(empty)"}
                </div>
              </div>
            </div>

            <div class="space-y-3">
              <h3 class="text-lg font-semibold">Token Information</h3>
              <div class="rounded border border-gray-200 p-4 dark:border-gray-800">
                <div class="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                  JWT Claims (from client)
                </div>
                <div class="text-sm">
                  <div>Email: {auth.user()?.email}</div>
                  <div>External ID: {profileData()?.user.external_id  || "(empty)"}</div>
                </div>
              </div>
            </div>

            <div class="flex gap-4">
              <button
                onClick={() => navigate({ to: "/" })}
                class="rounded bg-gray-200 px-4 py-2 text-black hover:bg-gray-300 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
              >
                Back to Home
              </button>
              <button
                onClick={() => fetchProfile()}
                class="rounded bg-black px-4 py-2 text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              >
                Refresh Profile
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
