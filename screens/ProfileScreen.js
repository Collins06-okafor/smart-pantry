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
  Image,
  Platform,
  Dimensions,
} from 'react-native';
import { supabase } from '../lib/supabase';
import * as Location from 'expo-location';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';


const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { theme, toggleTheme, themeName } = useTheme();

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
    profile_photo_url: '',
    is_sharing: true,
    expiry_alerts_enabled: true,
    recipe_suggestions_enabled: true,
  });

  const [identityDoc, setIdentityDoc] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [wasteSavedCount, setWasteSavedCount] = useState(0);
  const [allergies, setAllergies] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState(new Date());

  const validatePhoneNumber = (phoneNumber) => {
    const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
    
    if (!cleanNumber.startsWith('+')) {
      return { isValid: false, error: 'Phone number must start with country code (+)' };
    }
    
    const numberWithoutPlus = cleanNumber.slice(1);
    const countryCodeRules = {
      '1': 11, '7': 11, '20': 12, '27': 11, '30': 12, '31': 11, '32': 11,
      '33': 11, '34': 11, '36': 11, '39': 12, '40': 11, '41': 11, '43': 12,
      '44': 12, '45': 10, '46': 11, '47': 10, '48': 11, '49': 12, '52': 12,
      '53': 10, '54': 12, '55': 13, '56': 11, '57': 12, '58': 11, '60': 11,
      '61': 11, '62': 12, '63': 12, '64': 11, '65': 10, '66': 11, '81': 12,
      '82': 12, '84': 11, '86': 13, '90': 13, '91': 12, '92': 12, '93': 11,
      '94': 11, '95': 11, '98': 12,
    };
    
    let maxLength = 15;
    let matchedCountryCode = '';
    
    if (countryCodeRules[numberWithoutPlus.slice(0, 1)]) {
      matchedCountryCode = numberWithoutPlus.slice(0, 1);
      maxLength = countryCodeRules[matchedCountryCode];
    }
    else if (countryCodeRules[numberWithoutPlus.slice(0, 2)]) {
      matchedCountryCode = numberWithoutPlus.slice(0, 2);
      maxLength = countryCodeRules[matchedCountryCode];
    }
    else if (countryCodeRules[numberWithoutPlus.slice(0, 3)]) {
      matchedCountryCode = numberWithoutPlus.slice(0, 3);
      maxLength = countryCodeRules[matchedCountryCode];
    }
    
    if (cleanNumber.length > maxLength) {
      return { 
        isValid: false, 
        error: `Phone number too long. Maximum ${maxLength} digits for this country code.`,
        maxLength 
      };
    }
    
    if (cleanNumber.length < 8) {
      return { 
        isValid: false, 
        error: 'Phone number too short. Must include country code and at least 6 digits.' 
      };
    }
    
    return { isValid: true, cleanNumber, maxLength };
  };

  const handlePhoneNumberChange = (value) => {
    let cleanValue = value.replace(/[^\d+]/g, '');
    
    if (cleanValue && !cleanValue.startsWith('+')) {
      cleanValue = '+' + cleanValue;
    }
    
    const validation = validatePhoneNumber(cleanValue);
    
    if (validation.isValid || cleanValue.length <= (validation.maxLength || 15)) {
      setProfile({ ...profile, phone_number: cleanValue });
    }
  };

  const uploadProfilePhoto = async (user, photo) => {
    try {
      const fileName = `profile_${user.id}/${Date.now()}.jpg`;
      
      const response = await fetch(photo.uri);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('user-profile-photos')
        .upload(fileName, blob, {
          contentType: photo.type || 'image/jpeg',
          upsert: true,
          cacheControl: '3600'
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('user-profile-photos')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Photo upload failed:', error);
      throw new Error('Failed to upload profile photo');
    }
  };

  const selectProfilePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'We need access to your photo library to select a profile picture.'
        );
        return;
      }

      Alert.alert(
        'Select Profile Photo',
        'Choose how you want to select your profile photo',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Take Photo', onPress: () => takePhoto() },
          { text: 'Choose from Library', onPress: () => pickFromLibrary() },
        ]
      );
    } catch (error) {
      console.error('Photo selection error:', error);
      Alert.alert('Error', 'Failed to select photo');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'We need access to your camera to take a profile picture.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setProfilePhoto({
          uri: result.assets[0].uri,
          type: result.assets[0].type || 'image/jpeg',
          name: `profile_${Date.now()}.jpg`
        });
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setProfilePhoto({
          uri: result.assets[0].uri,
          type: result.assets[0].type || 'image/jpeg',
          name: `profile_${Date.now()}.jpg`
        });
      }
    } catch (error) {
      console.error('Library picker error:', error);
      Alert.alert('Error', 'Failed to select photo from library');
    }
  };

  const removeProfilePhoto = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => {
          setProfilePhoto(null);
          setProfile({ ...profile, profile_photo_url: '' });
        }},
      ]
    );
  };

  const getDefaultAvatar = () => {
    const initials = `${profile.name?.charAt(0) || ''}${profile.surname?.charAt(0) || ''}`.toUpperCase();
    return initials || '👤';
  };

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
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
          profile_photo_url: data.profile_photo_url || '',
          expiry_alerts_enabled: data.expiry_alerts_enabled ?? true,
          recipe_suggestions_enabled: data.recipe_suggestions_enabled ?? true,
        });
        
        if (data.date_of_birth) {
          setDateOfBirth(new Date(data.date_of_birth));
        }
        
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
      const { data: { user } } = await supabase.auth.getUser();
      
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

  useEffect(() => {
    loadProfile();
    fetchWasteStats();
  }, [loadProfile, fetchWasteStats]);

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
    const { name, surname, email, phone_number } = profile;

    if (!name?.trim()) errors.push('Name is required');
    if (!surname?.trim()) errors.push('Surname is required');
    if (!email?.trim()) errors.push('Email is required');

    if (phone_number) {
      const phoneValidation = validatePhoneNumber(phone_number);
      if (!phoneValidation.isValid) {
        errors.push(phoneValidation.error);
      }
    }

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
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        Alert.alert('Error', 'Authentication failed');
        return;
      }

      let profile_photo_url = profile.profile_photo_url;

      if (profilePhoto) {
        try {
          profile_photo_url = await uploadProfilePhoto(user, profilePhoto);
        } catch (error) {
          console.error('Photo upload error:', error);
          Alert.alert('Upload Error', error.message || 'Failed to upload profile photo');
          return;
        }
      }

      const updates = {
        ...profile,
        id: user.id,
        latitude: profile.latitude ? parseFloat(profile.latitude) : null,
        longitude: profile.longitude ? parseFloat(profile.longitude) : null,
        profile_photo_url,
        updated_at: new Date().toISOString(),
        allergies: allergies.split(',').map(a => a.trim().toLowerCase()).filter(a => a.length > 0),
      };

      const { error } = await supabase.from('profile').upsert(updates);
      
      if (error) {
        console.error('Save error:', error);
        Alert.alert('Error', `Failed to update profile: ${error.message}`);
      } else {
        Alert.alert('Success', 'Profile updated successfully!');
      }
    } catch (error) {
      console.error('Save profile error:', error);
      Alert.alert('Error', 'An unexpected error occurred while saving');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ 
        type: ['application/pdf', 'image/*'],
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

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDateOfBirth(selectedDate);
      setProfile({
        ...profile,
        date_of_birth: selectedDate.toISOString().split('T')[0]
      });
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.addButton} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screenContainer, { backgroundColor: theme.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={[styles.header, { backgroundColor: theme.tabBar, borderBottomColor: theme.tabBarInactive }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Theme Toggle Button */}
        <View style={{ alignItems: 'center', marginVertical: 10 }}>
          <TouchableOpacity
            onPress={toggleTheme}
            style={{
              backgroundColor: theme.addButton,
              paddingVertical: 8,
              paddingHorizontal: 20,
              borderRadius: 20,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>
              Switch to {themeName === 'light' ? 'Dark' : 'Light'} Mode
            </Text>
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.tabBar, shadowColor: theme.text }]}>
          <TouchableOpacity onPress={selectProfilePhoto} style={styles.avatarContainer}>
            {profilePhoto?.uri || profile.profile_photo_url ? (
              <Image
                source={{ uri: profilePhoto?.uri || profile.profile_photo_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.defaultAvatar, { backgroundColor: theme.addButton }]}>
                <Text style={styles.avatarText}>{getDefaultAvatar()}</Text>
              </View>
            )}
            <View style={[styles.cameraIcon, { backgroundColor: theme.addButton }]}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={[styles.userName, { color: theme.text }]}>{profile.name} {profile.surname}</Text>
          <Text style={[styles.userEmail, { color: theme.tabBarInactive }]}>{profile.email}</Text>
          
          <View style={[styles.verificationBadge, { backgroundColor: themeName === 'light' ? '#E8F5E9' : '#222' }]}>
            <Ionicons 
              name={isEmailVerified ? "checkmark-circle" : "close-circle"} 
              size={16} 
              color={isEmailVerified ? "#4CAF50" : "#F44336"} 
            />
            <Text style={[styles.verificationText, { color: isEmailVerified ? "#4CAF50" : "#F44336" }]}>
              {isEmailVerified ? 'Verified' : 'Not Verified'}
            </Text>
          </View>
        </View>

        {/* Stats Card */}
        <View style={[styles.statsCard, { backgroundColor: theme.tabBar, shadowColor: theme.text }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.addButton }]}>{wasteSavedCount}</Text>
            <Text style={[styles.statLabel, { color: theme.tabBarInactive }]}>Items Saved</Text>
          </View>
          <View style={styles.statSeparator} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.addButton }]}>4.5</Text>
            <Text style={[styles.statLabel, { color: theme.tabBarInactive }]}>Rating</Text>
          </View>
          <View style={styles.statSeparator} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.addButton }]}>45</Text>
            <Text style={[styles.statLabel, { color: theme.tabBarInactive }]}>Orders</Text>
          </View>
        </View>

        {/* Personal Information Section */}
        <View style={[styles.section, { backgroundColor: theme.tabBar, shadowColor: theme.text }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Personal Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Full Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.tabBarInactive }]}
              placeholder="Enter your full name"
              placeholderTextColor={theme.tabBarInactive}
              value={profile.name}
              onChangeText={(val) => setProfile({ ...profile, name: val })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Surname</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.tabBarInactive }]}
              placeholder="Enter your surname"
              placeholderTextColor={theme.tabBarInactive}
              value={profile.surname}
              onChangeText={(val) => setProfile({ ...profile, surname: val })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Email</Text>
            <TextInput
              style={[styles.input, styles.disabledInput, { backgroundColor: theme.background, color: theme.tabBarInactive, borderColor: theme.tabBarInactive }]}
              placeholder="Your email"
              placeholderTextColor={theme.tabBarInactive}
              value={profile.email}
              editable={false}
            />
            {!isEmailVerified && (
              <TouchableOpacity 
                style={[styles.verifyButton, { backgroundColor: theme.addButton }]} 
                onPress={sendVerificationEmail}
                disabled={verificationLoading || verificationSent}
              >
                <Text style={styles.verifyButtonText}>
                  {verificationLoading ? 'Sending...' : verificationSent ? 'Sent!' : 'Verify Email'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Phone Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.tabBarInactive }]}
              placeholder="+CountryCode Number"
              placeholderTextColor={theme.tabBarInactive}
              value={profile.phone_number}
              onChangeText={handlePhoneNumberChange}
              keyboardType="phone-pad"
              maxLength={15}
            />
            <Text style={[styles.helperText, { color: theme.tabBarInactive }]}>Include country code (e.g., +905551234567)</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Date of Birth</Text>
            <TouchableOpacity
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.tabBarInactive }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={profile.date_of_birth ? [styles.inputText, { color: theme.text }] : [styles.placeholderText, { color: theme.tabBarInactive }]}>
                {profile.date_of_birth || 'Select your date of birth'}
              </Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={dateOfBirth}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>
        </View>

        {/* Location Section */}
        <View style={[styles.section, { backgroundColor: theme.tabBar, shadowColor: theme.text }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Location Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>City</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.tabBarInactive }]}
              placeholder="Enter your city"
              placeholderTextColor={theme.tabBarInactive}
              value={profile.city}
              onChangeText={(val) => setProfile({ ...profile, city: val })}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Address</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.tabBarInactive }]}
              placeholder="Enter your address"
              placeholderTextColor={theme.tabBarInactive}
              value={profile.address}
              onChangeText={(val) => setProfile({ ...profile, address: val })}
            />
          </View>

          <View style={styles.coordinatesRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Latitude</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.tabBarInactive }]}
                placeholder="Latitude"
                placeholderTextColor={theme.tabBarInactive}
                keyboardType="numeric"
                value={profile.latitude}
                onChangeText={(val) => setProfile({ ...profile, latitude: val })}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Longitude</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.tabBarInactive }]}
                placeholder="Longitude"
                placeholderTextColor={theme.tabBarInactive}
                keyboardType="numeric"
                value={profile.longitude}
                onChangeText={(val) => setProfile({ ...profile, longitude: val })}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.locationButton, { backgroundColor: theme.addButton }]}
            onPress={fetchCurrentLocation}
            disabled={locationLoading}
          >
            <Ionicons name="location" size={20} color="#fff" />
            <Text style={styles.locationButtonText}>
              {locationLoading ? 'Getting Location...' : 'Use Current Location'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Preferences Section */}
        <View style={[styles.section, { backgroundColor: theme.tabBar, shadowColor: theme.text }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Preferences</Text>
          
          <View style={styles.preferenceItem}>
            <View>
              <Text style={[styles.preferenceLabel, { color: theme.text }]}>Sharing Enabled</Text>
              <Text style={[styles.preferenceDescription, { color: theme.tabBarInactive }]}>Allow sharing your items with others</Text>
            </View>
            <Switch
              value={profile.is_sharing}
              onValueChange={(val) => setProfile({ ...profile, is_sharing: val })}
              trackColor={{ false: '#E0E0E0', true: '#43d9b4' }}
              thumbColor={profile.is_sharing ? theme.addButton : '#f4f3f4'}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View>
              <Text style={[styles.preferenceLabel, { color: theme.text }]}>Expiry Alerts</Text>
              <Text style={[styles.preferenceDescription, { color: theme.tabBarInactive }]}>Get notifications for expiring items</Text>
            </View>
            <Switch
              value={profile.expiry_alerts_enabled}
              onValueChange={(val) => setProfile({ ...profile, expiry_alerts_enabled: val })}
              trackColor={{ false: '#E0E0E0', true: '#43d9b4' }}
              thumbColor={profile.expiry_alerts_enabled ? theme.addButton : '#f4f3f4'}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View>
              <Text style={[styles.preferenceLabel, { color: theme.text }]}>Recipe Suggestions</Text>
              <Text style={[styles.preferenceDescription, { color: theme.tabBarInactive }]}>Get personalized recipe recommendations</Text>
            </View>
            <Switch
              value={profile.recipe_suggestions_enabled}
              onValueChange={(val) => setProfile({ ...profile, recipe_suggestions_enabled: val })}
              trackColor={{ false: '#E0E0E0', true: '#43d9b4' }}
              thumbColor={profile.recipe_suggestions_enabled ? theme.addButton : '#f4f3f4'}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Allergies</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top', backgroundColor: theme.background, color: theme.text, borderColor: theme.tabBarInactive }]}
              value={allergies}
              onChangeText={setAllergies}
              placeholder="List your allergies (comma separated)"
              placeholderTextColor={theme.tabBarInactive}
              multiline={true}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.addButton }]}
            onPress={saveProfile}
            disabled={saving}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? 'Saving...' : 'Save Profile'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={resetPassword}
          >
            <Text style={styles.secondaryButtonText}>Reset Password</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chatButton, { borderColor: theme.addButton }]}
            onPress={() => navigation.navigate('Chat', { 
              chatType: 'general', 
              title: 'Community Chat' 
            })}
          >
            <Ionicons name="chatbubbles" size={20} color={theme.addButton} />
            <Text style={[styles.chatButtonText, { color: theme.addButton }]}>Community Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.logoutButton, { borderColor: '#F44336' }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={20} color="#F44336" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContainer: {
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    width: 24,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  defaultAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    color: 'white',
    fontWeight: 'bold',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#00C897',
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 10,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
  },
  verificationText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 5,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 12,
    color: '#757575',
    marginTop: 5,
  },
  statSeparator: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 5,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#616161',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
    color: '#333',
  },
  inputText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    fontSize: 16,
    color: '#9E9E9E',
  },
  disabledInput: {
    backgroundColor: '#F5F5F5',
    color: '#9E9E9E',
  },
  helperText: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 5,
  },
  verifyButton: {
    backgroundColor: '#00C897',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  verifyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  coordinatesRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  locationButton: {
    flexDirection: 'row',
    backgroundColor: '#00C897',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  preferenceLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  preferenceDescription: {
    fontSize: 12,
    color: '#9E9E9E',
    marginTop: 2,
  },
  actionsContainer: {
    paddingHorizontal: 20,
  },
  primaryButton: {
    backgroundColor: '#00C897',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  chatButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#00C897',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  chatButtonText: {
    color: '#00C897',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F44336',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#757575',
  },
});