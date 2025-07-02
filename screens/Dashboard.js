import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';

export default function Dashboard({ navigation }) {
  const [name, setName] = useState('');
  const [pantryCount, setPantryCount] = useState(0);
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    console.log('🔍 Dashboard: fetchDashboardData started');
    setLoading(true);
    setError(null);
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('🔍 Dashboard: User fetch result:', { user: !!user, userError });

      if (!user || userError) {
        console.warn('User not found:', userError?.message);
        setError('User not authenticated');
        return;
      }

      // Fetch user profile and pantry items in parallel
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

      const { data: profile, error: profileError } = profileResult;
      const { data: pantryItems, error: pantryError } = pantryResult;

      console.log('🔍 Dashboard: Results:', { profile, profileError, pantryItems, pantryError });

      // Handle profile data
      if (profileError) {
        console.warn('Profile fetch error:', profileError.message);
      } else if (profile?.name) {
        setName(profile.name.split(' ')[0]);
      }

      // Handle pantry data with comprehensive safety checks
      if (pantryError) {
        console.error('Pantry fetch error:', pantryError.message);
        setError('Failed to load pantry data');
        setPantryCount(0);
        setExpiringSoon([]);
        return;
      }

      // Ensure we always have a valid array
      const safeItems = Array.isArray(pantryItems) ? pantryItems : [];
      console.log('🔍 Dashboard: Safe items:', { 
        count: safeItems.length,
        isArray: Array.isArray(safeItems)
      });
      
      // Update pantry count
      setPantryCount(safeItems.length);

      // Calculate expiring items with additional safety
      const expiring = calculateExpiringSoon(safeItems);
      setExpiringSoon(expiring);

    } catch (err) {
      console.error('🚨 Dashboard: Unexpected error:', err);
      setError('An unexpected error occurred');
      setPantryCount(0);
      setExpiringSoon([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateExpiringSoon = (items) => {
    // Triple check for array safety
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log('🔍 Dashboard: No items to check for expiration');
      return [];
    }

    const today = new Date();
    const threeDaysFromNow = new Date(today.getTime() + (3 * 24 * 60 * 60 * 1000));

    try {
      const expiring = items.filter(item => {
        // Comprehensive item validation
        if (!item || typeof item !== 'object') {
          console.log('🔍 Dashboard: Invalid item object:', item);
          return false;
        }

        if (!item.expiration_date) {
          console.log('🔍 Dashboard: Item missing expiration_date:', item.item_name);
          return false;
        }

        const expDate = new Date(item.expiration_date);
        if (isNaN(expDate.getTime())) {
          console.log('🔍 Dashboard: Invalid expiration date:', item.expiration_date);
          return false;
        }

        const willExpire = expDate >= today && expDate <= threeDaysFromNow;
        if (willExpire) {
          console.log('🔍 Dashboard: Item expiring soon:', item.item_name, expDate);
        }
        
        return willExpire;
      });

      console.log('🔍 Dashboard: Items expiring soon:', expiring.length);
      return Array.isArray(expiring) ? expiring : [];
      
    } catch (filterError) {
      console.error('🚨 Dashboard: Error filtering expiring items:', filterError);
      return [];
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Loading dashboard...</Text>
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Hi, {name || 'there'}! 👋</Text>
      <Text style={styles.subText}>You have {pantryCount} item(s) in your pantry.</Text>
      <Text style={styles.subText}>🕑 {expiringSoon.length} item(s) expiring soon!</Text>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('AddItem')}>
        <Text style={styles.buttonText}>➕ Add Pantry Item</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Pantry')}>
        <Text style={styles.buttonText}>📦 View Pantry</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subText: {
    fontSize: 16,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#00C897',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 20,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  error: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#00C897',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});