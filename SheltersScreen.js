// SheltersScreen.js  –  GET /shelters, nearest 3, distance, Navigate button
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Linking, ActivityIndicator, RefreshControl,
} from 'react-native';
import * as Location from 'expo-location';
import { fetchShelters } from '../services/api';

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function SheltersScreen() {
  const [shelters,   setShelters]   = useState([]);
  const [userLoc,    setUserLoc]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);

  async function loadData() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const loc = status === 'granted'
        ? await Location.getCurrentPositionAsync({})
        : null;
      if (loc) setUserLoc(loc.coords);

      const data = await fetchShelters();

      // Add distance, sort, take nearest 3
      const enriched = data
        .map(s => ({
          ...s,
          distance: loc
            ? haversine(loc.coords.latitude, loc.coords.longitude, s.latitude, s.longitude)
            : null,
        }))
        .sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999))
        .slice(0, 3);

      setShelters(enriched);
      setError(null);
    } catch (e) {
      setError('Could not load shelters. Check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function openMaps(shelter) {
    const label = encodeURIComponent(shelter.name || 'Shelter');
    const url = `https://www.google.com/maps/dir/?api=1&destination=${shelter.latitude},${shelter.longitude}&travelmode=walking`;
    Linking.openURL(url);
  }

  function capacityPct(shelter) {
    if (!shelter.capacity_total) return 0;
    return Math.min((shelter.capacity_used ?? 0) / shelter.capacity_total, 1);
  }

  function capColor(pct) {
    if (pct >= 1) return '#e84040';
    if (pct >= 0.7) return '#f07030';
    return '#1dc4a0';
  }

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color="#e84040" size="large" /></View>
  );

  return (
    <FlatList
      style={styles.root}
      contentContainerStyle={styles.scroll}
      data={shelters}
      keyExtractor={item => String(item.id ?? item.name)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor="#e84040" />}
      ListHeaderComponent={
        <View>
          <Text style={styles.pageTitle}>Nearby Shelters</Text>
          {error && <Text style={styles.errorText}>{error}</Text>}
          {shelters.length === 0 && !error && <Text style={styles.emptyText}>No shelters found in the database.</Text>}
        </View>
      }
      renderItem={({ item }) => {
        const pct  = capacityPct(item);
        const full = pct >= 1;
        return (
          <View style={[styles.card, full && styles.cardFull]}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.shelterName}>{item.name}</Text>
                <Text style={styles.shelterMeta}>
                  {item.capacity_used ?? '?'}/{item.capacity_total ?? '?'} capacity
                  {item.has_medical ? '  ·  Medical staff' : ''}
                </Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: capColor(pct) }]} />
                </View>
              </View>
              <View style={styles.distBlock}>
                <Text style={styles.distText}>
                  {item.distance != null ? `${item.distance.toFixed(1)} km` : '—'}
                </Text>
                <Text style={[styles.openLabel, { color: full ? '#e84040' : '#1dc4a0' }]}>
                  {full ? 'FULL' : 'OPEN'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.navBtn, full && styles.navBtnDisabled]}
              onPress={() => openMaps(item)}
              disabled={full}
            >
              <Text style={[styles.navBtnText, full && { color: '#4a5878' }]}>
                {full ? 'No vacancies' : '↗  Navigate'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0d1422' },
  scroll:        { padding: 20, paddingBottom: 40 },
  center:        { flex: 1, backgroundColor: '#0d1422', alignItems: 'center', justifyContent: 'center' },
  pageTitle:     { fontSize: 22, fontWeight: '700', color: '#f0f4ff', marginBottom: 16 },
  errorText:     { color: '#e84040', fontSize: 13, marginBottom: 12 },
  emptyText:     { color: '#7a8bb0', fontSize: 13, marginBottom: 12 },

  card:          { backgroundColor: '#131c2e', borderWidth: 1, borderColor: '#1e2d47', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardFull:      { opacity: 0.55 },
  cardTop:       { flexDirection: 'row', gap: 12, marginBottom: 12 },
  shelterName:   { fontSize: 15, fontWeight: '600', color: '#f0f4ff', marginBottom: 4 },
  shelterMeta:   { fontSize: 11, color: '#7a8bb0', marginBottom: 8 },
  barBg:         { height: 4, borderRadius: 2, backgroundColor: '#1e2d47', overflow: 'hidden' },
  barFill:       { height: 4, borderRadius: 2 },
  distBlock:     { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  distText:      { fontSize: 14, fontWeight: '700', color: '#1dc4a0' },
  openLabel:     { fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  navBtn:        { backgroundColor: '#1dc4a0', borderRadius: 10, padding: 12, alignItems: 'center' },
  navBtnDisabled:{ backgroundColor: '#131c2e', borderWidth: 1, borderColor: '#1e2d47' },
  navBtnText:    { fontSize: 14, fontWeight: '700', color: '#0a1f18' },
});
