// UserContext.js  –  persistent profile, no login needed
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values'; // needed for uuid
import { v4 as uuid } from 'uuid';

const PROFILE_KEY = 'rescue_profile';
const UserContext  = createContext({});

export function UserProvider({ children }) {
  const [profile, setProfileState] = useState(null);
  const [loaded, setLoaded]         = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(PROFILE_KEY);
      if (raw) {
        setProfileState(JSON.parse(raw));
      }
      setLoaded(true);
    })();
  }, []);

  async function saveProfile(data) {
    const full = {
      user_id: data.user_id || uuid(), // stable UUID, no login
      family_id: data.family_id || uuid(),
      name: data.name,
      age: data.age,
      medical_conditions: data.medical_conditions ?? false, // boolean for backend
    };
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(full));
    setProfileState(full);
  }

  return (
    <UserContext.Provider value={{ profile, saveProfile, loaded }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
