import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, FlatList, Keyboard } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';

export default function LocationPickerScreen({ navigation }) {
  const [region, setRegion] = useState(null);
  const mapRef = useRef(null);
  const [firstName, setFirstName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

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

  const searchLocations = async (query) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      // Using OpenStreetMap Nominatim API for geocoding (free alternative)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`
      );
      const data = await response.json();
      
      const results = data.map(item => ({
        id: item.place_id,
        name: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        address: item.display_name,
      }));
      
      setSearchResults(results);
      setShowResults(true);
    } catch (error) {
      console.error('Error searching locations:', error);
      Alert.alert('Search Error', 'Could not search for locations.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    // Debounce search to avoid too many API calls
    clearTimeout(searchTimeout);
    const searchTimeout = setTimeout(() => {
      searchLocations(text);
    }, 500);
  };

  const selectSearchResult = (result) => {
    setRegion({
      latitude: result.latitude,
      longitude: result.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
    setSearchQuery(result.name);
    setShowResults(false);
    setSearchResults([]);
    Keyboard.dismiss();
    
    // Animate map to the selected location
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: result.latitude,
        longitude: result.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    Keyboard.dismiss();
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

        navigation.replace('MainTabs', { screen: 'Dashboard' });

      }
    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert('Error', 'Could not save your location.');
    }
  };

  const renderSearchResult = ({ item }) => (
    <TouchableOpacity 
      style={styles.searchResult}
      onPress={() => selectSearchResult(item)}
    >
      <Text style={styles.resultTitle} numberOfLines={1}>
        {item.name.split(',')[0]}
      </Text>
      <Text style={styles.resultAddress} numberOfLines={2}>
        {item.address}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Text style={styles.title}>Hi{firstName ? `, ${firstName}` : ''} 👋</Text>
        <Text style={styles.subtitle}>
          Set your home location{'\n'}
          Search for a location, tap "Locate me" or tap anywhere on the map.
        </Text>
        
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a location..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={() => setShowResults(searchResults.length > 0)}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results */}
      {showResults && searchResults.length > 0 && (
        <View style={styles.searchResultsContainer}>
          <FlatList
            data={searchResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => item.id.toString()}
            style={styles.searchResults}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}

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
            setShowResults(false);
            Keyboard.dismiss();
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
    zIndex: 1000,
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
  searchContainer: {
    marginTop: 15,
    position: 'relative',
  },
  searchInput: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 25,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  clearButton: {
    position: 'absolute',
    right: 15,
    top: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchResultsContainer: {
    backgroundColor: '#fff',
    elevation: 3,
    zIndex: 999,
    maxHeight: 200,
  },
  searchResults: {
    backgroundColor: '#fff',
  },
  searchResult: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  resultAddress: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
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