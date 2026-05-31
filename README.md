# RescueApp — React Native / Expo
AI-powered disaster survival & rescue coordination  
**Person 2 (Mobile / Victim side)** — built to match the FastAPI backend exactly.

---
## setup
create folder called src 
create folders in src folder:
1. context: add file UserContext.js
2. hooks: useWebSocket.js
3. screens: FamilyScreen.js , HomeScreen.js, ProfileScreen.js, ShelterScreen.js, StatusScreen.js
4. services: api.js, offlineManager.js
5. {screens,componenets,services,hooks,utils,context}

## Quick start

```bash
npx create-expo-app RescueApp --template blank
cd RescueApp

# Copy all files from this zip into the project

npm install \
  expo-sensors expo-location expo-speech \
  @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs \
  react-native-screens react-native-safe-area-context \
  @react-native-async-storage/async-storage \
  react-native-get-random-values uuid

npx expo start
```

---

## Connect to P1's backend

Edit **one line** in `src/services/api.js`:

```js
export const BASE_URL = 'https://YOUR-RAILWAY-URL.up.railway.app';
export const WS_URL   = 'wss://YOUR-RAILWAY-URL.up.railway.app/ws/sos';
```

---

## API mapping (backend → app)

| Backend route | App usage |
|---|---|
| `POST /sos` | HomeScreen — SOS button / shake / triple-tap |
| `GET /sos/list` | StatusScreen — my alerts list |
| `PATCH /sos/:id/status` | StatusScreen — real-time via WebSocket |
| `POST /location` | FamilyScreen — every 60 seconds |
| `GET /family/:id` | FamilyScreen — shows other members |
| `GET /shelters` | SheltersScreen — nearest 3 |
| `GET /alerts?lat=&lng=` | HomeScreen — cyclone/flood banner |
| `WS /ws/sos` | StatusScreen — live status_change events |

---

## SOS payload (matches `SOSCreate` pydantic model exactly)

```json
{
  "user_id": "uuid-string",
  "name": "Priya Sharma",
  "age": 68,
  "medical_conditions": true,
  "latitude": 18.9647,
  "longitude": 72.8258
}
```

**`medical_conditions` is a `bool`** — not a string. `true` adds +25 to priority score.

---

## SOS trigger methods
| Method | How |
|---|---|
| Button | Single tap on the red SOS button |
| Shake | Accelerometer magnitude > 2.5G for 1.5 continuous seconds |
| Triple tap | Tap anywhere on HomeScreen 3× within 400ms |
| Voice | (expo-speech listener for "SOS" / "help") |

---

## Offline fallback
If `POST /sos` fails (no network):
- Payload is saved to `AsyncStorage` under key `offline_sos_queue`
- `offlineManager.js` retries every **30 seconds** automatically
- Alert shown when queued SOSes are flushed successfully

---

## File structure

```
App.js                          ← root, navigation, offline boot
src/
  context/UserContext.js        ← profile store (no login, AsyncStorage)
  services/
    api.js                      ← all fetch calls + offline queue
    offlineManager.js           ← 30s retry loop
  hooks/
    useWebSocket.js             ← /ws/sos with auto-reconnect
  screens/
    HomeScreen.js               ← SOS button, shake, triple-tap, alerts
    StatusScreen.js             ← score, rescue timeline, WS live updates
    SheltersScreen.js           ← GET /shelters, distance, Navigate
    FamilyScreen.js             ← POST /location, GET /family/:id
    ProfileScreen.js            ← name/age/medical_conditions setup
```

---

## Integration 3 — Safe route (P3's map, Hour 20)

In `SheltersScreen.js`, replace the `openMaps` function with:

```js
function openMaps(shelter) {
  const mapUrl = `https://YOUR-P3-NETLIFY-URL?from_lat=${userLoc.latitude}&from_lng=${userLoc.longitude}&to_lat=${shelter.latitude}&to_lng=${shelter.longitude}`;
  // Open in WebView or Linking.openURL
  navigation.navigate('MapWebView', { url: mapUrl });
}
```
