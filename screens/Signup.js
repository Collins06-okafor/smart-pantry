import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import * as Location from 'expo-location';

export default function Signup({ navigation }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [secureEntry, setSecureEntry] = useState(true);
  const [secureConfirmEntry, setSecureConfirmEntry] = useState(true);

  const insertProfile = async (user, email, name, surname) => {
    const fallbackLatitude = 41.0082;
    const fallbackLongitude = 28.9784;

    let latitude = fallbackLatitude;
    let longitude = fallbackLongitude;

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      }
    } catch (err) {
      console.warn('Location permission or fetch failed, using fallback location');
    }

    const locationPoint = `POINT(${longitude} ${latitude})`;

    const { error } = await supabase.from('profile').insert([{
      id: user.id,
      email,
      name,
      surname,
      latitude,
      longitude,
      location: locationPoint,
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      is_sharing: false,
      expiry_alerts_enabled: true,
      recipe_suggestions_enabled: true,
      avatar_url: null,
      phone_number: null,
      bio: null,
      address: null,
      allergies: null,
      is_online: false,
      updated_at: new Date().toISOString()
    }]);

    if (error) {
      console.error('Profile insert error:', error.message);
      Alert.alert('Profile Error', error.message);
      throw error;
    }
  };

  const handleSignup = async () => {
    if (!email || !name || !surname || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match!');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, surname }
        }
      });

      if (error) throw error;

      const user = data?.user;
      if (user) {
        await insertProfile(user, email, name, surname);
        Alert.alert('Success', 'Account created successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Location')
          }
        ]);
      }
    } catch (err) {
      console.error('Signup failed:', err.message);
      Alert.alert('Error', `Signup failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#1c1c1c" />
      
      <View style={styles.header}>
        <Ionicons name="person-add" size={40} color="#00C897" style={styles.logo} />
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join Smart Pantry to reduce food waste</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.nameRow}>
          <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
            <TextInput
              style={styles.input}
              placeholder="First Name *"
              placeholderTextColor="#aaa"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>
          <View style={[styles.inputContainer, { flex: 1 }]}>
            <TextInput
              style={styles.input}
              placeholder="Last Name *"
              placeholderTextColor="#aaa"
              value={surname}
              onChangeText={setSurname}
              autoCapitalize="words"
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={20} color="#aaa" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email *"
            placeholderTextColor="#aaa"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#aaa" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password *"
            placeholderTextColor="#aaa"
            secureTextEntry={secureEntry}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity 
            onPress={() => setSecureEntry(!secureEntry)}
            style={styles.eyeIcon}
          >
            <Ionicons 
              name={secureEntry ? 'eye-off-outline' : 'eye-outline'} 
              size={20} 
              color="#aaa" 
            />
          </TouchableOpacity>
        </View>

        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed-outline" size={20} color="#aaa" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password *"
            placeholderTextColor="#aaa"
            secureTextEntry={secureConfirmEntry}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
          <TouchableOpacity 
            onPress={() => setSecureConfirmEntry(!secureConfirmEntry)}
            style={styles.eyeIcon}
          >
            <Ionicons 
              name={secureConfirmEntry ? 'eye-off-outline' : 'eye-outline'} 
              size={20} 
              color="#aaa" 
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleSignup}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.footerLink}> Login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1c',
    paddingHorizontal: 25,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  formContainer: {
    marginBottom: 20,
  },
  nameRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e2e2e',
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    paddingVertical: 15,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 10,
  },
  button: {
    backgroundColor: '#00C897',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#00C897',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#aaa',
    fontSize: 14,
  },
  footerLink: {
    color: '#00C897',
    fontSize: 14,
    fontWeight: 'bold',
  },
});