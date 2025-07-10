import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { supabase } from '../lib/supabase';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
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
    date_of_birth: '',
    identity_url: '',
    is_sharing: true,
    expiry_alerts_enabled: true,
    recipe_suggestions_enabled: true,
  });

  const [identityDoc, setIdentityDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [wasteSavedCount, setWasteSavedCount] = useState(0);
  const [allergies, setAllergies] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);

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

      if (error && error.code !== 'PGRST116') {
        console.error('Fetch error:', error);
        Alert.alert('Error', 'Failed to load profile');
      } else if (data) {
        setProfile({
          ...data,
          latitude: data.latitude?.toString() || '',
          longitude: data.longitude?.toString() || '',
          date_of_birth: data.date_of_birth || '',
          identity_url: data.identity_url || '',
          expiry_alerts_enabled: data.expiry_alerts_enabled ?? true,
          recipe_suggestions_enabled: data.recipe_suggestions_enabled ?? true,
        });
        setAllergies(
  Array.isArray(data.allergies)
    ? data.allergies.join(', ')
    : typeof data.allergies === 'string'
    ? data.allergies
    : ''
);

        setIsEmailVerified(user.email_confirmed_at !== null);
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

  const sendVerificationEmail = async () => {
    try {
      setVerificationLoading(true);
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: profile.email,
      });

      if (error) {
        console.error('Verification error:', error);
        Alert.alert('Error', error.message);
      } else {
        setVerificationSent(true);
        Alert.alert(
          'Verification Email Sent',
          'Please check your email inbox (and spam folder) for the verification link.'
        );
      }
    } catch (error) {
      console.error('Verification error:', error);
      Alert.alert('Error', 'Failed to send verification email');
    } finally {
      setVerificationLoading(false);
    }
  };

  const validateProfile = () => {
    const errors = [];
    const { name, surname, email, phone_number, date_of_birth } = profile;

    if (!name?.trim()) errors.push('Name is required');
    if (!surname?.trim()) errors.push('Surname is required');
    if (!email?.trim()) errors.push('Email is required');

    // Phone validation with country code
    if (phone_number && !/^\+\d{6,15}$/.test(phone_number)) {
      errors.push('Phone number must include country code (e.g., +905551234567)');
    }

    // Age validation
    if (date_of_birth) {
      const birthDate = new Date(date_of_birth);
      const age = new Date(Date.now() - birthDate).getUTCFullYear() - 1970;
      if (isNaN(age) || age < 17) {
        errors.push('You must be at least 17 years old to use this app');
      }
    }

    // Coordinate validation
    if (profile.latitude && isNaN(parseFloat(profile.latitude))) {
      errors.push('Latitude must be a valid number');
    }
    if (profile.longitude && isNaN(parseFloat(profile.longitude))) {
      errors.push('Longitude must be a valid number');
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

      if (!isEmailVerified) {
        Alert.alert(
          'Email Not Verified',
          'Your email is not yet verified. Some features may be limited until you verify your email address.',
          [
            { text: 'Continue Anyway', onPress: () => continueSavingProfile() },
            {
              text: 'Send Verification',
              onPress: sendVerificationEmail
            }
          ]
        );
        return;
      }

      await continueSavingProfile();
    } catch (error) {
      console.error('Save profile error:', error);
      Alert.alert('Error', 'An unexpected error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const continueSavingProfile = async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      
      if (userError || !user) {
        Alert.alert('Error', 'Authentication failed');
        return;
      }

      let identity_url = profile.identity_url;

      // Upload identity document if selected
      if (identityDoc) {
        const ext = identityDoc.name.split('.').pop();
        const fileName = `identity_${user.id}_${Date.now()}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from('identity_docs')
          .upload(fileName, {
            uri: identityDoc.uri,
            type: identityDoc.mimeType || 'application/octet-stream',
            name: identityDoc.name,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          Alert.alert('Upload Error', 'Failed to upload identity document');
          return;
        }

        const { data: publicUrl } = supabase.storage
          .from('identity_docs')
          .getPublicUrl(fileName);
        identity_url = publicUrl.publicUrl;
      }

      const updates = {
        ...profile,
        id: user.id,
        latitude: profile.latitude ? parseFloat(profile.latitude) : null,
        longitude: profile.longitude ? parseFloat(profile.longitude) : null,
        identity_url,
        updated_at: new Date().toISOString(),
        allergies: allergies.split(',').map(a => a.trim().toLowerCase()).filter(a => a.length > 0),
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
              onPress: () => navigation.navigate('Home'),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Save profile error:', error);
      Alert.alert('Error', 'An unexpected error occurred while saving');
      throw error;
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ 
        type: '*/*',
        copyToCacheDirectory: true,
      });
      
      if (result.type === 'success') {
        setIdentityDoc(result);
        Alert.alert('Document Selected', `Selected: ${result.name}`);
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to select document');
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

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(profile.email)) {
        Alert.alert('Error', 'Invalid email format');
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error('Password reset error:', error);
        
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

      {profile.email ? (
        <View style={styles.verificationContainer}>
          <Text style={[
            styles.verificationText,
            isEmailVerified ? styles.verified : styles.notVerified
          ]}>
            {isEmailVerified ? '✅ Email Verified' : '❌ Email Not Verified'}
          </Text>
          
          {!isEmailVerified && (
            <TouchableOpacity
              style={[styles.button, styles.verifyButton]}
              onPress={sendVerificationEmail}
              disabled={verificationLoading || verificationSent}
            >
              <Text style={styles.buttonText}>
                {verificationLoading 
                  ? 'Sending...' 
                  : verificationSent 
                    ? 'Email Sent!' 
                    : 'Verify Email'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Phone Number (+CountryCode)"
        value={profile.phone_number}
        onChangeText={(val) => setProfile({ ...profile, phone_number: val })}
        keyboardType="phone-pad"
      />

      <TextInput
        style={styles.input}
        placeholder="Date of Birth (YYYY-MM-DD)"
        value={profile.date_of_birth}
        onChangeText={(val) => setProfile({ ...profile, date_of_birth: val })}
      />

      <Text style={styles.sectionTitle}>🆔 Identity Verification</Text>

      <TouchableOpacity
        style={[styles.button, styles.documentButton]}
        onPress={pickDocument}
      >
        <Text style={styles.buttonText}>
          {identityDoc ? '✅ Identity Document Selected' : '📎 Upload Identity Document'}
        </Text>
      </TouchableOpacity>

      {identityDoc && (
        <Text style={styles.selectedDocText}>
          Selected: {identityDoc.name}
        </Text>
      )}

      <Text style={styles.sectionTitle}>📍 Location Information</Text>

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

      <Text style={styles.sectionTitle}>🍽️ Dietary Information</Text>

      <Text style={styles.label}>Allergies (comma separated)</Text>
      <TextInput
        style={styles.input}
        value={allergies}
        onChangeText={setAllergies}
        placeholder="e.g. peanuts, shellfish, dairy"
        multiline={true}
        numberOfLines={2}
      />

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

      <View style={styles.switchContainer}>
        <Text style={styles.switchLabel}>Recipe Suggestions:</Text>
        <Switch
          value={profile.recipe_suggestions_enabled}
          onValueChange={(val) => setProfile({ ...profile, recipe_suggestions_enabled: val })}
          trackColor={{ false: '#767577', true: '#00A86B' }}
          thumbColor={profile.recipe_suggestions_enabled ? '#fff' : '#f4f3f4'}
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
          style={[styles.button, styles.chatButton]}
          onPress={() => navigation.navigate('Chat', { 
            chatType: 'general', 
            title: 'Community Chat' 
          })}
        >
          <Text style={styles.buttonText}>💬 Community Chat</Text>
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
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#555',
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
  selectedDocText: {
    fontSize: 14,
    color: '#00A86B',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  verificationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  verificationText: {
    fontSize: 16,
    fontWeight: '600',
  },
  verified: {
    color: '#00A86B',
  },
  notVerified: {
    color: '#f44336',
  },
  verifyButton: {
    backgroundColor: '#FF9500',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginLeft: 10,
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
  documentButton: {
    backgroundColor: '#888',
  },
  resetButton: {
    backgroundColor: '#FF9500',
  },
  chatButton: {
    backgroundColor: '#007AFF',
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