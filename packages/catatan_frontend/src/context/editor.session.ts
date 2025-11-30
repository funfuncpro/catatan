import { useSession } from "@tanstack/solid-start/server";

export interface EditorSession {
  note_id: string;
}

export function useEditorSession() {
  return useSession<EditorSession>({
    name: "editor_session",
    password: process.env.SESSION_SECRET ?? "0".repeat(32),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    },
    maxAge: 60 * 60 * 24 * 365,
  });
}
