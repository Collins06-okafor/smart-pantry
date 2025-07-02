import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

export default function LocationPickerScreen({ navigation }) {
  const [region, setRegion] = useState(null);
  const mapRef = useRef(null);
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    fetchUserName();
    locateMe();
  }, []);

  const fetchUserName = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profile')
          .select('name')
          .eq('id', user.id)
          .single();
        if (data?.name) {
          setFirstName(data.name.split(' ')[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching user name:', error);
    }
  };

  const locateMe = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location access is required to continue.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Location Error', 'Could not get your current location.');
    }
  };

  const handleSetHomeLocation = async () => {
    if (!region) {
      Alert.alert('Error', 'Please select a location first.');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { error } = await supabase
          .from('profile')
          .update({
            latitude: region.latitude,
            longitude: region.longitude,
          })
          .eq('id', user.id);

        if (error) {
          Alert.alert('Error', 'Could not save your location.');
          return;
        }

        navigation.replace('Dashboard');
      }
    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert('Error', 'Could not save your location.');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Hi{firstName ? `, ${firstName}` : ''} 👋</Text>
        <Text style={styles.subtitle}>
          Set your home location{'\n'}
          Tap "Locate me" or tap anywhere on the map to set your location.
        </Text>
      </View>

      {region && (
        <MapView
          provider="google"
          style={{ flex: 1 }}
          region={region}
          ref={mapRef}
          onPress={(event) => {
            // Allow users to tap on map to set location
            const { latitude, longitude } = event.nativeEvent.coordinate;
            setRegion({
              latitude,
              longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }}
        >
          <Marker
            coordinate={{
              latitude: region.latitude,
              longitude: region.longitude,
            }}
            title="Selected Location"
            description="Your home location"
            draggable={true}
            onDragEnd={(event) => {
              const { latitude, longitude } = event.nativeEvent.coordinate;
              setRegion({
                latitude,
                longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              });
            }}
          />
        </MapView>
      )}

      {!region && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Getting your location...</Text>
          <TouchableOpacity onPress={locateMe} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity onPress={locateMe} style={styles.locateButton}>
          <Text style={styles.locateText}>📍 Use current location</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, !region && styles.buttonDisabled]} 
          onPress={handleSetHomeLocation}
          disabled={!region}
        >
          <Text style={styles.buttonText}>Set as home location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { 
    padding: 20,
    backgroundColor: '#fff',
    elevation: 2,
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: { 
    fontSize: 14, 
    color: '#555', 
    marginTop: 10,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#5a2ca0',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  controls: {
    padding: 20,
    backgroundColor: '#fff',
    elevation: 2,
  },
  locateButton: {
    marginBottom: 15,
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 25,
    alignItems: 'center',
  },
  locateText: {
    fontSize: 16,
    color: '#5a2ca0',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#5a2ca0',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
    elevation: 2,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
