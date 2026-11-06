import type { RawMsg, SbType } from "./wire";

export type ConnState = "connecting" | "connected" | "reconnecting" | "offline";

export interface Transport {
  readonly kind: "nexconn" | "local";
  /** Connects and returns my user id. */
  connect(): Promise<string>;
  sendText(text: string, extra: string): Promise<RawMsg>;
  sendCustom(type: SbType, content: Record<string, unknown>): Promise<RawMsg>;
  /** Newest-first pages merged into one list (any order; the store sorts). */
  loadHistory(pages: number): Promise<RawMsg[]>;
  onMessages(cb: (msgs: RawMsg[]) => void): () => void;
  onStatus(cb: (s: ConnState) => void): () => void;
  close(): void;
}
