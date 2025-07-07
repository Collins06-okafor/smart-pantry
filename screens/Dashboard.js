import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '../lib/notifications';

export default function Dashboard({ navigation }) {
  const [name, setName] = useState('');
  const [pantryCount, setPantryCount] = useState(0);
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    registerForPushNotificationsAsync();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  const fetchDashboardData = async () => {
    if (!refreshing) setLoading(true);
    setError(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!user || userError) {
        setError('User not authenticated');
        return;
      }

      const [profileResult, pantryResult] = await Promise.all([
        supabase
          .from('profile')
          .select('name')
          .eq('id', user.id)
          .single(),
        supabase
          .from('pantry_items')
          .select('*')
          .eq('user_id', user.id)
      ]);

      const { data: profile } = profileResult;
      const { data: pantryItems, error: pantryError } = pantryResult;

      if (profile?.name) {
        setName(profile.name.split(' ')[0]);
      }

      if (pantryError) {
        setError('Failed to load pantry data');
        return;
      }

      const safeItems = Array.isArray(pantryItems) ? pantryItems : [];
      setPantryCount(safeItems.length);

      const expiring = calculateExpiringSoon(safeItems);
      setExpiringSoon(expiring);

      expiring.forEach(item => {
        scheduleExpiryNotification(item.item_name, item.expiration_date);
      });

    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, []);

  const calculateExpiringSoon = (items) => {
    const today = new Date();
    const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);

    return items.filter(item => {
      if (!item?.expiration_date) return false;
      const expDate = new Date(item.expiration_date);
      return expDate >= today && expDate <= threeDaysFromNow;
    });
  };

  const scheduleExpiryNotification = async (itemName, date) => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🥫 Pantry Alert!',
        body: `${itemName} expires on ${date}`,
        sound: 'default',
      },
      trigger: {
        seconds: 5,
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C897" />
        <Text style={{ marginTop: 10 }}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Error: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchDashboardData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#00C897']}
        />
      }
    >
      <Text style={styles.header}>Hi, {name || 'there'}! 👋</Text>
      <Text style={styles.subText}>You have {pantryCount} item(s) in your pantry.</Text>
      <Text style={styles.subText}>🕑 {expiringSoon.length} item(s) expiring soon!</Text>

      {expiringSoon.length > 0 && (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>⚠️ Items Expiring Soon</Text>
          {expiringSoon.map(item => (
            <Text key={item.id} style={styles.warningItem}>
              • {item.item_name} (expires {item.expiration_date})
            </Text>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('AddItem')}>
        <Text style={styles.buttonText}>➕ Add Pantry Item</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Pantry')}>
        <Text style={styles.buttonText}>📦 View Pantry</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Recipes')}>
        <Text style={styles.buttonText}>🍽️ View Recipes</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Share')}>
        <Text style={styles.buttonText}>🤝 Nearby Sharing</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.button} 
        onPress={() => navigation.navigate('Profile')}
        >
        <Text style={styles.buttonText}>⚙️ Profile & Settings</Text>
      </TouchableOpacity>

      <TouchableOpacity
  onPress={() => navigation.navigate('RequestFood')}
  style={{
    backgroundColor: '#5a2ca0',
    padding: 14,
    borderRadius: 25,
    marginTop: 20,
    alignItems: 'center'
  }}
>
  <Text style={{ color: '#fff', fontWeight: 'bold' }}>📢 Request Food</Text>
</TouchableOpacity>



    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 50,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subText: {
    fontSize: 16,
    marginBottom: 5,
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    padding: 10,
    borderRadius: 8,
    marginVertical: 10,
  },
  warningTitle: {
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 4,
  },
  warningItem: {
    color: '#856404',
  },
  button: {
    backgroundColor: '#00C897',
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#00C897',
    borderRadius: 6,
  },
  retryText: {
    color: '#fff',
  },
  error: {
    color: 'red',
    textAlign: 'center',
  },
});
