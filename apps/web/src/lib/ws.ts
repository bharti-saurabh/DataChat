import type { CollabClientMsg, CollabServerMsg } from "@datachat/shared";

type Listener = (msg: CollabServerMsg) => void;

class CollabSocket {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private roomId = "";
  private joinPayload: CollabClientMsg | null = null;

  connect(roomId: string, joinMsg: CollabClientMsg): void {
    this.disconnect();
    this.roomId     = roomId;
    this.joinPayload = joinMsg;
    this._open();
  }

  private _open(): void {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${location.host}/ws/${this.roomId}`;
    const ws = new WebSocket(url);
    this.socket = ws;

    ws.onopen = () => {
      if (this.joinPayload) ws.send(JSON.stringify(this.joinPayload));
    };

    ws.onmessage = (e) => {
      let msg: CollabServerMsg;
      try { msg = JSON.parse(String(e.data)) as CollabServerMsg; }
      catch { return; }
      this.listeners.forEach((fn) => fn(msg));
    };

    ws.onclose = () => {
      this.socket = null;
      // Reconnect after 3 s (only if we still have a room)
      if (this.roomId) {
        this.reconnectTimer = setTimeout(() => this._open(), 3_000);
      }
    };

    ws.onerror = () => ws.close();
  }

  disconnect(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.socket) { this.socket.onclose = null; this.socket.close(); this.socket = null; }
    this.roomId = "";
    this.joinPayload = null;
  }

  send(msg: CollabClientMsg): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get connected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
}

export const collabSocket = new CollabSocket();
