export const SESSION_KEY = "sessionActive" as const;
export const CONTENT_SCRIPT_ID = "dragtowhatever-overlay" as const;
export const OVERLAY_HOST_ID = "dragtowhatever-host" as const;

export const MSG = {
  TEARDOWN: "dragtowhatever:teardown",
  SESSION_STATE: "dragtowhatever:session-state",
  PING: "dragtowhatever:ping",
} as const;

export type TeardownMessage = { type: typeof MSG.TEARDOWN };
export type SessionStateMessage = {
  type: typeof MSG.SESSION_STATE;
  active: boolean;
};
export type PingMessage = { type: typeof MSG.PING };

export type ExtensionMessage =
  | TeardownMessage
  | SessionStateMessage
  | PingMessage;
