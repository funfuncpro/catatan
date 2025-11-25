import { Notes } from "~/types/note";
import { websocketConnectFn } from "./websocket";

export async function createNotesChannel({
  noteID,
  setIsConnected,
}: {
  noteID: string;
  setIsConnected: (connected: boolean) => void;
}) {
  const connectionKey = `note:${noteID}`;

  try {
    const channel = await websocketConnectFn(connectionKey, {
      onJoin(response) {
        console.log("Connected to notes channel:", response.body);
        setIsConnected(true);
      },

      onJoinError: (error) => {
        console.error("Failed to join WebSocket channel:", error);
        setIsConnected(false);
      },
      onError: (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
      },
      onClose: (event) => {
        console.log("WebSocket closed:", event.code);
        setIsConnected(false);
      },
    });
    return channel;
  } catch (err) {
    console.error("Error connecting to notes channel:", err);
  }
}

export async function createNewNote() {
  return fetch(`${import.meta.env.VITE_API_URL}/api/v1/notes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("response was not ok");
      }
      let result = await response.json();
      if (result.success && result.data) {
        return {
          data: result.data as Notes,
          error: null,
        };
      }
      throw new Error(result.message || "Failed to create note");
    })
    .catch((error) => {
      console.error("Failed to create note:", error);
      return {
        data: null,
        error: error.message ?? "Failed to create note",
      };
    });
}
