// useWebSocket.js – connects to backend /ws/sos
// Broadcasts: { event: "new_sos", data: {...} }
//             { event: "status_change", data: {...} }
import { useEffect, useRef, useCallback } from 'react';
import { WS_URL } from '../services/api';

export function useWebSocket(onMessage) {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      console.log('[WS] Connected to /ws/sos');
      clearTimeout(reconnectTimer.current);
    };

    ws.current.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        onMessage(msg); // { event, data }
      } catch {}
    };

    ws.current.onclose = () => {
      console.log('[WS] Disconnected — retrying in 5s');
      reconnectTimer.current = setTimeout(connect, 5000);
    };

    ws.current.onerror = (err) => {
      console.error('[WS] Error:', err);
      ws.current.close();
    };
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  // Send a keep-alive ping so server keeps connection open
  useEffect(() => {
    const ping = setInterval(() => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send('ping');
      }
    }, 25000);
    return () => clearInterval(ping);
  }, []);
}
