// App.js - Auth check and navigation entry point

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { supabase } from './lib/supabase';
import { View, Text, ActivityIndicator } from 'react-native';

// Screens
import LandingScreen from './screens/LandingPage';
import LoginScreen from './screens/Login';
import SignUpScreen from './screens/Signup';
import MainTabsStack from './screens/MainTabsStack'; // ✅ Using Stack wrapper
import RequestFoodScreen from './screens/RequestFoodScreen'; // Import your RequestFood component
const Stack = createStackNavigator();


// Loading UI
const LoadingScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color="#00C897" />
    <Text style={{ marginTop: 10 }}>Loading...</Text>
  </View>
);

// Auth flow wrapper (Landing → Login → Signup)
const AuthScreens = () => {
  const [currentScreen, setCurrentScreen] = useState('Landing');

  if (currentScreen === 'Landing') {
    return <LandingScreen onNavigate={setCurrentScreen} />;
  } else if (currentScreen === 'Login') {
    return <LoginScreen onNavigate={setCurrentScreen} />;
  } else if (currentScreen === 'SignUp') {
    return <SignUpScreen onNavigate={setCurrentScreen} />;
  }

  return <LandingScreen onNavigate={setCurrentScreen} />;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check user session on app start
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <NavigationContainer>

      {user ? (
        // ✅ Authenticated user: show tab + stack screens
        <MainTabsStack />
      ) : (
        // 🔐 Not logged in: show auth flow
        <AuthScreens />
        
      )}
       
    </NavigationContainer>
  );
}
