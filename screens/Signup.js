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

  const insertProfile = async (user, email, name, surname) => {
    const fallbackLatitude = 41.0082;
    const fallbackLongitude = 28.9784;

    let latitude = fallbackLatitude;
    let longitude = fallbackLongitude;
    let location = `POINT(${fallbackLongitude} ${fallbackLatitude})`;
    let city = 'Istanbul';

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
        location = `POINT(${longitude} ${latitude})`;

        // Optional reverse geocoding
        // const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        // if (reverseGeocode.length > 0) city = reverseGeocode[0].city || city;
      }
    } catch (err) {
      console.warn('Location permission or fetch failed, using fallback location');
    }

    const { data: insertData, error: insertError } = await supabase.from('profile').insert([{
    id: user.id,
    email,
    name,
    surname,
    latitude,
    longitude,
    location,
    city,
    created_at: new Date().toISOString(),
    is_sharing: false,
    last_active: new Date().toISOString(),
    }]);

    if (insertError) {
    console.error('Profile insert error:', insertError.message);
    Alert.alert('Profile Error', insertError.message);
    }

  };

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match!');
      return;
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
            name,
            surname,
            }
        }
        });



        if (error) {
        Alert.alert('Signup Error', error.message);
        } else {
        const user = data?.user;
        console.log('Signup result:', data); // ✅ Debug log

        if (user) {
            try {
            await insertProfile(user, email, name, surname);
            Alert.alert('Success', 'Account created!');
            navigation.navigate('Login');
            } catch (err) {
            console.error('Insert profile failed:', err.message); // ✅ Log
            Alert.alert('Profile Error', err.message);
            }
        }
        }
 };
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>Sign Up</Text>

      <TextInput
        style={styles.input}
        placeholder="Name"
        placeholderTextColor="#aaa"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Surname"
        placeholderTextColor="#aaa"
        value={surname}
        onChangeText={setSurname}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#aaa"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#aaa"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
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
