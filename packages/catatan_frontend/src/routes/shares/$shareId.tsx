import { createFileRoute, redirect, useRouter } from "@tanstack/solid-router";
import { createResource, Show, onMount, useContext, createEffect } from "solid-js";
import { CanvasEditor } from "~/components/canvas-editor";
import StatusLine from "~/components/layout/statusline";
import { tokenStorage } from "~/lib/auth";
import { NotesContextProvider } from "~/context/notes";
import { YataContextProvider, YataContext } from "~/context/yata";
import { CursorContextProvider } from "~/context/cursor";
import { EditorSyncContextProvider } from "~/context/editor-sync";
import { WriterContextProvider } from "~/context/writer";
import { ConnectionContextProvider } from "~/context/connection";

// Response type from backend
interface SharedNoteResponse {
  success: boolean;
  message: string;
  data: {
    note_id: string;
    owner_id: string;
    content: string;
    permission_level: "read" | "write";
    created_at: string;
  };
}

export const Route = createFileRoute("/shares/$shareId")({
  loader: async ({ params }) => {
    console.log(`[Share Loader] Starting for shareId: ${params.shareId}`);
    const token = tokenStorage.getAccessToken();
    console.log(`[Share Loader] Token present: ${!!token}`);

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      console.log(`[Share Loader] Authorization header set.`);
    } else {
      console.log(`[Share Loader] No Authorization header.`);
    }

    try {
      const url = `http://localhost:8000/api/v1/shares/${params.shareId}`;
      console.log(`[Share Loader] Fetching: ${url}`);

      const response = await fetch(url, { headers });
      console.log(`[Share Loader] Response status: ${response.status}`);

      if (response.status === 401 || response.status === 403) {
        console.error(`[Share Loader] ${response.status} Forbidden/Unauthorized`);
        
        // If we are on the server (SSR) and get a 403/401, it might be because we don't have the token (localStorage).
        // We should NOT throw here, because it causes a 500 on the document request.
        // Instead, return a flag telling the client to try again.
        if (typeof window === "undefined") {
           console.log("[Share Loader] SSR 403/401 - Returning defer_to_client");
           return { 
             defer_to_client: true,
             note_id: "", // Placeholder
             owner_id: "",
             content: "",
             permission_level: "read" as const,
             created_at: ""
           };
        }

        // If 403/401 and not logged in (on client), redirect to login logic is handled by throwing
        if (!token) {
           throw new Error("UNAUTHORIZED"); 
        }
        throw new Error("FORBIDDEN");
      }

      if (response.status === 404) {
        console.error("[Share Loader] 404 Not Found");
        throw new Error("NOT_FOUND");
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Share Loader] Request failed with status ${response.status}:`, errorText);
        throw new Error("ERROR");
      }

      const data = (await response.json()) as SharedNoteResponse;
      console.log("[Share Loader] Data received:", data);
      return data.data;
    } catch (error) {
       console.error("[Share Loader] Exception caught:", error);
       // Pass error to component to handle UI
       throw error; 
    }
  },
  component: SharedNoteComponent,
  errorComponent: SharedNoteError,
});

function SharedNoteComponent() {
  const loaderData = Route.useLoaderData();
  const router = useRouter();

  // If we deferred from SSR, force a reload on mount (client-side) to get the token
  onMount(() => {
    // Check if loaderData has the defer_to_client flag (using type assertion or check)
    const data = loaderData();
    if ('defer_to_client' in data && data.defer_to_client) {
      console.log("[SharedNoteComponent] Detected SSR deferral. Invalidating router to retry with client token.");
      router.invalidate();
    }
  });

  const noteData = () => {
    const data = loaderData();
    // Return typed data only if not deferred
    if ('defer_to_client' in data && data.defer_to_client) {
        return undefined;
    }
    return data as SharedNoteResponse["data"];
  };

  return (
    <div class="flex flex-col relative w-full text-base min-h-screen">
      <Show when={noteData()} fallback={
         <div class="flex items-center justify-center min-h-screen">
            <div class="text-muted">Checking access permissions...</div>
        </div>
      }>
        {(note) => (
          <NotesContextProvider noteID={note().note_id}>
            <YataContextProvider>
              <CursorContextProvider>
                <EditorSyncContextProvider>
                  <WriterContextProvider>
                    <ConnectionContextProvider>
                      
                      {/* Custom Header for Shared View could go here */}
                      <div class="fixed top-0 left-0 w-full p-4 bg-background/80 backdrop-blur border-b z-10 flex justify-between items-center">
                        <span class="font-medium text-lg">Catatan Shared Note</span>
                        <span class="text-sm text-muted px-2 py-1 bg-secondary rounded border border-custom capitalize">
                          {note().permission_level} Access
                        </span>
                      </div>

                      <div class="relative w-full mt-16">
                         <CanvasEditor 
                            initialContent={note().content} 
                            readOnly={note().permission_level === 'read'}
                         />
                        <StatusLine />
                      </div>
                      
                      {/* Permission Handler: Update Context with permission level */}
                      <PermissionHandler permission={note().permission_level} />

                    </ConnectionContextProvider>
                  </WriterContextProvider>
                </EditorSyncContextProvider>
              </CursorContextProvider>
            </YataContextProvider>
          </NotesContextProvider>
        )}
      </Show>
    </div>
  );
}

// Helper to set permission in context (will implement in YataContext later)
function PermissionHandler(props: { permission: "read" | "write" }) {
  const yata = useContext(YataContext);
  
  createEffect(() => {
    if (yata && props.permission) {
      console.log("Setting Yata permission level:", props.permission);
      yata.setPermission(props.permission);
    }
  });
  
  return null;
}

function SharedNoteError({ error }: { error: Error }) {
  const msg = error.message;

  if (msg === "UNAUTHORIZED") {
    return (
        <div class="flex flex-col items-center justify-center min-h-screen gap-4">
            <h1 class="text-2xl font-bold">Login Required</h1>
            <p class="text-muted">You need to login to access this private note.</p>
            <button 
                onClick={() => window.location.href = "/"} // Or trigger login flow
                class="px-4 py-2 bg-primary text-background rounded"
            >
                Go to Login
            </button>
        </div>
    )
  }

  if (msg === "FORBIDDEN") {
    return (
      <div class="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 class="text-2xl font-bold text-red-500">Access Denied</h1>
        <p class="text-muted">You do not have permission to view this note.</p>
        <p class="text-sm text-muted">Contact the owner to request access.</p>
      </div>
    );
  }

  if (msg === "NOT_FOUND") {
    return (
      <div class="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 class="text-2xl font-bold">Note Not Found</h1>
        <p class="text-muted">The link might be invalid or the note has been deleted.</p>
      </div>
    );
  }

  return (
    <div class="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 class="text-2xl font-bold text-red-500">Something went wrong</h1>
      <p class="text-muted">We couldn't load the note. The server might be experiencing issues.</p>
      <div class="p-4 bg-secondary rounded border border-custom max-w-md w-full overflow-auto">
        <p class="text-xs font-mono text-muted mb-2">Error Details:</p>
        <pre class="text-xs text-red-400 whitespace-pre-wrap break-all">{error.message}</pre>
        <pre class="text-xs text-muted mt-2">Stack: {error.stack}</pre>
      </div>
      <button 
          onClick={() => window.location.reload()}
          class="px-4 py-2 bg-primary text-background rounded hover:opacity-90 transition-opacity"
      >
          Try Again
      </button>
      <button 
          onClick={() => window.location.href = "/"}
          class="text-sm text-muted hover:underline"
      >
          Go Home
      </button>
    </div>
  );
}
