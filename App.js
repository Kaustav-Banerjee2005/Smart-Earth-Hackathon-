// App.js  –  root entry point
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, Alert } from 'react-native';

import { UserProvider, useUser } from './src/context/UserContext';
import { startOfflineRetry }      from './src/services/offlineManager';

import HomeScreen     from './src/screens/HomeScreen';
import StatusScreen   from './src/screens/StatusScreen';
import SheltersScreen from './src/screens/SheltersScreen';
import FamilyScreen   from './src/screens/FamilyScreen';
import ProfileScreen  from './src/screens/ProfileScreen';

const Stack  = createNativeStackNavigator();
const Tab    = createBottomTabNavigator();

const TAB_BG      = '#0d1422';
const TAB_BORDER  = '#1e2d47';
const TAB_ACTIVE  = '#e84040';
const TAB_INACTIVE= '#4a5878';

function TabIcon({ name, focused }) {
  const icons = { Home: '🆘', Status: '📡', Shelters: '🏠', Family: '👨‍👩‍👧' };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{icons[name]}</Text>;
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor:   TAB_ACTIVE,
        tabBarInactiveTintColor: TAB_INACTIVE,
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopColor: TAB_BORDER,
          borderTopWidth: 1,
          paddingBottom: 8,
          height: 64,
        },
        tabBarLabelStyle: { fontSize: 11, marginBottom: 2 },
        headerStyle:       { backgroundColor: '#0d1422' },
        headerTintColor:   '#f0f4ff',
        headerTitleStyle:  { fontWeight: '600' },
        headerShadowVisible: false,
      })}
    >
      <Tab.Screen name="Home"     component={HomeScreen}     options={{ title: 'RescueApp', tabBarLabel: 'SOS' }} />
      <Tab.Screen name="Status"   component={StatusScreen}   options={{ title: 'Rescue Status' }} />
      <Tab.Screen name="Shelters" component={SheltersScreen} options={{ title: 'Shelters' }} />
      <Tab.Screen name="Family"   component={FamilyScreen}   options={{ title: 'Family' }} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { profile, loaded } = useUser();

  useEffect(() => {
    startOfflineRetry((sent) => {
      Alert.alert('Connected', `${sent} queued SOS alert${sent > 1 ? 's' : ''} sent successfully.`);
    });
  }, []);

  if (!loaded) return null; // splash / loading

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle:       { backgroundColor: '#0d1422' },
          headerTintColor:   '#f0f4ff',
          headerTitleStyle:  { fontWeight: '600' },
          headerShadowVisible: false,
        }}
        initialRouteName={profile ? 'Main' : 'Profile'}
      >
        <Stack.Screen name="Main"    component={MainTabs}    options={{ headerShown: false }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Set Up Profile', headerBackVisible: !!profile }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AppNavigator />
    </UserProvider>
  );
}
