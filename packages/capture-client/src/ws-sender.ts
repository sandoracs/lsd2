import type { NoteFrame } from '@lsd2/protocol';

export type SenderStatus = 'disconnected' | 'connecting' | 'connected';

export interface WsSender {
  send(frame: NoteFrame): void;
  close(): void;
  onStatusChange: ((status: SenderStatus) => void) | null;
}

export function createWsSender(url: string): WsSender {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  const queue: string[] = [];

  const sender: WsSender = {
    onStatusChange: null,

    send(frame: NoteFrame) {
      const json = JSON.stringify(frame);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(json);
      } else if (queue.length < 5) {
        // Buffer a small number of frames while connecting; drop the rest
        queue.push(json);
      }
    },

    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };

  function connect() {
    if (closed) return;
    sender.onStatusChange?.('connecting');
    ws = new WebSocket(url);

    ws.addEventListener('open', () => {
      sender.onStatusChange?.('connected');
      while (queue.length > 0) ws!.send(queue.shift()!);
    });

    ws.addEventListener('close', () => {
      if (closed) { sender.onStatusChange?.('disconnected'); return; }
      sender.onStatusChange?.('disconnected');
      reconnectTimer = setTimeout(connect, 1000);
    });
  }

  connect();
  return sender;
}
