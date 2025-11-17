type PhoenixMessage<T = unknown> = [
  string | null,
  string | null,
  string,
  string,
  T,
];

type PhoenixReplyPayload<T = unknown> = {
  status: "ok" | "error";
  response: T;
};

type MessageCallback<T = unknown> = (payload: T) => void;
type ErrorCallback = (error: Error) => void;

type PendingCallbackEntry = {
  callback: MessageCallback<unknown>;
  timeoutId: number | null;
};

export type JoinResponse = {
  body: string;
};

export type SetBodyPayload = {
  id: string;
  body: string;
};

export type SetBodyResponse = {
  success: boolean;
};

export type NoteUpdatedPayload = {
  body: string;
  clock: Record<string, number>;
};

export type EventHandlers = Record<string, MessageCallback<any>>;

export interface ChannelCallbacks {
  onJoin?: (response: JoinResponse) => void;
  onJoinError?: (error: Error) => void;
  onError?: (error: Event) => void;
  onClose?: (event: CloseEvent) => void;
}

export interface PhoenixChannel {
  push: <TRequest = unknown, TResponse = unknown>(
    event: string,
    payload: TRequest,
  ) => Promise<TResponse>;
  leave: () => Promise<void>;
  on: <T = unknown>(event: string, callback: MessageCallback<T>) => void;
  off: (event: string) => void;
  disconnect: () => void;
}

interface ChannelState {
  socket: WebSocket | null;
  messageRef: number;
  topic: string;
  joinRef: string | null;
  pendingCallbacks: Map<string, PendingCallbackEntry>;
  eventHandlers: Map<string, MessageCallback<unknown>>;
  heartbeatTimer: number | null;
  reconnectTimer: number | null;
  reconnectAttempts: number;
  isIntentionallyClosed: boolean;
}

const HEARTBEAT_INTERVAL = 30000;
const MAX_RECONNECT_DELAY = 10000;
const DEFAULT_PUSH_TIMEOUT = 10000;

export function getWebsocketURL(): string {
  return `${import.meta.env.VITE_API_URL}/socket/notes/websocket`;
}

const getNextRef = (state: ChannelState): string => {
  return (++state.messageRef).toString();
};

const sendMessage = <T = unknown>(
  state: ChannelState,
  joinRef: string | null,
  msgRef: string | null,
  topic: string,
  event: string,
  payload: T,
): void => {
  if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
    throw new Error("WebSocket is not connected");
  }

  const message: PhoenixMessage<T> = [joinRef, msgRef, topic, event, payload];
  state.socket.send(JSON.stringify(message));
};

const addPendingCallback = (
  state: ChannelState,
  msgRef: string,
  callback: MessageCallback<unknown>,
  timeout = DEFAULT_PUSH_TIMEOUT,
): void => {
  let timeoutId: number | null = null;

  if (timeout > 0) {
    timeoutId = window.setTimeout(() => {
      state.pendingCallbacks.delete(msgRef);
      callback(new Error("Request timed out"));
    }, timeout);
  }

  state.pendingCallbacks.set(msgRef, { callback, timeoutId });
};

const takePendingCallback = (
  state: ChannelState,
  msgRef: string,
): MessageCallback<unknown> | null => {
  const entry = state.pendingCallbacks.get(msgRef);

  if (!entry) {
    return null;
  }

  if (entry.timeoutId) {
    clearTimeout(entry.timeoutId);
  }

  state.pendingCallbacks.delete(msgRef);
  return entry.callback;
};

const rejectAllPendingCallbacks = (state: ChannelState, error: Error): void => {
  state.pendingCallbacks.forEach((entry) => {
    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId);
    }

    entry.callback(error);
  });

  state.pendingCallbacks.clear();
};

const assignNewJoinRef = (state: ChannelState): string => {
  state.joinRef = getNextRef(state);
  return state.joinRef;
};

const getActiveJoinRef = (state: ChannelState): string => {
  if (!state.joinRef) {
    throw new Error("Channel has not joined");
  }

  return state.joinRef;
};

const handleMessage = (state: ChannelState, data: string): void => {
  try {
    const message: PhoenixMessage = JSON.parse(data);
    const [_joinRef, msgRef, _topic, event, payload] = message;

    if (msgRef) {
      const callback = takePendingCallback(state, msgRef);

      if (callback) {
        if (event === "phx_reply") {
          const replyPayload = payload as PhoenixReplyPayload;
          if (replyPayload.status === "ok") {
            callback(replyPayload.response);
          } else {
            callback(new Error(JSON.stringify(replyPayload.response)));
          }
        } else {
          callback(payload);
        }
        return;
      }
    }

    if (state.eventHandlers.has(event)) {
      const handler = state.eventHandlers.get(event);
      handler?.(payload);
    }
  } catch (error) {
    console.error("Error handling message:", error);
  }
};

const startHeartbeat = (state: ChannelState): void => {
  stopHeartbeat(state);

  state.heartbeatTimer = window.setInterval(() => {
    try {
      const msgRef = getNextRef(state);
      sendMessage(state, null, msgRef, "phoenix", "heartbeat", {});
    } catch (error) {
      console.error("Heartbeat error:", error);
    }
  }, HEARTBEAT_INTERVAL);
};

const stopHeartbeat = (state: ChannelState): void => {
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
};

const getReconnectDelay = (attempts: number): number => {
  return Math.min(1000 * Math.pow(2, attempts), MAX_RECONNECT_DELAY);
};

const joinChannel = (
  state: ChannelState,
  onSuccess: MessageCallback<JoinResponse>,
  onError: ErrorCallback,
): void => {
  const msgRef = getNextRef(state);
  const joinRef = assignNewJoinRef(state);

  addPendingCallback(state, msgRef, (response: unknown) => {
    if (response instanceof Error) {
      state.joinRef = null;
      onError(response);
    } else {
      onSuccess(response as JoinResponse);
    }
  });

  sendMessage(state, joinRef, msgRef, state.topic, "phx_join", {});
};

export async function websocketConnectFn(
  noteId: string,
  callbacks?: ChannelCallbacks,
  initialEventHandlers?: EventHandlers,
): Promise<PhoenixChannel> {
  const wsURL = getWebsocketURL();
  const channelCallbacks = callbacks || {};

  const state: ChannelState = {
    socket: null,
    messageRef: 0,
    topic: `note:${noteId}`,
    joinRef: null,
    pendingCallbacks: new Map<string, PendingCallbackEntry>(),
    eventHandlers: new Map(),
    heartbeatTimer: null,
    reconnectTimer: null,
    reconnectAttempts: 0,
    isIntentionallyClosed: false,
  };

  if (initialEventHandlers) {
    Object.entries(initialEventHandlers).forEach(([event, handler]) => {
      state.eventHandlers.set(event, handler);
    });
  }

  const scheduleReconnect = (): void => {
    if (state.reconnectTimer) return;

    const delay = getReconnectDelay(state.reconnectAttempts);
    console.log(
      `Reconnecting in ${delay}ms (attempt ${state.reconnectAttempts + 1})`,
    );

    state.reconnectTimer = window.setTimeout(() => {
      state.reconnectTimer = null;
      console.log("Attempting to reconnect...");
      connectWebSocket(state, wsURL, channelCallbacks).catch((error) => {
        console.error("Reconnection failed:", error);
      });
    }, delay);

    state.reconnectAttempts++;
  };

  const connectWebSocket = (
    state: ChannelState,
    wsURL: string,
    callbacks: ChannelCallbacks,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      state.isIntentionallyClosed = false;
      const socket = new WebSocket(`${wsURL}?vsn=2.0.0`);
      state.socket = socket;

      socket.onopen = () => {
        console.log("WebSocket connected");
        state.reconnectAttempts = 0;

        joinChannel(
          state,
          (response) => {
            startHeartbeat(state);
            callbacks.onJoin?.(response);
            resolve();
          },
          (error) => {
            stopHeartbeat(state);
            state.isIntentionallyClosed = true;
            state.socket?.close();
            callbacks.onJoinError?.(error);
            reject(error);
          },
        );
      };

      socket.onmessage = (event) => {
        handleMessage(state, event.data);
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        const err = new Error("WebSocket connection error");
        callbacks.onError?.(error);
        rejectAllPendingCallbacks(state, err);
        reject(err);
      };

      socket.onclose = (event) => {
        console.log("WebSocket closed:", event.code, event.reason);
        stopHeartbeat(state);
        const closeError = new Error(
          `WebSocket closed (${event.code ?? "unknown"})`,
        );
        rejectAllPendingCallbacks(state, closeError);
        state.joinRef = null;
        state.socket = null;
        callbacks.onClose?.(event);

        if (!state.isIntentionallyClosed) {
          scheduleReconnect();
        }
      };
    });
  };

  await connectWebSocket(state, wsURL, channelCallbacks);
  const push = <TRequest = unknown, TResponse = unknown>(
    event: string,
    payload: TRequest,
  ): Promise<TResponse> => {
    return new Promise((resolve, reject) => {
      const msgRef = getNextRef(state);

      addPendingCallback(state, msgRef, (response: unknown) => {
        if (response instanceof Error) {
          reject(response);
        } else {
          resolve(response as TResponse);
        }
      });

      sendMessage(
        state,
        getActiveJoinRef(state),
        msgRef,
        state.topic,
        event,
        payload,
      );
    });
  };

  return {
    push,

    leave: (): Promise<void> => {
      return new Promise((resolve, reject) => {
        state.isIntentionallyClosed = true;
        stopHeartbeat(state);

        if (state.reconnectTimer) {
          clearTimeout(state.reconnectTimer);
          state.reconnectTimer = null;
        }

        if (!state.socket || state.socket.readyState !== WebSocket.OPEN) {
          state.joinRef = null;
          resolve();
          return;
        }

        const msgRef = getNextRef(state);

        addPendingCallback(state, msgRef, (response: unknown) => {
          if (response instanceof Error) {
            reject(response);
          } else {
            state.joinRef = null;
            resolve();
          }
          state.socket?.close();
        });

        sendMessage(
          state,
          getActiveJoinRef(state),
          msgRef,
          state.topic,
          "phx_leave",
          {},
        );
      });
    },

    on: <T = unknown>(event: string, callback: MessageCallback<T>): void => {
      state.eventHandlers.set(event, callback as MessageCallback<unknown>);
    },

    off: (event: string): void => {
      state.eventHandlers.delete(event);
    },

    disconnect: (): void => {
      state.isIntentionallyClosed = true;
      stopHeartbeat(state);

      if (state.reconnectTimer) {
        clearTimeout(state.reconnectTimer);
        state.reconnectTimer = null;
      }

      rejectAllPendingCallbacks(state, new Error("Channel disconnected"));
      state.socket?.close();
      state.socket = null;
      state.joinRef = null;
      state.eventHandlers.clear();
    },
  };
}
