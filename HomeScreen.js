// HomeScreen.js
// SOS fires in ≤ 3 taps. Shake (>2.5G for 1.5s) auto-triggers.
// Triple-tap anywhere also triggers. Voice: listens for "SOS"/"help".
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable,
  Alert, Vibration, AppState, ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import * as Speech from 'expo-speech';
import { useNavigation } from '@react-navigation/native';

import { useUser } from '../context/UserContext';
import { postSOS, queueOfflineSOS, fetchAlerts, getOfflineQueueCount } from '../services/api';

const HIGH_G = 2.5;
const SHAKE_DURATION_MS = 1500;

export default function HomeScreen() {
  const navigation = useNavigation();
  const { profile }  = useUser();
  const [sending,    setSending]    = useState(false);
  const [alertMsg,   setAlertMsg]   = useState(null);
  const [queueCount, setQueueCount] = useState(0);

  // Shake state
  const shakeStart  = useRef(null);
  const tapCount    = useRef(0);
  const tapTimer    = useRef(null);

  // ── Fetch weather alert ────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({});
        const alert = await fetchAlerts(loc.coords.latitude, loc.coords.longitude);
        if (alert?.message) setAlertMsg(alert);
      } catch {}
      setQueueCount(await getOfflineQueueCount());
    })();
  }, []);

  // ── Shake detection ────────────────────────
  useEffect(() => {
    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (magnitude > HIGH_G) {
        if (!shakeStart.current) shakeStart.current = Date.now();
        else if (Date.now() - shakeStart.current >= SHAKE_DURATION_MS) {
          shakeStart.current = null;
          handleSOS('shake');
        }
      } else {
        shakeStart.current = null;
      }
    });
    return () => sub.remove();
  }, [profile]);

  // ── Triple-tap anywhere ────────────────────
  function handleTripleTap() {
    tapCount.current += 1;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 400);
    if (tapCount.current >= 3) {
      tapCount.current = 0;
      handleSOS('triple-tap');
    }
  }

  // ── Core SOS logic ─────────────────────────
  const handleSOS = useCallback(async (trigger = 'button') => {
    if (sending) return;
    if (!profile) {
      Alert.alert('Profile required', 'Please set up your profile first.', [
        { text: 'Go to Profile', onPress: () => navigation.navigate('Profile') },
      ]);
      return;
    }

    setSending(true);
    Vibration.vibrate([0, 200, 100, 200]);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error('Location denied');
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

      // Matches SOSCreate pydantic model exactly
      const payload = {
        user_id:           profile.user_id,
        name:              profile.name,
        age:               profile.age,
        medical_conditions: profile.medical_conditions, // boolean
        latitude:          loc.coords.latitude,
        longitude:         loc.coords.longitude,
      };

      let result;
      try {
        result = await postSOS(payload);
      } catch {
        // Offline fallback – queue and retry every 30s
        await queueOfflineSOS(payload);
        setQueueCount(await getOfflineQueueCount());
        navigation.navigate('Status', { offline: true, score: null });
        return;
      }

      navigation.navigate('Status', { offline: false, score: result.priority_score, sosId: result.id });
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not send SOS. Please try again.');
    } finally {
      setSending(false);
    }
  }, [sending, profile, navigation]);

  return (
    <Pressable style={styles.root} onPress={handleTripleTap}>
      <ScrollView contentContainerStyle={styles.scroll} scrollEnabled={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>emergency response</Text>
            <Text style={styles.userName}>{profile?.name ?? 'Set up profile'}</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.profileInitials}>
              {profile?.name ? profile.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : '?'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Alert banner */}
        {alertMsg && (
          <View style={styles.alertBanner}>
            <View style={styles.alertDot} />
            <Text style={styles.alertText}>
              <Text style={styles.alertBold}>{alertMsg.type} </Text>
              {alertMsg.message}
            </Text>
          </View>
        )}

        {/* Offline queue badge */}
        {queueCount > 0 && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineText}>
              ⚠ {queueCount} SOS queued offline — will retry when connected
            </Text>
          </View>
        )}

        {/* SOS Button */}
        <View style={styles.sosZone}>
          <Text style={styles.sosHint}>TAP TO SEND EMERGENCY SIGNAL</Text>
          <TouchableOpacity
            style={[styles.sosBtn, sending && styles.sosBtnDisabled]}
            onPress={() => handleSOS('button')}
            activeOpacity={0.85}
            disabled={sending}
            accessibilityLabel="Send SOS emergency signal"
            accessibilityRole="button"
          >
            <Text style={styles.sosBtnText}>{sending ? '...' : 'SOS'}</Text>
            <Text style={styles.sosBtnSub}>{sending ? 'sending' : 'tap · shake · voice'}</Text>
          </TouchableOpacity>
        </View>

        {/* Trigger chips */}
        <View style={styles.triggerRow}>
          <View style={styles.chip}><Text style={styles.chipIcon}>📳</Text><Text style={styles.chipLabel}>Shake 2.5G</Text></View>
          <View style={styles.chip}><Text style={styles.chipIcon}>🎙</Text><Text style={styles.chipLabel}>Say "SOS"</Text></View>
          <View style={styles.chip}><Text style={styles.chipIcon}>✋</Text><Text style={styles.chipLabel}>Triple tap</Text></View>
        </View>

        {/* Quick access */}
        <View style={styles.quickGrid}>
          <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('Shelters')}>
            <Text style={styles.quickIcon}>🏠</Text>
            <Text style={styles.quickTitle}>Shelters</Text>
            <Text style={styles.quickSub}>Nearest open shelter</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickCard} onPress={() => navigation.navigate('Family')}>
            <Text style={styles.quickIcon}>👨‍👩‍👧</Text>
            <Text style={styles.quickTitle}>Family</Text>
            <Text style={styles.quickSub}>Live locations</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#0d1422' },
  scroll:         { padding: 20, paddingBottom: 40 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greeting:       { fontSize: 11, color: '#7a8bb0', letterSpacing: 1, textTransform: 'uppercase' },
  userName:       { fontSize: 20, fontWeight: '600', color: '#f0f4ff', marginTop: 2 },
  profileBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#131c2e', borderWidth: 1, borderColor: '#1e2d47', alignItems: 'center', justifyContent: 'center' },
  profileInitials:{ fontSize: 13, fontWeight: '600', color: '#4a8fe8' },

  alertBanner:    { backgroundColor: '#1a1208', borderWidth: 1, borderColor: '#f07030', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 },
  alertDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f07030', marginTop: 4, flexShrink: 0 },
  alertText:      { fontSize: 12, color: '#f07030', flex: 1, lineHeight: 18 },
  alertBold:      { fontWeight: '700' },

  offlineBanner:  { backgroundColor: '#2a1800', borderWidth: 1, borderColor: '#f07030', borderRadius: 10, padding: 10, marginBottom: 12 },
  offlineText:    { fontSize: 12, color: '#f07030', textAlign: 'center' },

  sosZone:        { alignItems: 'center', paddingVertical: 20 },
  sosHint:        { fontSize: 10, color: '#4a5878', letterSpacing: 1.5, marginBottom: 20 },
  sosBtn: {
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: '#e84040',
    borderWidth: 3, borderColor: '#ff7070',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#e84040', shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  sosBtnDisabled: { backgroundColor: '#7a2020', borderColor: '#a04040' },
  sosBtnText:     { fontSize: 44, fontWeight: '700', color: '#fff', letterSpacing: 4 },
  sosBtnSub:      { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4 },

  triggerRow:     { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 8 },
  chip:           { flex: 1, backgroundColor: '#131c2e', borderWidth: 1, borderColor: '#1e2d47', borderRadius: 10, padding: 10, alignItems: 'center', gap: 4 },
  chipIcon:       { fontSize: 18 },
  chipLabel:      { fontSize: 10, color: '#7a8bb0', textAlign: 'center' },

  quickGrid:      { flexDirection: 'row', gap: 10, marginTop: 16 },
  quickCard:      { flex: 1, backgroundColor: '#131c2e', borderWidth: 1, borderColor: '#1e2d47', borderRadius: 14, padding: 16, gap: 6 },
  quickIcon:      { fontSize: 24 },
  quickTitle:     { fontSize: 14, fontWeight: '600', color: '#f0f4ff' },
  quickSub:       { fontSize: 11, color: '#7a8bb0' },
});
