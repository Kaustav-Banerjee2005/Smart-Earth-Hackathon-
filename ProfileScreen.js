// ProfileScreen.js — first launch setup, persisted via AsyncStorage
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Switch, TouchableOpacity,
  StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { profile, saveProfile } = useUser();

  const [name,              setName]              = useState('');
  const [age,               setAge]               = useState('');
  const [medicalConditions, setMedicalConditions] = useState(false);
  const [saving,            setSaving]            = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setAge(String(profile.age ?? ''));
      setMedicalConditions(profile.medical_conditions ?? false);
    }
  }, [profile]);

  async function handleSave() {
    if (!name.trim()) return Alert.alert('Required', 'Please enter your name.');
    const parsedAge = parseInt(age, 10);
    if (!parsedAge || parsedAge < 1 || parsedAge > 120) return Alert.alert('Invalid age', 'Enter a valid age.');

    setSaving(true);
    await saveProfile({
      ...profile,
      name:               name.trim(),
      age:                parsedAge,
      medical_conditions: medicalConditions, // boolean — matches backend SOSCreate
    });
    setSaving(false);
    Alert.alert('Saved', 'Your profile is saved.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>Your Profile</Text>
        <Text style={styles.pageSubtitle}>Used to calculate your AI rescue priority score. Stored only on this device.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Priya Sharma"
            placeholderTextColor="#4a5878"
            autoCapitalize="words"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Age</Text>
          <TextInput
            style={styles.input}
            value={age}
            onChangeText={setAge}
            placeholder="e.g. 32"
            placeholderTextColor="#4a5878"
            keyboardType="numeric"
            maxLength={3}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Medical Conditions</Text>
              <Text style={styles.switchSub}>Heart, diabetes, mobility issues, etc.</Text>
            </View>
            <Switch
              value={medicalConditions}
              onValueChange={setMedicalConditions}
              trackColor={{ false: '#1e2d47', true: '#e84040' }}
              thumbColor={medicalConditions ? '#fff' : '#7a8bb0'}
            />
          </View>

          {/* Priority score preview */}
          <View style={styles.scorePreview}>
            <Text style={styles.scorePreviewLabel}>Estimated rescue priority</Text>
            <Text style={styles.scorePreviewValue}>
              {calculatePreviewScore(parseInt(age) || 0, medicalConditions)}
              <Text style={styles.scoreMax}> / 75+</Text>
            </Text>
            <Text style={styles.scorePreviewNote}>
              Final score also includes your GPS flood zone. Higher = faster rescue dispatch.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Profile'}</Text>
        </TouchableOpacity>

        {profile && (
          <View style={styles.idCard}>
            <Text style={styles.idLabel}>Device ID</Text>
            <Text style={styles.idValue}>{profile.user_id?.slice(0, 16)}…</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Mirror calculate_priority_score from main.py (minus GPS zone)
function calculatePreviewScore(age, hasMedical) {
  let score = 0;
  if (age < 12 || age > 60) score += 30;
  if (hasMedical) score += 25;
  return score;
}

const styles = StyleSheet.create({
  root:              { flex: 1, backgroundColor: '#0d1422' },
  scroll:            { padding: 20, paddingBottom: 40 },
  pageTitle:         { fontSize: 22, fontWeight: '700', color: '#f0f4ff', marginBottom: 6 },
  pageSubtitle:      { fontSize: 13, color: '#7a8bb0', lineHeight: 18, marginBottom: 20 },
  card:              { backgroundColor: '#131c2e', borderWidth: 1, borderColor: '#1e2d47', borderRadius: 16, padding: 18, marginBottom: 16 },
  label:             { fontSize: 12, color: '#7a8bb0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: {
    backgroundColor: '#0d1422', borderWidth: 1, borderColor: '#1e2d47', borderRadius: 10,
    padding: 14, fontSize: 16, color: '#f0f4ff',
  },
  switchRow:         { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 12 },
  switchSub:         { fontSize: 11, color: '#4a5878', marginTop: 2 },
  scorePreview:      { marginTop: 20, backgroundColor: '#0d1422', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#1e2d47' },
  scorePreviewLabel: { fontSize: 11, color: '#7a8bb0', textTransform: 'uppercase', letterSpacing: 0.5 },
  scorePreviewValue: { fontSize: 36, fontWeight: '700', color: '#e84040', marginTop: 4 },
  scoreMax:          { fontSize: 16, color: '#7a8bb0', fontWeight: '400' },
  scorePreviewNote:  { fontSize: 11, color: '#4a5878', marginTop: 6, lineHeight: 16 },
  saveBtn:           { backgroundColor: '#e84040', borderRadius: 14, padding: 18, alignItems: 'center', marginBottom: 16 },
  saveBtnText:       { fontSize: 16, fontWeight: '700', color: '#fff' },
  idCard:            { alignItems: 'center' },
  idLabel:           { fontSize: 11, color: '#4a5878' },
  idValue:           { fontSize: 11, color: '#4a5878', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});
