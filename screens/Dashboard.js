import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  AppState,
  StyleSheet,
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
  const [discardedStats, setDiscardedStats] = useState({ thisMonth: 0, total: 0 });

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
        await supabase.from('profile').update({ is_online: true }).eq('id', user.id);
      }
    };
    updateOnlineStatus();
  }, []);

  useEffect(() => {
    const handleAppStateChange = async (state) => {
      if (state === 'background' || state === 'inactive') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profile').update({ is_online: false }).eq('id', user.id);
        }
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

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
        supabase.from('profile').select('name').eq('id', user.id).single(),
        supabase.from('pantry_items').select('*').eq('user_id', user.id),
      ]);

      const { data: profile } = profileResult;
      const pantryItems = pantryResult.data || [];

      if (profile?.name) {
        setName(profile.name.split(' ')[0]);
      }

      setPantryCount(pantryItems.length);
      const expiring = calculateExpiringSoon(pantryItems);
      setExpiringSoon(expiring);

      const stats = await fetchDiscardedStats(user.id);
      setDiscardedStats(stats);

      expiring.forEach((item) => {
        scheduleExpiryNotification(item.item_name, item.expiration_date);
      });
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Unexpected error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchDiscardedStats = async (userId) => {
    const { data, error } = await supabase
      .from('discarded_items')
      .select('timestamp')
      .eq('user_id', userId);

    if (error) return { thisMonth: 0, total: 0 };

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const thisMonthCount = data.filter((item) => {
      const d = new Date(item.timestamp);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;

    return { thisMonth: thisMonthCount, total: data.length };
  };

  const calculateExpiringSoon = (items) => {
    const today = new Date();
    const threeDaysFromNow = new Date(today.getTime() + 3 * 86400000);
    return items.filter((item) => {
      if (!item.expiration_date) return false;
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
      trigger: { seconds: 5 },
    });
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#00C897" />
        <Text>Loading dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Logout Button */}
      <View style={styles.logoutRow}>
        <View />
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.greeting}>Good day!</Text>
        <Text style={styles.userName}>{name || 'Welcome'} 👋</Text>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{pantryCount}</Text>
            <Text style={styles.statLabel}>Items in Pantry</Text>
          </View>
          <View
            style={[
              styles.statCard,
              expiringSoon.length > 0 && styles.warningCard,
            ]}
          >
            <Text
              style={[
                styles.statNumber,
                expiringSoon.length > 0 && styles.warningNumber,
              ]}
            >
              {expiringSoon.length}
            </Text>
            <Text
              style={[
                styles.statLabel,
                expiringSoon.length > 0 && styles.warningLabel,
              ]}
            >
              Expiring Soon
            </Text>
          </View>
        </View>

        {/* Expiring Soon Section */}
        {expiringSoon.length > 0 && (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>⚠️ Items Expiring Soon</Text>
            {expiringSoon.slice(0, 3).map((item) => (
              <Text key={item.id} style={styles.alertItem}>
                • {item.item_name} (expires {item.expiration_date})
              </Text>
            ))}
            {expiringSoon.length > 3 && (
              <Text style={styles.alertMore}>+{expiringSoon.length - 3} more items...</Text>
            )}
          </View>
        )}

        {/* Discarded */}
        <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
          <Text style={{ fontSize: 16, color: '#333' }}>
            🗑️ Discarded This Month: <Text style={{ fontWeight: 'bold' }}>{discardedStats.thisMonth}</Text>
          </Text>
          <Text style={{ fontSize: 16, color: '#333' }}>
            ❌ Total Discarded: <Text style={{ fontWeight: 'bold' }}>{discardedStats.total}</Text>
          </Text>
        </View>

        {/* Actions */}
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

          <TouchableOpacity onPress={() => navigation.navigate('DiscardedItems')}>
            <Text style={styles.discardedHistoryLink}>View Discarded History →</Text>
          </TouchableOpacity>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  logoutText: {
    color: '#ff4d4d',
    fontWeight: 'bold',
    fontSize: 16,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
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
    marginBottom: 25,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
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
    marginTop: 20,
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
  discardedHistoryLink: {
    color: '#00C897',
    marginTop: 8,
    textAlign: 'right',
    fontSize: 16,
  },
});
