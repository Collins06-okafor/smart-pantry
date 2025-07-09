import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import * as Location from 'expo-location';

export default function Signup({ navigation }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [city, setCity] = useState('');

  const insertProfile = async (user, email, name, surname, city) => {
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

    // Create PostGIS POINT geometry - correct format for Supabase
    const locationPoint = `POINT(${longitude} ${latitude})`;

    const { data: insertData, error: insertError } = await supabase.from('profile').insert([{
      id: user.id,
      email,
      name,
      surname,
      latitude,
      longitude,
      location: locationPoint, // PostGIS geometry format
      city,
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      is_sharing: false,
      expiry_alerts_enabled: true,
      recipe_suggestions_enabled: true,
      // Add required fields that might be missing:
      avatar_url: null, // or provide a default avatar URL
      phone_number: null, // or collect this in your form
      bio: null, // optional field
      address: null, // or collect this in your form
      allergies: null, // or collect this in your form
      is_online: false, // default to offline
      updated_at: new Date().toISOString()
    }]);

    if (insertError) {
      console.error('Profile insert error:', insertError.message);
      console.error('Full error object:', insertError);
      Alert.alert('Profile Error', insertError.message);
      throw insertError; // Re-throw to be caught by the calling function
    }

    return insertData;
  };

  const handleSignup = async () => {
    // Validate required fields
    if (!email || !name || !surname || !password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match!');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Password strength validation
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, surname }
        }
      });

      if (error) {
        Alert.alert('Signup Error', error.message);
        return;
      }

      const user = data?.user;
      if (user) {
        try {
          await insertProfile(user, email, name, surname, city);
          Alert.alert('Success', 'Account created successfully!', [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Location')
            }
          ]);
        } catch (err) {
          console.error('Insert profile failed:', err.message);
          Alert.alert('Profile Error', `Failed to create profile: ${err.message}`);
        }
      }
    } catch (err) {
      console.error('Signup failed:', err.message);
      Alert.alert('Error', `Signup failed: ${err.message}`);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>Sign Up</Text>

      <TextInput
        style={styles.input}
        placeholder="Name *"
        placeholderTextColor="#aaa"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />

      <TextInput
        style={styles.input}
        placeholder="Surname *"
        placeholderTextColor="#aaa"
        value={surname}
        onChangeText={setSurname}
        autoCapitalize="words"
      />

      <TextInput
        style={styles.input}
        placeholder="City"
        placeholderTextColor="#aaa"
        value={city}
        onChangeText={setCity}
        autoCapitalize="words"
      />

      <TextInput
        style={styles.input}
        placeholder="Email *"
        placeholderTextColor="#aaa"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password *"
        placeholderTextColor="#aaa"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password *"
        placeholderTextColor="#aaa"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleSignup}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.linkText}>Already have an account? Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1c',
    paddingHorizontal: 30,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    color: '#00C897',
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#2e2e2e',
    color: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#00C897',
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  linkText: {
    color: '#00C897',
    textAlign: 'center',
    marginTop: 10,
    fontSize: 14,
  },
});