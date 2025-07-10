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

// Constants for colors and styles
const COLORS = {
  primary: '#00C897',
  danger: '#ff4d4d',
  warning: '#856404',
  warningBg: '#fff3cd',
  warningBorder: '#ffeaa7',
  text: '#333',
  textLight: '#666',
  background: '#f8f9fa',
  white: '#fff',
  cardShadow: '#e1e5e9',
};

const Dashboard = ({ navigation }) => {
  // State management
  const [state, setState] = useState({
    name: '',
    pantryCount: 0,
    expiringSoon: [],
    loading: true,
    refreshing: false,
    error: null,
    discardedStats: { thisMonth: 0, total: 0 },
  });

  // Destructure state for cleaner access
  const { name, pantryCount, expiringSoon, loading, refreshing, error, discardedStats } = state;

  // Helper function to update state
  const updateState = (newState) => setState(prev => ({ ...prev, ...newState }));

  // Data fetching
  const fetchDashboardData = async () => {
    if (!refreshing) updateState({ loading: true, error: null });

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!user || userError) {
        updateState({ error: 'User not authenticated' });
        return;
      }

      const [profileResult, pantryResult] = await Promise.all([
        supabase.from('profile').select('name').eq('id', user.id).single(),
        supabase.from('pantry_items').select('*').eq('user_id', user.id),
      ]);

      const pantryItems = pantryResult.data || [];
      const expiring = calculateExpiringSoon(pantryItems);
      const stats = await fetchDiscardedStats(user.id);

      updateState({
        name: profileResult.data?.name?.split(' ')[0] || '',
        pantryCount: pantryItems.length,
        expiringSoon: expiring,
        discardedStats: stats,
      });

      // Schedule notifications for expiring items
      expiring.forEach((item) => {
        scheduleExpiryNotification(item.item_name, item.expiration_date);
      });
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      updateState({ error: 'Unexpected error' });
    } finally {
      updateState({ loading: false, refreshing: false });
    }
  };

  // Helper functions
  const fetchDiscardedStats = async (userId) => {
    const { data, error } = await supabase
      .from('discarded_items')
      .select('timestamp')
      .eq('user_id', userId);

    if (error) return { thisMonth: 0, total: 0 };

    const now = new Date();
    const thisMonthCount = data.filter(item => {
      const d = new Date(item.timestamp);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    return { thisMonth: thisMonthCount, total: data.length };
  };

  const calculateExpiringSoon = (items) => {
    const today = new Date();
    const threeDaysFromNow = new Date(today.getTime() + 3 * 86400000);
    return items.filter(item => {
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

  // Event handlers
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  const onRefresh = useCallback(() => {
    updateState({ refreshing: true });
    fetchDashboardData();
  }, []);

  // Side effects
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

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text>Loading dashboard...</Text>
      </SafeAreaView>
    );
  }

  // Main render
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header with logout */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Greeting section */}
        <View style={styles.greetingContainer}>
          <Text style={styles.greeting}>Good day!</Text>
          <Text style={styles.userName}>{name || 'Welcome'} 👋</Text>
        </View>

        {/* Stats cards */}
        <View style={styles.statsContainer}>
          <StatCard 
            value={pantryCount} 
            label="Items in Pantry" 
            color={COLORS.primary}
          />
          <StatCard 
            value={expiringSoon.length} 
            label="Expiring Soon" 
            warning={expiringSoon.length > 0}
          />
        </View>

        {/* Expiring items alert */}
        {expiringSoon.length > 0 && (
          <AlertCard items={expiringSoon} />
        )}

        {/* Discarded Stats Section */}
<View style={styles.discardedStatsContainer}>
  <View style={styles.discardedStatRow}>
    <Text style={styles.discardedStatIcon}>🗑️</Text>
    <Text style={styles.discardedStatText}>
      This month: <Text style={styles.discardedStatHighlight}>{discardedStats.thisMonth}</Text>
    </Text>
  </View>
  
  <View style={styles.discardedStatRow}>
    <Text style={styles.discardedStatIcon}>❌</Text>
    <Text style={styles.discardedStatText}>
      All time: <Text style={styles.discardedStatHighlight}>{discardedStats.total}</Text>
    </Text>
  </View>
</View>

        {/* Quick actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <View style={styles.actionGrid}>
            <ActionButton 
              icon="➕" 
              label="Add Item" 
              onPress={() => navigation.navigate('Add')} 
              primary
            />
            <ActionButton 
              icon="📦" 
              label="My Pantry" 
              onPress={() => navigation.navigate('Pantry')} 
            />
          </View>

          <View style={styles.actionGrid}>
            <ActionButton 
              icon="🍽️" 
              label="Recipes" 
              onPress={() => navigation.navigate('Recipes')} 
            />
            <ActionButton 
              icon="🤝" 
              label="Share" 
              onPress={() => navigation.navigate('Share')} 
            />
          </View>

          {/* Additional cards */}
          <TouchableOpacity 
            style={styles.card} 
            onPress={() => navigation.navigate('DiscardedItems')}
          >
            <Text style={styles.cardTitle}>📋 Discarded History</Text>
            <Text style={styles.cardSubtitle}>View your discarded items</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.card} 
            onPress={() => navigation.navigate('WasteStats')}
          >
            <Text style={styles.cardTitle}>📉 Waste Statistics</Text>
            <Text style={styles.cardSubtitle}>Track your food waste</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.card} 
            onPress={() => navigation.navigate('NearbyUsers')}
          >
            <Text style={styles.cardTitle}>👥 See Nearby Users</Text>
            <Text style={styles.cardSubtitle}>Connect with users in your area</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.expiringCard}
            onPress={() => navigation.navigate('ExpiringItems')}
          >
            <Text style={styles.cardTitle}>⚠️ View Expiring Items</Text>
            <Text style={styles.cardSubtitle}>Check items that are about to expire</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Reusable components
const StatCard = ({ value, label, color = COLORS.primary, warning = false }) => (
  <View style={[
    styles.statCard, 
    warning && styles.warningCard
  ]}>
    <Text style={[
      styles.statNumber, 
      { color: warning ? COLORS.warning : color }
    ]}>
      {value}
    </Text>
    <Text style={[
      styles.statLabel,
      warning && styles.warningLabel
    ]}>
      {label}
    </Text>
  </View>
);

const AlertCard = ({ items }) => (
  <View style={styles.alertCard}>
    <Text style={styles.alertTitle}>⚠️ Items Expiring Soon</Text>
    {items.slice(0, 3).map(item => (
      <Text key={item.id} style={styles.alertItem}>
        • {item.item_name} (expires {item.expiration_date})
      </Text>
    ))}
    {items.length > 3 && (
      <Text style={styles.alertMore}>+{items.length - 3} more items...</Text>
    )}
  </View>
);

const ActionButton = ({ icon, label, onPress, primary = false }) => (
  <TouchableOpacity
    style={[
      styles.actionCard,
      primary && styles.primaryAction
    ]}
    onPress={onPress}
  >
    <Text style={styles.actionIcon}>{icon}</Text>
    <Text style={[
      styles.actionTitle,
      primary && styles.primaryActionText
    ]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// Styles
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 15,
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  logoutText: {
    color: COLORS.danger,
    fontWeight: 'bold',
    fontSize: 16,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  greetingContainer: {
    marginBottom: 25,
  },
  greeting: {
    fontSize: 16,
    color: COLORS.textLight,
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
    shadowColor: COLORS.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  warningCard: {
    backgroundColor: COLORS.warningBg,
    borderColor: COLORS.warningBorder,
    borderWidth: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  warningLabel: {
    color: COLORS.warning,
  },
  alertCard: {
    backgroundColor: COLORS.warningBg,
    padding: 15,
    borderRadius: 12,
    marginBottom: 25,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  alertTitle: {
    fontWeight: 'bold',
    color: COLORS.warning,
    marginBottom: 8,
    fontSize: 16,
  },
  alertItem: {
    color: COLORS.warning,
    marginBottom: 3,
  },
  alertMore: {
    color: COLORS.warning,
    fontStyle: 'italic',
    marginTop: 5,
  },
  discardedContainer: {
    paddingHorizontal: 20,
    marginVertical: 15,
  },
  discardedText: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 5,
  },
  bold: {
    fontWeight: 'bold',
  },
  actionsSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 15,
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  actionCard: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 15,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
    shadowColor: COLORS.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryAction: {
    backgroundColor: COLORS.primary,
  },
  primaryActionText: {
    color: COLORS.white,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  card: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#e1e5e9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 5,
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  discardedStatsContainer: {
  backgroundColor: '#fff',
  borderRadius: 12,
  padding: 16,
  marginVertical: 12,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
},
discardedStatRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 10,
},
discardedStatIcon: {
  fontSize: 20,
  marginRight: 12,
  width: 24,
  textAlign: 'center',
},
discardedStatText: {
  fontSize: 16,
  color: '#555',
},
discardedStatHighlight: {
  fontWeight: '700',
  color: '#333',
},
expiringCard: {
  backgroundColor: '#ffe8e8',
  padding: 16,
  borderRadius: 12,
  marginTop: 16,
  borderLeftWidth: 6,
  borderLeftColor: '#e74c3c',
},
cardTitle: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#c0392b',
},
cardSubtitle: {
  fontSize: 14,
  color: '#555',
  marginTop: 4,
},

});

export default Dashboard;