import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '../lib/notifications';
import { AppState } from 'react-native';

const { width } = Dimensions.get('window');

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

  useEffect(() => {
  const updateOnlineStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ is_online: true }).eq('id', user.id);
    }
  };

  updateOnlineStatus();
}, []);

useEffect(() => {
  const handleAppStateChange = async (state) => {
    if (state === 'background' || state === 'inactive') {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').update({ is_online: false }).eq('id', user.id);
      }
    }
  };

  const subscription = AppState.addEventListener('change', handleAppStateChange);
  return () => subscription.remove();
}, []);

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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#00C897" />
          <Text style={{ marginTop: 10 }}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.error}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchDashboardData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#00C897']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <Text style={styles.greeting}>Good day!</Text>
          <Text style={styles.userName}>{name || 'Welcome'} 👋</Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{pantryCount}</Text>
            <Text style={styles.statLabel}>Items in Pantry</Text>
          </View>
          <View style={[styles.statCard, expiringSoon.length > 0 && styles.warningCard]}>
            <Text style={[styles.statNumber, expiringSoon.length > 0 && styles.warningNumber]}>
              {expiringSoon.length}
            </Text>
            <Text style={[styles.statLabel, expiringSoon.length > 0 && styles.warningLabel]}>
              Expiring Soon
            </Text>
          </View>
        </View>

        {/* Expiring Items Alert */}
        {expiringSoon.length > 0 && (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>⚠️ Items Expiring Soon</Text>
            {expiringSoon.slice(0, 3).map(item => (
              <Text key={item.id} style={styles.alertItem}>
                • {item.item_name} (expires {item.expiration_date})
              </Text>
            ))}
            {expiringSoon.length > 3 && (
              <Text style={styles.alertMore}>
                +{expiringSoon.length - 3} more items...
              </Text>
            )}
          </View>
        )}

        {/* Quick Actions Grid */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity 
              style={[styles.actionCard, styles.primaryAction]} 
              onPress={() => navigation.navigate('Add')}
            >
              <Text style={styles.actionIcon}>➕</Text>
              <Text style={styles.actionTitle}>Add Item</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionCard} 
              onPress={() => navigation.navigate('Pantry')}
            >
              <Text style={styles.actionIcon}>📦</Text>
              <Text style={styles.actionTitle}>My Pantry</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.actionGrid}>
            <TouchableOpacity 
              style={styles.actionCard} 
              onPress={() => navigation.navigate('Recipes')}
            >
              <Text style={styles.actionIcon}>🍽️</Text>
              <Text style={styles.actionTitle}>Recipes</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionCard} 
              onPress={() => navigation.navigate('Share')}
            >
              <Text style={styles.actionIcon}>🤝</Text>
              <Text style={styles.actionTitle}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingTop: 10,
    paddingBottom: 20, // Reduced bottom padding since tab bar handles it
  },
  headerSection: {
    marginBottom: 25,
  },
  greeting: {
    fontSize: 16,
    color: '#666',
    marginBottom: 5,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  statCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  warningCard: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
    borderWidth: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00C897',
    marginBottom: 5,
  },
  warningNumber: {
    color: '#856404',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  warningLabel: {
    color: '#856404',
  },
  alertCard: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 12,
    marginBottom: 25,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  alertTitle: {
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
    fontSize: 16,
  },
  alertItem: {
    color: '#856404',
    marginBottom: 3,
  },
  alertMore: {
    color: '#856404',
    fontStyle: 'italic',
    marginTop: 5,
  },
  quickActionsContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  actionCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryAction: {
    backgroundColor: '#00C897',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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