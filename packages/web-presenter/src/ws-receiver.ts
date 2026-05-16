import type { ColorFrame, SessionConfig } from '@lsd2/protocol';

export type ReceiverStatus = 'disconnected' | 'connecting' | 'connected';

export interface WsReceiver {
  close(): void;
  send(data: object): void;
  onStatusChange: ((status: ReceiverStatus) => void) | null;
  onConfig: ((config: SessionConfig) => void) | null;
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
    onConfig: null,
    close() {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    },
    send(data: object) {
      console.log('[ws-receiver] send — readyState:', ws?.readyState, '(OPEN=1)');
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
    },
  };

  function connect() {
    if (closed) return;
    receiver.onStatusChange?.('connecting');
    ws = new WebSocket(url);

    ws.addEventListener('open', () => {
      receiver.onStatusChange?.('connected');
    });

    ws.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data as string) as { type: string };
        if (data.type === 'color_frame') onFrame(data as ColorFrame);
        else if (data.type === 'session_config') receiver.onConfig?.((data as { type: string; config: SessionConfig }).config);
      } catch {
        // Ignore malformed messages
      }
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
