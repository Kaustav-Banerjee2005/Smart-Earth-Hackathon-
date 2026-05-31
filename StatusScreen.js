// StatusScreen.js — "Your SOS was received + score"
// Gets { offline, score, sosId } from navigation params after SOS
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchSOSList } from '../services/api';
import { useUser } from '../context/UserContext';
import { useWebSocket } from '../hooks/useWebSocket';

const STATUS_COLOR = { pending: '#f07030', dispatched: '#4a8fe8', resolved: '#1dc4a0' };
const STATUS_LABEL = { pending: 'Waiting', dispatched: 'Team Assigned', resolved: 'Resolved' };

export default function StatusScreen() {
  const navigation = useNavigation();
  const route       = useRoute();
  const { profile } = useUser();

  const { offline = false, score = null, sosId = null } = route.params ?? {};

  const [mySOSList,  setMySOSList]  = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Listen for real-time status_change events from backend WebSocket
  const handleWS = useCallback((msg) => {
    if (msg.event === 'status_change') {
      setMySOSList(prev =>
        prev.map(s => s.id === msg.data.id ? { ...s, ...msg.data } : s)
      );
    }
  }, []);
  useWebSocket(handleWS);

  const loadMyAlerts = useCallback(async () => {
    try {
      const all = await fetchSOSList();
      // Filter by this user's user_id
      const mine = all.filter(s => s.user_id === profile?.user_id);
      setMySOSList(mine);
    } catch {}
  }, [profile]);

  useEffect(() => { loadMyAlerts(); }, [loadMyAlerts]);

  async function onRefresh() {
    setRefreshing(true);
    await loadMyAlerts();
    setRefreshing(false);
  }

  const latestScore = score ?? mySOSList[0]?.priority_score;
  const latestStatus = mySOSList[0]?.status ?? 'pending';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e84040" />}
    >
      <Text style={styles.pageTitle}>Rescue Status</Text>

      {/* Offline mode banner */}
      {offline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineTitle}>📶 Saved offline</Text>
          <Text style={styles.offlineBody}>No internet detected. Your SOS was queued and will be sent automatically when you regain connection.</Text>
        </View>
      )}

      {/* AI Score card */}
      {latestScore != null && (
        <View style={styles.scoreCard}>
          <View style={styles.scoreTop}>
            <View>
              <Text style={styles.scoreLabel}>AI PRIORITY SCORE</Text>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreNum}>{latestScore}</Text>
                <Text style={styles.scoreMax}>/100</Text>
              </View>
            </View>
            <View style={[styles.priorityBadge, { borderColor: priorityColor(latestScore) }]}>
              <Text style={[styles.priorityText, { color: priorityColor(latestScore) }]}>
                {priorityLabel(latestScore)}
              </Text>
            </View>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${latestScore}%`, backgroundColor: priorityColor(latestScore) }]} />
          </View>
          <Text style={styles.scoreNote}>
            Score based on age, medical conditions, and your GPS flood zone risk.
          </Text>
        </View>
      )}

      {/* Timeline */}
      <Text style={styles.sectionLabel}>RESCUE TIMELINE</Text>
      <View style={styles.timelineCard}>
        {TIMELINE_STEPS.map((step, i) => {
          const state = stepState(i, latestStatus);
          return (
            <View key={i} style={[styles.tlItem, i === TIMELINE_STEPS.length - 1 && { paddingBottom: 0 }]}>
              <View style={styles.tlLeft}>
                <View style={[styles.tlDot, { borderColor: state === 'done' ? '#1dc4a0' : state === 'active' ? '#f07030' : '#1e2d47', backgroundColor: state === 'done' ? '#0a1f18' : state === 'active' ? '#1a1208' : '#131c2e' }]}>
                  <Text style={{ fontSize: 12, color: state === 'done' ? '#1dc4a0' : state === 'active' ? '#f07030' : '#4a5878' }}>
                    {state === 'done' ? '✓' : state === 'active' ? '◉' : '○'}
                  </Text>
                </View>
                {i < TIMELINE_STEPS.length - 1 && <View style={[styles.tlLine, { backgroundColor: state === 'done' ? '#1dc4a0' : '#1e2d47' }]} />}
              </View>
              <View style={styles.tlRight}>
                <Text style={[styles.tlTitle, { color: state === 'pending' ? '#4a5878' : '#f0f4ff' }]}>{step.title}</Text>
                <Text style={[styles.tlSub, { color: state === 'active' ? '#f07030' : '#4a5878' }]}>{step.sub(latestStatus, sosId)}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Past SOS alerts */}
      {mySOSList.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>ALL MY ALERTS</Text>
          {mySOSList.map(sos => (
            <View key={sos.id} style={styles.sosItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sosTime}>{new Date(sos.created_at * 1000).toLocaleTimeString()}</Text>
                <Text style={styles.sosCoords}>{sos.latitude?.toFixed(4)}, {sos.longitude?.toFixed(4)}</Text>
              </View>
              <View style={[styles.statusPill, { borderColor: STATUS_COLOR[sos.status] }]}>
                <Text style={[styles.statusPillText, { color: STATUS_COLOR[sos.status] }]}>
                  {STATUS_LABEL[sos.status]}
                </Text>
              </View>
            </View>
          ))}
        </>
      )}

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.navigate('Home')}>
        <Text style={styles.backBtnText}>← Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const TIMELINE_STEPS = [
  { title: 'SOS received',        sub: (s, id) => id ? `Ref: SOS-${id}` : 'Queued offline'          },
  { title: 'AI score calculated', sub: () => 'Priority assigned'                                    },
  { title: 'Rescue team assigned',sub: (s) => s === 'dispatched' || s === 'resolved' ? 'Team assigned' : 'Waiting for dispatch' },
  { title: 'Team en route',       sub: (s) => s === 'resolved' ? 'Completed' : 'Pending'            },
  { title: 'Evacuated to shelter',sub: (s) => s === 'resolved' ? 'Done' : 'Pending'                 },
];

function stepState(index, status) {
  const statusIndex = { pending: 1, dispatched: 2, resolved: 4 }[status] ?? 1;
  if (index < statusIndex) return 'done';
  if (index === statusIndex) return 'active';
  return 'pending';
}

function priorityColor(score) {
  if (score >= 70) return '#e84040';
  if (score >= 40) return '#f07030';
  return '#1dc4a0';
}
function priorityLabel(score) {
  if (score >= 70) return 'Critical';
  if (score >= 40) return 'High';
  return 'Moderate';
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#0d1422' },
  scroll:        { padding: 20, paddingBottom: 40 },
  pageTitle:     { fontSize: 22, fontWeight: '700', color: '#f0f4ff', marginBottom: 16 },

  offlineBanner: { backgroundColor: '#1a1208', borderWidth: 1, borderColor: '#f07030', borderRadius: 12, padding: 14, marginBottom: 16 },
  offlineTitle:  { fontSize: 14, fontWeight: '600', color: '#f07030', marginBottom: 4 },
  offlineBody:   { fontSize: 12, color: '#c07030', lineHeight: 18 },

  scoreCard:     { backgroundColor: '#131c2e', borderWidth: 1, borderColor: '#1e2d47', borderRadius: 16, padding: 18, marginBottom: 20 },
  scoreTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  scoreLabel:    { fontSize: 11, color: '#7a8bb0', letterSpacing: 1 },
  scoreRow:      { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  scoreNum:      { fontSize: 48, fontWeight: '700', color: '#e84040', lineHeight: 52 },
  scoreMax:      { fontSize: 16, color: '#7a8bb0' },
  priorityBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  priorityText:  { fontSize: 12, fontWeight: '600' },
  barBg:         { height: 6, borderRadius: 3, backgroundColor: '#1e2d47', marginBottom: 10, overflow: 'hidden' },
  barFill:       { height: 6, borderRadius: 3 },
  scoreNote:     { fontSize: 11, color: '#4a5878', lineHeight: 16 },

  sectionLabel:  { fontSize: 10, color: '#4a5878', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },

  timelineCard:  { backgroundColor: '#131c2e', borderWidth: 1, borderColor: '#1e2d47', borderRadius: 16, padding: 18, marginBottom: 20 },
  tlItem:        { flexDirection: 'row', gap: 14, paddingBottom: 16 },
  tlLeft:        { alignItems: 'center', width: 30 },
  tlDot:         { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tlLine:        { flex: 1, width: 1, marginTop: 4 },
  tlRight:       { flex: 1, paddingTop: 4 },
  tlTitle:       { fontSize: 14, fontWeight: '600' },
  tlSub:         { fontSize: 11, marginTop: 3 },

  sosItem:       { backgroundColor: '#131c2e', borderWidth: 1, borderColor: '#1e2d47', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
  sosTime:       { fontSize: 13, color: '#f0f4ff', fontWeight: '500' },
  sosCoords:     { fontSize: 11, color: '#4a5878', marginTop: 2 },
  statusPill:    { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText:{ fontSize: 11, fontWeight: '600' },

  backBtn:       { marginTop: 16, alignItems: 'center' },
  backBtnText:   { fontSize: 14, color: '#7a8bb0' },
});
