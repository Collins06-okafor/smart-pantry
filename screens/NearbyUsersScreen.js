import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform, TouchableOpacity, Modal, FlatList } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../lib/supabase';

const { width, height } = Dimensions.get('window');
const DISTANCE_OPTIONS = [0.5, 1, 2, 5, 10, 15, 25];

const NearbyUsersScreen = () => {
  const [location, setLocation] = useState(null);
  const [radiusKm, setRadiusKm] = useState(2);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);

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
        // Mock nearby users for now
        setNearbyUsers([
          { id: '1', name: 'Alice', latitude: location.latitude + 0.01, longitude: location.longitude + 0.01 },
          { id: '2', name: 'Bob', latitude: location.latitude - 0.01, longitude: location.longitude - 0.01 },
          { id: '3', name: 'Charlie', latitude: location.latitude + 0.005, longitude: location.longitude - 0.007 },
        ]);
      } catch (err) {
        setErrorMsg('Error fetching nearby users');
        console.error(err);
      }
    }

    fetchNearbyUsers();
  }, [location, radiusKm]);

  if (errorMsg) return <View style={styles.center}><Text>{errorMsg}</Text></View>;
  if (!location) return <View style={styles.center}><Text>Fetching location...</Text></View>;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}></Text>
      </View>

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
      >
        {nearbyUsers.map(user => (
          <Marker
            key={user.id}
            coordinate={{ latitude: user.latitude, longitude: user.longitude }}
            title={user.name}
          />
        ))}
      </MapView>

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Text style={styles.subText}>Showing users nearest to you (max 50 shown)</Text>
        <Text style={styles.mainText}>Other users near you</Text>
        <Text style={styles.countText}>{nearbyUsers.length}</Text>

        {/* Distance Selector */}
        <TouchableOpacity onPress={() => setDropdownVisible(true)} style={styles.dropdownButton}>
          <Text style={styles.dropdownText}>Search distance: {radiusKm} km ▼</Text>
        </TouchableOpacity>

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
                    <Text style={styles.modalItem}>{item} km</Text>
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
  map: { width, height: height * 0.5 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    height: 60,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  infoBox: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    padding: 20,
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
  ctaButton: {
    backgroundColor: '#00C897',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 50,
    marginTop: 30,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  doneButton: {
    marginTop: 20,
    textAlign: 'right',
    fontSize: 16,
    color: '#00C897',
    fontWeight: '600',
  },
});

export default NearbyUsersScreen;
