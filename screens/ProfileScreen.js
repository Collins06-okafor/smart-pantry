import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Button,
  Alert,
  ActivityIndicator,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { supabase } from '../lib/supabase';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';

export default function ProfileScreen() {
  const navigation = useNavigation();

  const [profile, setProfile] = useState({
    name: '',
    surname: '',
    email: '',
    city: '',
    address: '',
    latitude: '',
    longitude: '',
    phone_number: '',
    is_sharing: true,
    expiry_alerts_enabled: true,
    recipe_suggestions_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wasteSavedCount, setWasteSavedCount] = useState(0);
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    loadProfile();
    fetchWasteStats();
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('User error:', userError);
        Alert.alert('Error', 'Failed to get user information');
        return;
      }

      if (!user) {
        Alert.alert('Error', 'No user found');
        return;
      }

      const { data, error } = await supabase
        .from('profile')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        console.error('Fetch error:', error);
        Alert.alert('Error', 'Failed to load profile');
      } else if (data) {
        setProfile({
          ...data,
          latitude: data.latitude?.toString() || '',
          longitude: data.longitude?.toString() || '',
          expiry_alerts_enabled: data.expiry_alerts_enabled ?? true,
          recipe_suggestions_enabled: data.recipe_suggestions_enabled ?? true,
        });
      }
    } catch (error) {
      console.error('Load profile error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWasteStats = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data, error } = await supabase
        .from('shared_items')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'shared');

      if (!error && data) {
        setWasteSavedCount(data.length);
      }
    } catch (error) {
      console.error('Waste stats error:', error);
    }
  }, []);

  const validateProfile = () => {
    const errors = [];
    
    if (!profile.name?.trim()) errors.push('Name is required');
    if (!profile.surname?.trim()) errors.push('Surname is required');
    if (!profile.email?.trim()) errors.push('Email is required');
    
    if (profile.latitude && isNaN(parseFloat(profile.latitude))) {
      errors.push('Latitude must be a valid number');
    }
    if (profile.longitude && isNaN(parseFloat(profile.longitude))) {
      errors.push('Longitude must be a valid number');
    }
    
    if (profile.phone_number && !/^\+?[\d\s-()]+$/.test(profile.phone_number)) {
      errors.push('Phone number format is invalid');
    }
    
    return errors;
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      
      const validationErrors = validateProfile();
      if (validationErrors.length > 0) {
        Alert.alert('Validation Error', validationErrors.join('\n'));
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      
      if (userError || !user) {
        Alert.alert('Error', 'Authentication failed');
        return;
      }

      const updates = {
        ...profile,
        id: user.id,
        latitude: profile.latitude ? parseFloat(profile.latitude) : null,
        longitude: profile.longitude ? parseFloat(profile.longitude) : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profile').upsert(updates);
      
      if (error) {
        console.error('Save error:', error);
        Alert.alert('Error', `Failed to update profile: ${error.message}`);
      } else {
        Alert.alert(
          'Success', 
          'Profile updated successfully!',
          [
            {
              text: 'Stay Here',
              style: 'cancel',
            },
            {
              text: 'Go to Home',
              onPress: () => navigation.navigate('Dashboard'),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Save profile error:', error);
      Alert.alert('Error', 'An unexpected error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const fetchCurrentLocation = async () => {
    try {
      setLocationLoading(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location access is needed to update your coordinates.'
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setProfile(prev => ({
        ...prev,
        latitude: location.coords.latitude.toString(),
        longitude: location.coords.longitude.toString(),
      }));
      
      Alert.alert('Success', 'Location updated successfully!');
    } catch (error) {
      console.error('Location error:', error);
      Alert.alert('Error', 'Failed to get current location');
    } finally {
      setLocationLoading(false);
    }
  };

  const resetPassword = async () => {
    try {
      if (!profile.email) {
        Alert.alert('Error', 'No email address found');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(profile.email)) {
        Alert.alert('Error', 'Invalid email format');
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/reset-password`, // For web
        // For React Native, you might need to use a deep link:
        // redirectTo: 'yourapp://reset-password',
      });

      if (error) {
        console.error('Password reset error:', error);
        
        // Handle specific error types
        switch (error.message) {
          case 'For security purposes, you can only request this once every 60 seconds':
            Alert.alert('Rate Limited', 'Please wait 60 seconds before requesting another password reset.');
            break;
          case 'User not found':
            Alert.alert('Error', 'No account found with this email address.');
            break;
          case 'Email not confirmed':
            Alert.alert('Error', 'Please confirm your email address first.');
            break;
          case 'Signup disabled':
            Alert.alert('Error', 'Password reset is currently disabled.');
            break;
          default:
            Alert.alert('Error', `Failed to send reset email: ${error.message}`);
        }
      } else {
        Alert.alert(
          'Password Reset Email Sent', 
          'Check your email inbox (and spam folder) for the password reset link. The link will expire in 1 hour.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Password reset error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00A86B" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>👤 Profile Settings</Text>

      <Text style={styles.stats}>
        ♻️ You've saved {wasteSavedCount} item(s) from waste!
      </Text>

      <Text style={styles.sectionTitle}>📝 Personal Information</Text>

      <TextInput
        style={styles.input}
        placeholder="Full Name *"
        value={profile.name}
        onChangeText={(val) => setProfile({ ...profile, name: val })}
      />

      <TextInput
        style={styles.input}
        placeholder="Surname *"
        value={profile.surname}
        onChangeText={(val) => setProfile({ ...profile, surname: val })}
      />

      <TextInput
        style={[styles.input, styles.disabledInput]}
        placeholder="Email (read-only)"
        value={profile.email}
        editable={false}
      />

      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        value={profile.phone_number}
        onChangeText={(val) => setProfile({ ...profile, phone_number: val })}
        keyboardType="phone-pad"
      />

      <Text style={styles.sectionTitle}>📍 Location Info</Text>

      <TextInput
        style={styles.input}
        placeholder="City"
        value={profile.city}
        onChangeText={(val) => setProfile({ ...profile, city: val })}
      />

      <TextInput
        style={styles.input}
        placeholder="Address"
        value={profile.address}
        onChangeText={(val) => setProfile({ ...profile, address: val })}
      />

      <View style={styles.coordinatesContainer}>
        <TextInput
          style={[styles.input, styles.coordinateInput]}
          placeholder="Latitude"
          keyboardType="numeric"
          value={profile.latitude}
          onChangeText={(val) => setProfile({ ...profile, latitude: val })}
        />
        <TextInput
          style={[styles.input, styles.coordinateInput]}
          placeholder="Longitude"
          keyboardType="numeric"
          value={profile.longitude}
          onChangeText={(val) => setProfile({ ...profile, longitude: val })}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, styles.locationButton]}
        onPress={fetchCurrentLocation}
        disabled={locationLoading}
      >
        <Text style={styles.buttonText}>
          {locationLoading ? '📍 Getting Location...' : '📍 Use My Current Location'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>⚙️ Settings</Text>

      <View style={styles.switchContainer}>
        <Text style={styles.switchLabel}>Sharing Enabled:</Text>
        <Switch
          value={profile.is_sharing}
          onValueChange={(val) => setProfile({ ...profile, is_sharing: val })}
          trackColor={{ false: '#767577', true: '#00A86B' }}
          thumbColor={profile.is_sharing ? '#fff' : '#f4f3f4'}
        />
      </View>

      <Text style={styles.sectionTitle}>🔔 Notification Preferences</Text>

      <View style={styles.switchContainer}>
        <Text style={styles.switchLabel}>Expiry Alerts:</Text>
        <Switch
          value={profile.expiry_alerts_enabled}
          onValueChange={(val) => setProfile({ ...profile, expiry_alerts_enabled: val })}
          trackColor={{ false: '#767577', true: '#00A86B' }}
          thumbColor={profile.expiry_alerts_enabled ? '#fff' : '#f4f3f4'}
        />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={saveProfile}
          disabled={saving}
        >
          <Text style={styles.buttonText}>
            {saving ? '💾 Saving...' : '💾 Save Profile'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.resetButton]}
          onPress={resetPassword}
        >
          <Text style={styles.buttonText}>🔒 Reset Password</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.logoutButton]}
          onPress={handleLogout}
        >
          <Text style={styles.buttonText}>🚪 Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  stats: {
    fontSize: 16,
    color: '#00A86B',
    marginBottom: 20,
    textAlign: 'center',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 12,
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderColor: '#ddd',
    borderWidth: 1,
    marginBottom: 12,
    fontSize: 16,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  coordinatesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  coordinateInput: {
    flex: 1,
    marginRight: 8,
    marginBottom: 0,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderColor: '#ddd',
    borderWidth: 1,
    marginBottom: 12,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  buttonContainer: {
    marginTop: 24,
  },
  button: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#00A86B',
  },
  locationButton: {
    backgroundColor: '#007AFF',
  },
  resetButton: {
    backgroundColor: '#FF9500',
  },
  logoutButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});