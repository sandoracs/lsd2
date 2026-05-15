import type { ColorFrame } from '@lsd2/protocol';

export type ReceiverStatus = 'disconnected' | 'connecting' | 'connected';

export interface WsReceiver {
  close(): void;
  onStatusChange: ((status: ReceiverStatus) => void) | null;
}

export function createWsReceiver(
  url: string,
  onFrame: (frame: ColorFrame) => void,
): WsReceiver {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const receiver: WsReceiver = {
    onStatusChange: null,
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
  };

  function connect() {
    if (closed) return;
    receiver.onStatusChange?.('connecting');
    ws = new WebSocket(url);

    ws.addEventListener('open', () => receiver.onStatusChange?.('connected'));

    ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (data.type === 'color_frame') onFrame(data as ColorFrame);
      } catch { /* ignore malformed */ }
    });

    ws.addEventListener('close', () => {
      if (closed) { receiver.onStatusChange?.('disconnected'); return; }
      receiver.onStatusChange?.('disconnected');
      reconnectTimer = setTimeout(connect, 1500);
    });
  }

  connect();
  return receiver;
}
