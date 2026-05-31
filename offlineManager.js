// offlineManager.js  –  retries queued SOS every 30 seconds (Hour 25 requirement)
import { flushOfflineQueue } from './api';

let timer = null;

export function startOfflineRetry(onFlushed) {
  if (timer) return; // already running
  timer = setInterval(async () => {
    try {
      const sent = await flushOfflineQueue();
      if (sent > 0 && onFlushed) onFlushed(sent);
    } catch {}
  }, 30_000);
}

export function stopOfflineRetry() {
  clearInterval(timer);
  timer = null;
}
