// DiscardedItemsScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, SafeAreaView, StatusBar } from 'react-native';
import { supabase } from '../lib/supabase';

export default function DiscardedItemsScreen() {
  const [discardedItems, setDiscardedItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDiscardedItems();
  }, []);

  const fetchDiscardedItems = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('discarded_items')
      .select('id, reason, discarded_at, item_name')
      .eq('user_id', user.id)
      .order('discarded_at', { ascending: false });

    if (error) {
      console.error('Error fetching discarded items:', error.message);
    } else {
      setDiscardedItems(data || []);
    }
    setLoading(false);
  };

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Text style={styles.itemName}>{item.item_name}</Text>
      <Text style={styles.reason}>Reason: {item.reason}</Text>
      <Text style={styles.date}>🕒 {new Date(item.discarded_at).toLocaleString()}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <Text style={styles.title}></Text>
      {loading ? (
        <ActivityIndicator size="large" color="#00C897" style={{ marginTop: 20 }} />
      ) : discardedItems.length === 0 ? (
        <Text style={styles.emptyText}>No discarded items yet.</Text>
      ) : (
        <FlatList
          data={discardedItems}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginTop: 20, marginBottom: 10 },
  list: { paddingBottom: 20 },
  item: { backgroundColor: '#f0f0f0', padding: 16, borderRadius: 10, marginBottom: 10 },
  itemName: { fontSize: 18, fontWeight: 'bold' },
  reason: { fontSize: 14, color: '#555', marginTop: 4 },
  date: { fontSize: 12, color: '#888', marginTop: 4 },
  emptyText: { fontSize: 16, textAlign: 'center', marginTop: 40, color: '#666' },
});
