import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

export default function LocationPickerScreen({ navigation }) {
  const [region, setRegion] = useState(null);
  const mapRef = useRef(null);
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    fetchUserName();
    locateMe();
  }, []);

  const fetchUserName = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();
      if (data?.name) {
        setFirstName(data.name.split(' ')[0]);
      }
    }
  };

  const locateMe = async () => {
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
  };

  const handleSetHomeLocation = async () => {
    if (!region) return;

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({
          latitude: region.latitude,
          longitude: region.longitude,
        })
        .eq('id', user.id);

      if (error) {
        Alert.alert('Error', 'Could not save your location.');
        return;
      }

      navigation.replace('Dashboard'); // Proceed to app
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Hi{firstName ? `, ${firstName}` : ''} 👋</Text>
        <Text style={styles.subtitle}>
          Set your location{'\n'}Don’t worry, we won’t share this with anyone else.
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <GooglePlacesAutocomplete
          placeholder="Search for a location"
          fetchDetails={true}
          onPress={(data, details = null) => {
            if (!details || !details.geometry || !details.geometry.location) {
                console.error("Missing details data", { data, details });
                Alert.alert("Location Error", "Could not get coordinates for the selected place.");
                return;
            }

            const lat = details.geometry.location.lat;
            const lng = details.geometry.location.lng;

            const newRegion = {
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };

            setRegion(newRegion);
            mapRef.current?.animateToRegion(newRegion, 1000);
            }}
          query={{
            key: 'AIzaSyCZdKRukNvtA6YzdyQnaDaIGoqVop0aDhg',
            language: 'en',
          }}
          styles={{
            container: styles.autocompleteContainer,
            textInput: styles.textInput,
            listView: styles.listView,
          }}
          enablePoweredByContainer={false}
        />
      </View>

      {region && (
        <MapView
          provider="google"
          style={{ flex: 1 }}
          region={region}
          ref={mapRef}
        >
          <Marker
            coordinate={{
              latitude: region.latitude,
              longitude: region.longitude,
            }}
            title="You are here"
          />
        </MapView>
      )}

      <View style={styles.controls}>
        <TouchableOpacity onPress={locateMe}>
          <Text style={styles.locateText}>📍 Locate me</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleSetHomeLocation}>
          <Text style={styles.buttonText}>Set home location</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 14, color: '#555', marginTop: 10 },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  autocompleteContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  textInput: {
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    elevation: 2,
  },
  listView: {
    backgroundColor: 'white',
    borderRadius: 10,
    elevation: 3,
  },
  map: { flex: 1 },
  controls: {
    padding: 20,
    backgroundColor: '#fff',
  },
  locateText: {
    fontSize: 16,
    color: '#5a2ca0',
    textAlign: 'center',
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#5a2ca0',
    padding: 15,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
