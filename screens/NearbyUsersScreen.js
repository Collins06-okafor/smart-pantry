import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, TouchableOpacity, Modal, FlatList, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');
const DISTANCE_OPTIONS = [0.5, 1, 2, 5, 10, 15, 25];

const NearbyUsersScreen = ({ navigation }) => {
  const [location, setLocation] = useState(null);
  const [radiusKm, setRadiusKm] = useState(2);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [mapRegion, setMapRegion] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();
  }, []);

  useEffect(() => {
    if (!location) return;

    async function fetchNearbyUsers() {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        setCurrentUserId(user.id);

        // Query profile table for users with location data
        const { data: profilesData, error: profilesError } = await supabase
          .from('profile')
          .select('id, name, surname, latitude, longitude, avatar_url')
          .neq('id', user.id) // Exclude current user
          .not('latitude', 'is', null) // Only users with location data
          .not('longitude', 'is', null)
          .gte('latitude', location.latitude - (radiusKm / 111)) // Rough rectangular search
          .lte('latitude', location.latitude + (radiusKm / 111))
          .gte('longitude', location.longitude - (radiusKm / (111 * Math.cos(location.latitude * Math.PI / 180))))
          .lte('longitude', location.longitude + (radiusKm / (111 * Math.cos(location.latitude * Math.PI / 180))));

        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
          setNearbyUsers([]);
          return;
        }

        // Calculate exact distance and filter users within radius
        const usersWithinRadius = (profilesData || []).filter(profile => {
          const distance = calculateDistance(
            location.latitude,
            location.longitude,
            profile.latitude,
            profile.longitude
          );
          return distance <= radiusKm;
        }).map(profile => ({
          id: profile.id,
          name: profile.name || 'Unknown User',
          surname: profile.surname,
          avatar_url: profile.avatar_url,
          latitude: profile.latitude,
          longitude: profile.longitude,
          distance: calculateDistance(
            location.latitude,
            location.longitude,
            profile.latitude,
            profile.longitude
          )
        }))
        .sort((a, b) => a.distance - b.distance); // Sort by distance

        setNearbyUsers(usersWithinRadius);

        // Calculate map region to fit all users
        if (usersWithinRadius.length > 0) {
          const allLats = [location.latitude, ...usersWithinRadius.map(u => u.latitude)];
          const allLngs = [location.longitude, ...usersWithinRadius.map(u => u.longitude)];
          
          const minLat = Math.min(...allLats);
          const maxLat = Math.max(...allLats);
          const minLng = Math.min(...allLngs);
          const maxLng = Math.max(...allLngs);
          
          const deltaLat = (maxLat - minLat) * 1.5; // Add padding
          const deltaLng = (maxLng - minLng) * 1.5;
          
          setMapRegion({
            latitude: (minLat + maxLat) / 2,
            longitude: (minLng + maxLng) / 2,
            latitudeDelta: Math.max(deltaLat, 0.01), // Minimum zoom level
            longitudeDelta: Math.max(deltaLng, 0.01),
          });
        } else {
          // Default region when no users found
          setMapRegion({
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: radiusKm / 50, // Adjust zoom based on radius
            longitudeDelta: radiusKm / 50,
          });
        }

      } catch (err) {
        setErrorMsg('Error fetching nearby users');
        console.error('Fetch error:', err);
        setNearbyUsers([]);
      }
    }

    fetchNearbyUsers();
  }, [location, radiusKm]);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const fitAllMarkers = () => {
    if (mapRef.current && nearbyUsers.length > 0) {
      const coordinates = [
        { latitude: location.latitude, longitude: location.longitude },
        ...nearbyUsers.map(user => ({ latitude: user.latitude, longitude: user.longitude }))
      ];
      
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
        animated: true,
      });
    }
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity style={styles.userItem}>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.surname || item.name}</Text>
        <Text style={styles.userDistance}>{item.distance.toFixed(1)} km away</Text>
      </View>
    </TouchableOpacity>
  );

  if (errorMsg) return <View style={styles.center}><Text>{errorMsg}</Text></View>;
  if (!location) return <View style={styles.center}><Text>Fetching location...</Text></View>;

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        style={styles.map}
        region={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
        clusteringEnabled={true}
        clusterColor="#00C897"
        clusterTextColor="#fff"
        clusterFontFamily="System"
      >
        {/* Render all markers with slight position adjustments to prevent overlap */}
        {nearbyUsers.length > 0 && nearbyUsers.map((user, index) => {
          // Add small random offset to prevent exact overlap
          const offsetLat = user.latitude + (Math.random() - 0.5) * 0.0001;
          const offsetLng = user.longitude + (Math.random() - 0.5) * 0.0001;
          
          return (
            <Marker
              key={user.id}
              coordinate={{ 
                latitude: offsetLat, 
                longitude: offsetLng 
              }}
              title={user.surname || user.name}
              description={`Distance: ${user.distance.toFixed(1)} km`}
              pinColor={index < 5 ? '#00C897' : '#FF6B6B'} // Different colors for first 5 users
            />
          );
        })}
      </MapView>

      {/* Info and Users List */}
      <View style={styles.bottomSection}>
        <View style={styles.infoHeader}>
          <Text style={styles.subText}>Showing users nearest to you (max 50 shown)</Text>
          <Text style={styles.mainText}>Other users near you</Text>
          <Text style={styles.countText}>{nearbyUsers.length}</Text>

          {/* Distance Selector */}
          <TouchableOpacity onPress={() => setDropdownVisible(true)} style={styles.dropdownButton}>
            <Text style={styles.dropdownText}>Search distance: {radiusKm} km ▼</Text>
          </TouchableOpacity>
        </View>

        {/* Users List */}
        {nearbyUsers.length === 0 ? (
          <View style={styles.noUsersContainer}>
            <Text style={styles.noUsersText}>
              No users found within {radiusKm} km of your location
            </Text>
          </View>
        ) : (
          <FlatList
            data={nearbyUsers}
            keyExtractor={(item) => item.id}
            renderItem={renderUserItem}
            style={styles.usersList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Dropdown Modal */}
        <Modal visible={dropdownVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <FlatList
                data={DISTANCE_OPTIONS}
                keyExtractor={(item) => item.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => {
                    setRadiusKm(item);
                    setDropdownVisible(false);
                  }}>
                    <Text style={[styles.modalItem, radiusKm === item && styles.selectedItem]}>
                      {item} km {radiusKm === item && '✓'}
                    </Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity onPress={() => setDropdownVisible(false)}>
                <Text style={styles.doneButton}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width, height: height * 0.4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bottomSection: {
    flex: 1,
    backgroundColor: '#fff',
  },
  infoHeader: {
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  subText: {
    fontSize: 12,
    color: 'gray',
    marginBottom: 5,
  },
  mainText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 10,
  },
  countText: {
    fontSize: 48,
    color: '#00C897',
    fontWeight: 'bold',
    marginVertical: 20,
  },
  dropdownButton: {
    marginTop: 10,
    borderBottomWidth: 1,
    borderColor: '#999',
    paddingBottom: 5,
  },
  dropdownText: {
    fontSize: 16,
    color: '#444',
  },
  noUsersContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noUsersText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  usersList: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userDistance: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopRightRadius: 16,
    borderTopLeftRadius: 16,
  },
  modalItem: {
    fontSize: 18,
    paddingVertical: 10,
  },
  selectedItem: {
    color: '#00C897',
    fontWeight: '600',
  },
  doneButton: {
    marginTop: 20,
    textAlign: 'right',
    fontSize: 16,
    color: '#00C897',
    fontWeight: '600',
  },
  fitMarkersButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    backgroundColor: '#00C897',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fitMarkersText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default NearbyUsersScreen;