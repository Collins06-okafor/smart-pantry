import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function ExpiringItemsScreen() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchExpiringItems = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('pantry_items_with_warnings')
        .select('*')
        .eq('user_id', user.id)
        .in('expiration_status', ['EXPIRED', 'EXPIRES_TODAY', 'EXPIRES_SOON'])
        .order('effective_expiration_date', { ascending: true });

      if (error) {
        console.error('Error fetching items:', error);
        return;
      }

      // Group by expiration_status
      const grouped = {
        EXPIRED: [],
        EXPIRES_TODAY: [],
        EXPIRES_SOON: [],
      };

      data.forEach(item => {
        grouped[item.expiration_status]?.push(item);
      });

      const tempSections = [];

      if (grouped.EXPIRED.length) {
        tempSections.push({ title: '🛑 Expired', data: grouped.EXPIRED });
      }
      if (grouped.EXPIRES_TODAY.length) {
        tempSections.push({ title: '⚠️ Expires Today', data: grouped.EXPIRES_TODAY });
      }
      if (grouped.EXPIRES_SOON.length) {
        tempSections.push({ title: '⏳ Expires Soon', data: grouped.EXPIRES_SOON });
      }

      setSections(tempSections);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpiringItems();
  }, []);

  const formatDate = (dateStr) => {
    return dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A';
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.image} />
      ) : (
        <View style={styles.placeholderImage}>
          <Text style={{ color: '#999' }}>No Image</Text>
        </View>
      )}
      <View style={styles.details}>
        <Text style={styles.name}>{item.item_name}</Text>
        <Text style={styles.meta}>Qty: {item.quantity || 1} {item.quantity_unit || ''}</Text>
        <Text style={styles.meta}>Opened: {formatDate(item.opening_date)}</Text>
        <Text style={styles.meta}>
          Expires: {formatDate(item.effective_expiration_date)}
        </Text>
      </View>
    </View>
  );

  const renderSectionHeader = ({ section: { title } }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧊 Expiring Items</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#00A86B" />
      ) : sections.length === 0 ? (
        <Text style={styles.noItems}>🎉 No expiring items!</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#00A86B',
  },
  noItems: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginTop: 40,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    backgroundColor: '#f0f0f0',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 10,
    color: '#444',
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 2,
  },
  image: {
    width: 80,
    height: 80,
    borderRightWidth: 1,
    borderColor: '#ddd',
  },
  placeholderImage: {
    width: 80,
    height: 80,
    backgroundColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
    padding: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  meta: {
    fontSize: 14,
    color: '#555',
  },
});
