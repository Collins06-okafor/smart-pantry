// AppNavigator.js or your main navigation file
import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, StyleSheet } from 'react-native';
import { supabase } from './lib/supabase';
import { Bell, Home, Package, User } from 'lucide-react-native';

// Import your screen components
import DashboardScreen from './screens/Dashboard';
import NotificationsScreen from './screens/NotificationsScreen';
import PantryScreen from './screens/PantryScreen';
import ProfileScreen from './screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const COLORS = {
  primary: '#00C897',
  bg: '#F8F9FA',
  white: '#FFFFFF',
  text: '#212529',
  gray: '#6C757D',
  red: '#DC3545',
};

// Custom Badge Component
const Badge = ({ count }) => {
  if (count === 0) return null;
  
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>
        {count > 99 ? '99+' : count.toString()}
      </Text>
    </View>
  );
};

// Custom Tab Bar Icon with Badge
const TabBarIcon = ({ IconComponent, size, color, badgeCount = 0 }) => (
  <View style={styles.iconContainer}>
    <IconComponent size={size} color={color} />
    {badgeCount > 0 && <Badge count={badgeCount} />}
  </View>
);

// Main Navigation Component
export default function AppNavigator() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);

  // Fetch unread notification count
  const fetchUnreadCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUnreadCount(0);
        setCurrentUser(null);
        return;
      }

      setCurrentUser(user);

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error fetching unread notifications:', error);
        return;
      }

      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error in fetchUnreadCount:', error);
    }
  };

  // Initial fetch and setup real-time subscription
  useEffect(() => {
    fetchUnreadCount();

    // Set up real-time subscription for notifications
    let channel;
    
    if (currentUser) {
      channel = supabase
        .channel('notifications_updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${currentUser.id}`
          },
          (payload) => {
            console.log('Notification change detected:', payload);
            fetchUnreadCount();
          }
        )
        .subscribe();
    }

    // Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUnreadCount(0);
          setCurrentUser(null);
        } else if (event === 'SIGNED_IN' && session?.user) {
          setCurrentUser(session.user);
          fetchUnreadCount();
        }
      }
    );

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      subscription?.unsubscribe();
    };
  }, [currentUser?.id]);

  // Refresh notification count when app comes into focus
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentUser) {
        fetchUnreadCount();
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [currentUser]);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: COLORS.gray,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabBarLabel,
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon
                IconComponent={Home}
                size={size}
                color={color}
              />
            ),
          }}
        />
        
        <Tab.Screen
          name="Pantry"
          component={PantryScreen}
          options={{
            title: 'Pantry',
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon
                IconComponent={Package}
                size={size}
                color={color}
              />
            ),
          }}
        />
        
        <Tab.Screen
          name="Notifications"
          component={NotificationsScreen}
          options={{
            title: 'Notifications',
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon
                IconComponent={Bell}
                size={size}
                color={color}
                badgeCount={unreadCount}
              />
            ),
          }}
          listeners={{
            tabPress: () => {
              // Reset unread count when user taps on notifications tab
              setUnreadCount(0);
            },
          }}
        />
        
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <TabBarIcon
                IconComponent={User}
                size={size}
                color={color}
              />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -12,
    backgroundColor: COLORS.red,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
    paddingHorizontal: 4,
  },
  tabBar: {
    backgroundColor: COLORS.white,
    borderTopColor: '#E5E5E5',
    borderTopWidth: 1,
    paddingTop: 5,
    paddingBottom: 5,
    height: 60,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});