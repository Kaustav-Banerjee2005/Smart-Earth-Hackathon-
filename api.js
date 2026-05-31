// ─────────────────────────────────────────────
// api.js  –  All calls matched to main.py routes
// ─────────────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';

// Replace with your Railway/Render URL after deploy
export const BASE_URL = 'http://localhost:8000';
export const WS_URL   = 'ws://localhost:8000/ws/sos';

// ── POST /sos ─────────────────────────────────
// Payload matches SOSCreate pydantic model exactly
export async function postSOS(payload) {
  // payload: { user_id, name, age, medical_conditions, latitude, longitude }
  const res = await fetch(`${BASE_URL}/sos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`SOS failed: ${res.status}`);
  return res.json(); // returns { id, priority_score, status, ... }
}

// ── GET /sos/list ─────────────────────────────
export async function fetchSOSList() {
  const res = await fetch(`${BASE_URL}/sos/list`);
  if (!res.ok) throw new Error('Failed to fetch SOS list');
  return res.json();
}

// ── PATCH /sos/:id/status ─────────────────────
export async function updateSOSStatus(sosId, status) {
  const res = await fetch(`${BASE_URL}/sos/${sosId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }), // matches StatusUpdate model
  });
  if (!res.ok) throw new Error('Status update failed');
  return res.json();
}

// ── POST /location ────────────────────────────
// Matches LocationUpdate model: { user_id, family_id, latitude, longitude }
export async function postLocation(userId, familyId, latitude, longitude) {
  const res = await fetch(`${BASE_URL}/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, family_id: familyId, latitude, longitude }),
  });
  if (!res.ok) throw new Error('Location update failed');
  return res.json();
}

// ── GET /family/:family_id ────────────────────
export async function fetchFamilyLocations(familyId) {
  const res = await fetch(`${BASE_URL}/family/${familyId}`);
  if (!res.ok) throw new Error('Family fetch failed');
  return res.json();
}

// ── GET /shelters ─────────────────────────────
export async function fetchShelters() {
  const res = await fetch(`${BASE_URL}/shelters`);
  if (!res.ok) throw new Error('Shelters fetch failed');
  return res.json();
}

// ── GET /stats ────────────────────────────────
export async function fetchStats() {
  const res = await fetch(`${BASE_URL}/stats`);
  if (!res.ok) throw new Error('Stats fetch failed');
  return res.json();
}

// ── GET /alerts?lat=&lng= ─────────────────────
export async function fetchAlerts(lat, lng) {
  const res = await fetch(`${BASE_URL}/alerts?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error('Alerts fetch failed');
  return res.json();
}

// ─────────────────────────────────────────────
// OFFLINE QUEUE  (Hour 25 requirement)
// If POST /sos fails, save to AsyncStorage and retry every 30s
// ─────────────────────────────────────────────
const QUEUE_KEY = 'offline_sos_queue';

export async function queueOfflineSOS(payload) {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const queue = raw ? JSON.parse(raw) : [];
  queue.push({ ...payload, queued_at: Date.now() });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function flushOfflineQueue() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return;
  const queue = JSON.parse(raw);
  if (queue.length === 0) return;

  const remaining = [];
  for (const item of queue) {
    try {
      await postSOS(item);
    } catch {
      remaining.push(item); // keep failed ones for next retry
    }
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return queue.length - remaining.length; // how many were flushed
}

export async function getOfflineQueueCount() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw).length : 0;
}
