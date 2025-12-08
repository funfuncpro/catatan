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
  timeoutId: ReturnType<typeof setTimeout> | null;
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

export type EventHandlers = Record<string, MessageCallback<unknown>>;

export interface ChannelCallbacks {
  onJoin?: (response: JoinResponse) => void;
  onJoinError?: (error: Error) => void;
  onError?: (error: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onReconnectFailed?: () => void;
}

export interface PushOptions {
  /** Whether to wait for a server reply. Defaults to true. */
  expectReply?: boolean;
}

export interface PhoenixChannel {
  push: <TRequest = unknown, TResponse = unknown>(
    event: string,
    payload: TRequest,
    options?: PushOptions,
  ) => Promise<TResponse | void>;
  leave: () => Promise<void>;
  on: <T = unknown>(event: string, callback: MessageCallback<T>) => void;
  off: (event: string) => void;
  disconnect: () => void;
  isConnected: () => boolean;
}

export interface WebSocketConfig {
  heartbeatInterval?: number;
  maxReconnectDelay?: number;
  pushTimeout?: number;
  maxReconnectAttempts?: number;
  heartbeatTimeout?: number;
  debug?: boolean;
  params?: Record<string, string>;
}

interface ChannelState {
  socket: WebSocket | null;
  messageRef: number;
  topic: string;
  joinRef: string | null;
  pendingCallbacks: Map<string, PendingCallbackEntry>;
  eventHandlers: Map<string, MessageCallback<unknown>>;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  heartbeatPendingRef: string | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
  isIntentionallyClosed: boolean;
  isConnecting: boolean;
  config: Required<WebSocketConfig>;
}

const DEFAULT_CONFIG: Required<WebSocketConfig> = {
  heartbeatInterval: 30000,
  maxReconnectDelay: 10000,
  pushTimeout: 10000,
  maxReconnectAttempts: 10,
  heartbeatTimeout: 10000,
  debug: false,
  params: {},
};

const createLogger = (debug: boolean) => ({
  log: (...args: unknown[]) => {
    if (debug) console.log("[WebSocket]", ...args);
  },
  error: (...args: unknown[]) => {
    if (debug) console.error("[WebSocket]", ...args);
  },
  warn: (...args: unknown[]) => {
    if (debug) console.warn("[WebSocket]", ...args);
  },
});

export function getWebsocketURL(): string {
  return `${import.meta.env.VITE_API_URL}/socket/notes/websocket`;
}

const getNextRef = (state: ChannelState): string => {
  return (++state.messageRef).toString();
};

const isSocketOpen = (state: ChannelState): boolean => {
  return state.socket !== null && state.socket.readyState === WebSocket.OPEN;
};

const sendMessage = <T = unknown>(
  state: ChannelState,
  joinRef: string | null,
  msgRef: string | null,
  topic: string,
  event: string,
  payload: T,
): void => {
  if (!isSocketOpen(state)) {
    throw new Error("WebSocket is not connected");
  }

  const message: PhoenixMessage<T> = [joinRef, msgRef, topic, event, payload];
  state.socket!.send(JSON.stringify(message));
};

const addPendingCallback = (
  state: ChannelState,
  msgRef: string,
  callback: MessageCallback<unknown>,
  timeout: number,
): void => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  if (timeout > 0) {
    timeoutId = setTimeout(() => {
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

const handleMessage = (
  state: ChannelState,
  data: string,
  logger: ReturnType<typeof createLogger>,
): void => {
  try {
    const message: PhoenixMessage = JSON.parse(data);
    const [_joinRef, msgRef, _topic, event, payload] = message;

    // Check if this is a heartbeat response
    if (
      msgRef &&
      state.heartbeatPendingRef &&
      msgRef === state.heartbeatPendingRef
    ) {
      state.heartbeatPendingRef = null;
      logger.log("Heartbeat acknowledged");
      return;
    }

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
    logger.error("Error handling message:", error);
  }
};

const startHeartbeat = (
  state: ChannelState,
  logger: ReturnType<typeof createLogger>,
  onHeartbeatTimeout: () => void,
): void => {
  stopHeartbeat(state);

  state.heartbeatTimer = setInterval(() => {
    // Check if previous heartbeat was not acknowledged
    if (state.heartbeatPendingRef !== null) {
      logger.warn("Heartbeat timeout - server not responding");
      onHeartbeatTimeout();
      return;
    }

    try {
      const msgRef = getNextRef(state);
      state.heartbeatPendingRef = msgRef;
      sendMessage(state, null, msgRef, "phoenix", "heartbeat", {});
      logger.log("Heartbeat sent");
    } catch (error) {
      logger.error("Heartbeat error:", error);
      state.heartbeatPendingRef = null;
    }
  }, state.config.heartbeatInterval);
};

const stopHeartbeat = (state: ChannelState): void => {
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
  state.heartbeatPendingRef = null;
};

const getReconnectDelay = (attempts: number, maxDelay: number): number => {
  return Math.min(1000 * Math.pow(2, attempts), maxDelay);
};

const joinChannel = (
  state: ChannelState,
  onSuccess: MessageCallback<JoinResponse>,
  onError: ErrorCallback,
  joinPayload: Record<string, unknown> = {},
): void => {
  const msgRef = getNextRef(state);
  const joinRef = assignNewJoinRef(state);

  addPendingCallback(
    state,
    msgRef,
    (response: unknown) => {
      if (response instanceof Error) {
        state.joinRef = null;
        onError(response);
      } else {
        onSuccess(response as JoinResponse);
      }
    },
    state.config.pushTimeout,
  );

  sendMessage(state, joinRef, msgRef, state.topic, "phx_join", joinPayload);
};

const cleanupState = (state: ChannelState): void => {
  stopHeartbeat(state);
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
  state.joinRef = null;
  state.socket = null;
  state.isConnecting = false;
};

export async function websocketConnectFn(
  url: string,
  topic: string,
  callbacks?: ChannelCallbacks,
  initialEventHandlers?: EventHandlers,
  joinPayload?: Record<string, unknown>,
  config?: WebSocketConfig,
): Promise<PhoenixChannel> {
  const channelCallbacks = callbacks || {};
  const mergedConfig: Required<WebSocketConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
  };
  const logger = createLogger(mergedConfig.debug);

  const state: ChannelState = {
    socket: null,
    messageRef: 0,
    topic: topic,
    joinRef: null,
    pendingCallbacks: new Map<string, PendingCallbackEntry>(),
    eventHandlers: new Map(),
    heartbeatTimer: null,
    heartbeatPendingRef: null,
    reconnectTimer: null,
    reconnectAttempts: 0,
    isIntentionallyClosed: false,
    isConnecting: false,
    config: mergedConfig,
  };

  if (initialEventHandlers) {
    Object.entries(initialEventHandlers).forEach(([event, handler]) => {
      state.eventHandlers.set(event, handler);
    });
  }

  const scheduleReconnect = (): void => {
    if (state.reconnectTimer || state.isIntentionallyClosed) return;

    if (state.reconnectAttempts >= state.config.maxReconnectAttempts) {
      logger.error(
        `Max reconnection attempts (${state.config.maxReconnectAttempts}) reached`,
      );
      channelCallbacks.onReconnectFailed?.();
      return;
    }

    const delay = getReconnectDelay(
      state.reconnectAttempts,
      state.config.maxReconnectDelay,
    );
    logger.log(
      `Reconnecting in ${delay}ms (attempt ${state.reconnectAttempts + 1}/${state.config.maxReconnectAttempts})`,
    );

    state.reconnectTimer = setTimeout(() => {
      state.reconnectTimer = null;
      logger.log("Attempting to reconnect...");
      connectWebSocket().catch((error) => {
        logger.error("Reconnection failed:", error);
      });
    }, delay);

    state.reconnectAttempts++;
  };

  const handleHeartbeatTimeout = (): void => {
    logger.warn("Closing connection due to heartbeat timeout");
    stopHeartbeat(state);
    state.socket?.close();
  };

  const connectWebSocket = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (state.isConnecting) {
        reject(new Error("Connection already in progress"));
        return;
      }

      state.isConnecting = true;
      state.isIntentionallyClosed = false;

      const queryParams = new URLSearchParams();
      queryParams.append("vsn", "2.0.0");
      
      if (state.config.params) {
        Object.entries(state.config.params).forEach(([key, value]) => {
          if (value) queryParams.append(key, value);
        });
      }

      const socket = new WebSocket(`${url}?${queryParams.toString()}`);
      state.socket = socket;

      let hasResolved = false;

      const resolveOnce = () => {
        if (!hasResolved) {
          hasResolved = true;
          state.isConnecting = false;
          resolve();
        }
      };

      const rejectOnce = (error: Error) => {
        if (!hasResolved) {
          hasResolved = true;
          state.isConnecting = false;
          reject(error);
        }
      };

      socket.onopen = () => {
        logger.log("WebSocket connected");
        state.reconnectAttempts = 0;

        joinChannel(
          state,
          (response) => {
            startHeartbeat(state, logger, handleHeartbeatTimeout);
            channelCallbacks.onJoin?.(response);
            resolveOnce();
          },
          (error) => {
            stopHeartbeat(state);
            state.isIntentionallyClosed = true;
            state.socket?.close();
            channelCallbacks.onJoinError?.(error);
            rejectOnce(error);
          },
          joinPayload || {},
        );
      };

      socket.onmessage = (event) => {
        handleMessage(state, event.data, logger);
      };

      socket.onerror = (error) => {
        logger.error("WebSocket error:", error);
        const err = new Error("WebSocket connection error");
        channelCallbacks.onError?.(error);
        rejectOnce(err);
      };

      socket.onclose = (event) => {
        logger.log("WebSocket closed:", event.code, event.reason);
        stopHeartbeat(state);
        const closeError = new Error(
          `WebSocket closed (${event.code ?? "unknown"})`,
        );
        rejectAllPendingCallbacks(state, closeError);
        state.joinRef = null;
        state.socket = null;
        state.isConnecting = false;
        channelCallbacks.onClose?.(event);

        if (!state.isIntentionallyClosed && hasResolved) {
          scheduleReconnect();
        }
      };
    });
  };

  await connectWebSocket();

  const push = <TRequest = unknown, TResponse = unknown>(
    event: string,
    payload: TRequest,
    options: PushOptions = {},
  ): Promise<TResponse | void> => {
    const { expectReply = true } = options;

    return new Promise((resolve, reject) => {
      if (!isSocketOpen(state)) {
        if (expectReply) {
          reject(new Error("WebSocket is not connected"));
        } else {
          resolve();
        }
        return;
      }

      // Fire-and-forget mode: send without waiting for reply
      if (!expectReply) {
        try {
          sendMessage(
            state,
            getActiveJoinRef(state),
            null, // No msgRef means no reply expected
            state.topic,
            event,
            payload,
          );
          resolve();
        } catch (error) {
          // Silently resolve - fire-and-forget operations are not critical
          resolve();
        }
        return;
      }

      const msgRef = getNextRef(state);

      addPendingCallback(
        state,
        msgRef,
        (response: unknown) => {
          if (response instanceof Error) {
            reject(response);
          } else {
            resolve(response as TResponse);
          }
        },
        state.config.pushTimeout,
      );

      try {
        sendMessage(
          state,
          getActiveJoinRef(state),
          msgRef,
          state.topic,
          event,
          payload,
        );
      } catch (error) {
        takePendingCallback(state, msgRef);
        reject(error);
      }
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

        if (!isSocketOpen(state)) {
          cleanupState(state);
          resolve();
          return;
        }

        const msgRef = getNextRef(state);

        addPendingCallback(
          state,
          msgRef,
          (response: unknown) => {
            const wasError = response instanceof Error;
            cleanupState(state);
            state.socket?.close();

            if (wasError) {
              reject(response);
            } else {
              resolve();
            }
          },
          state.config.pushTimeout,
        );

        try {
          sendMessage(
            state,
            getActiveJoinRef(state),
            msgRef,
            state.topic,
            "phx_leave",
            {},
          );
        } catch (error) {
          takePendingCallback(state, msgRef);
          cleanupState(state);
          reject(error);
        }
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

    isConnected: (): boolean => {
      return isSocketOpen(state) && state.joinRef !== null;
    },
  };
}
