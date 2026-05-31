// FamilyScreen.js  –  POST /location (periodic) + GET /family/:family_id
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, AppState,
} from 'react-native';
import * as Location from 'expo-location';
import { postLocation, fetchFamilyLocations, getOfflineQueueCount } from '../services/api';
import { useUser } from '../context/UserContext';

export default function FamilyScreen() {
  const { profile }            = useUser();
  const [members,    setMembers]    = useState([]);
  const [lastShared, setLastShared] = useState(null);
  const [sharing,    setSharing]    = useState(false);
  const [offline,    setOffline]    = useState(false);
  const [qCount,     setQCount]     = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef  = useRef(null);

  const shareLocation = useCallback(async () => {
    if (!profile) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      await postLocation(
        profile.user_id,
        profile.family_id,
        loc.coords.latitude,
        loc.coords.longitude,
      );
      setLastShared(new Date());
      setOffline(false);
    } catch {
      setOffline(true);
    }
    setQCount(await getOfflineQueueCount());
  }, [profile]);

  const loadFamily = useCallback(async () => {
    if (!profile?.family_id) return;
    try {
      const data = await fetchFamilyLocations(profile.family_id);
      // Exclude own entry, add elapsed time
      const others = data.filter(m => m.user_id !== profile.user_id);
      setMembers(others);
    } catch {}
    setRefreshing(false);
  }, [profile]);

  useEffect(() => {
    shareLocation();
    loadFamily();
    // POST location every 60 seconds (background)
    intervalRef.current = setInterval(shareLocation, 60_000);
    return () => clearInterval(intervalRef.current);
  }, [shareLocation, loadFamily]);

  function elapsed(updatedAt) {
    const secs = Math.floor((Date.now() - updatedAt * 1000) / 1000);
    if (secs < 60)  return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
  }

  function statusColor(updatedAt) {
    const mins = (Date.now() - updatedAt * 1000) / 60000;
    if (mins < 5)  return '#1dc4a0'; // safe / recent
    if (mins < 30) return '#f07030'; // stale
    return '#e84040';                // unknown
  }

  function initials(name) {
    return (name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.scroll}
      data={members}
      keyExtractor={item => item.user_id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFamily(); }} tintColor="#e84040" />}
      ListHeaderComponent={
        <View>
          <Text style={styles.pageTitle}>Family Locator</Text>

          {/* Offline / mesh warning */}
          {(offline || qCount > 0) && (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineTitle}>📡 Offline — mesh mode</Text>
              <Text style={styles.offlineBody}>
                {qCount > 0 ? `${qCount} SOS queued. ` : ''}Location sharing paused. Retrying every 60s via Bluetooth relay.
              </Text>
            </View>
          )}

          {/* My share status */}
          <View style={styles.myStatus}>
            <View style={{ flex: 1 }}>
              <Text style={styles.myLabel}>YOUR LOCATION</Text>
              <Text style={styles.myTime}>
                {lastShared ? `Shared ${elapsed(Math.floor(lastShared.getTime() / 1000))}` : 'Not shared yet'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.shareBtn, sharing && { opacity: 0.6 }]}
              onPress={async () => { setSharing(true); await shareLocation(); setSharing(false); }}
              disabled={sharing}
            >
              <Text style={styles.shareBtnText}>{sharing ? '…' : 'Share now'}</Text>
            </TouchableOpacity>
          </View>

          {members.length === 0 && (
            <Text style={styles.emptyText}>
              No family members found yet. They need to use the same Family ID ({profile?.family_id?.slice(0,8)}…) and share their location.
            </Text>
          )}
          {members.length > 0 && <Text style={styles.sectionLabel}>FAMILY MEMBERS</Text>}
        </View>
      }
      renderItem={({ item }) => {
        const color = statusColor(item.updated_at);
        return (
          <View style={styles.memberCard}>
            <View style={[styles.avatar, { backgroundColor: '#131c2e' }]}>
              <Text style={[styles.avatarText, { color }]}>{initials(item.name ?? item.user_id)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{item.name ?? item.user_id.slice(0, 8)}</Text>
              <Text style={styles.memberLoc}>
                {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)}  ·  {elapsed(item.updated_at)}
              </Text>
            </View>
            <View style={[styles.statusDot, { backgroundColor: color }]} />
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0d1422' },
  scroll:        { padding: 20, paddingBottom: 40 },
  pageTitle:     { fontSize: 22, fontWeight: '700', color: '#f0f4ff', marginBottom: 16 },

  offlineBanner: { backgroundColor: '#1a1208', borderWidth: 1, borderColor: '#f07030', borderRadius: 12, padding: 14, marginBottom: 12 },
  offlineTitle:  { fontSize: 13, fontWeight: '600', color: '#f07030', marginBottom: 4 },
  offlineBody:   { fontSize: 12, color: '#c07030', lineHeight: 17 },

  myStatus:      { backgroundColor: '#131c2e', borderWidth: 1, borderColor: '#1e2d47', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  myLabel:       { fontSize: 10, color: '#7a8bb0', letterSpacing: 0.8 },
  myTime:        { fontSize: 13, color: '#f0f4ff', marginTop: 2 },
  shareBtn:      { backgroundColor: '#1dc4a0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  shareBtnText:  { fontSize: 13, fontWeight: '700', color: '#0a1f18' },

  emptyText:     { fontSize: 12, color: '#7a8bb0', lineHeight: 18, marginBottom: 16 },
  sectionLabel:  { fontSize: 10, color: '#4a5878', letterSpacing: 1.5, marginBottom: 8 },

  memberCard:    { backgroundColor: '#131c2e', borderWidth: 1, borderColor: '#1e2d47', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar:        { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1e2d47' },
  avatarText:    { fontSize: 14, fontWeight: '600' },
  memberName:    { fontSize: 14, fontWeight: '600', color: '#f0f4ff' },
  memberLoc:     { fontSize: 11, color: '#7a8bb0', marginTop: 2 },
  statusDot:     { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
});
