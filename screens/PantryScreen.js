import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

export default function PantryScreen() {
  const [pantryItems, setPantryItems] = useState([]); // Always defaults to array
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPantryItems();
  }, []);

  const fetchPantryItems = async () => {
    console.log('🔍 PantryScreen: fetchPantryItems started');
    setLoading(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('🔍 PantryScreen: User fetch result:', { user: !!user, userError });
      
      if (userError || !user) {
        console.warn('User not found:', userError?.message);
        setPantryItems([]);
        return;
      }

      console.log('🔍 PantryScreen: About to fetch pantry items for user:', user.id);

      const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', user.id)
        .order('expiration_date', { ascending: true });

      console.log('🔍 PantryScreen: Fetch result:', { 
        data, 
        error,
        isArray: Array.isArray(data),
        type: typeof data,
        length: data?.length 
      });

      if (error) {
        console.error('Error fetching pantry items:', error.message);
        setPantryItems([]);
      } else {
        // Ensure data is always an array and filter valid items
        const safeData = Array.isArray(data) ? data : [];
        console.log('🔍 PantryScreen: Safe data:', { 
          safeData, 
          length: safeData.length,
          isArray: Array.isArray(safeData)
        });

        if (!Array.isArray(safeData)) {
          console.error('🚨 PantryScreen: safeData is not an array!', typeof safeData, safeData);
          setPantryItems([]);
          return;
        }

        const validItems = safeData.filter(item => {
          console.log('🔍 PantryScreen: Filtering item:', item);
          return item && item.item_name;
        });

        console.log('🔍 PantryScreen: Valid items after filter:', validItems);
        setPantryItems(validItems);
      }
    } catch (err) {
      console.error('🚨 PantryScreen: Unexpected error:', err);
      console.error('🚨 PantryScreen: Error stack:', err.stack);
      setPantryItems([]);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Text style={styles.name}>{item.item_name || 'Unknown Item'}</Text>
      <Text style={styles.detail}>Quantity: {item.quantity || 'N/A'}</Text>
      <Text style={styles.detail}>Expires: {item.expiration_date || 'N/A'}</Text>
      <Text style={styles.detail}>Barcode: {item.barcode || 'N/A'}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C897" />
      </View>
    );
  }

  if (!Array.isArray(pantryItems) || pantryItems.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Your pantry is empty. Add some items!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Pantry</Text>
      <FlatList
        data={pantryItems}
        keyExtractor={(item) => item.id ? item.id.toString() : Math.random().toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 30 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20 
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 15 
  },
  item: {
    backgroundColor: '#e0f2f1',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  name: { 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  detail: { 
    fontSize: 14, 
    color: '#333' 
  },
  empty: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
  },
});