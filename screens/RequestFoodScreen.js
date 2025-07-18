// screens/RequestFoodScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export default function RequestFoodScreen({ navigation, route }) {
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [loading, setLoading] = useState(false);

  const sharerId = route?.params?.sharerId;
  const itemToRequest = route?.params?.item;

  // UUID validation helper
  const isValidUUID = (str) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Pre-fill fields if requesting a specific item
  useEffect(() => {
    if (itemToRequest) {
      setItemName(itemToRequest.item_name);
      setDescription(`I need ${itemToRequest.item_name} as offered by neighbor`);
    }
  }, [itemToRequest]);

  const handleSubmit = async () => {
    if (!itemName.trim()) {
      Alert.alert('Validation Error', 'Item name is required.');
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'User not authenticated.');
        return;
      }

      // Prepare fields
      const relatedSharerId = isValidUUID(sharerId) ? sharerId : null;
      const relatedItemId = itemToRequest?.id || null;

      // Step 1: Create the food_request
      const { data: foodRequest, error: requestError } = await supabase
        .from('food_requests')
        .insert({
          requester_id: user.id,
          item_name: itemName,
          notes: description,
          description: description,
          urgency: urgency,
          status: 'active',
          item_id: relatedItemId,
          related_sharer_id: relatedSharerId,
          related_item_id: relatedItemId
        })
        .select('id')
        .single();

      if (requestError) throw requestError;

      // Step 2: Create the request-item connection
      const { error: connectionError } = await supabase
        .from('request_item_connections')
        .insert({
          request_id: foodRequest.id,
          item_id: relatedItemId,
          requester_id: user.id,
          item_name: itemName,
          description: description,
          urgency: urgency,
          status: 'pending'
        });

      if (connectionError) throw connectionError;

      Alert.alert('Request Sent', 'Your food request has been posted successfully!');
      setItemName('');
      setDescription('');
      navigation.goBack();

    } catch (err) {
      console.error('Error posting request:', err.message);
      Alert.alert('Submission Failed', err.message || 'An error occurred while submitting your request');
    } finally {
      setLoading(false);
    }
  };

  const navigateToGeneralChat = () => {
    navigation.navigate('Chat', { 
      chatType: 'general',
      title: 'Community Chat' 
    });
  };

  const navigateToPrivateChat = () => {
    if (isValidUUID(sharerId)) {
      navigation.navigate('Chat', { 
        recipientId: sharerId,
        chatType: 'private',
        title: 'Chat with Sharer' 
      });
    } else {
      Alert.alert('No Recipient', 'Please select a specific food item to chat with the sharer.');
    }
  };

  const navigateToSupportChat = () => {
    navigation.navigate('Chat', { 
      chatType: 'support',
      title: 'Help & Support' 
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Request Food</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What do you need?</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Enter food name (e.g. Milk, Rice)"
          value={itemName}
          onChangeText={setItemName}
          placeholderTextColor="#999"
        />
        
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Describe what you need (quantity, preferences, etc.)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          placeholderTextColor="#999"
        />

        <View style={styles.urgencyContainer}>
          <Text style={styles.urgencyLabel}>Urgency:</Text>
          <View style={styles.urgencyOptions}>
            {['high', 'medium', 'low'].map(level => (
              <TouchableOpacity
                key={level}
                style={[styles.urgencyButton, urgency === level && styles.urgencyButtonSelected]}
                onPress={() => setUrgency(level)}
              >
                <Text style={urgency === level ? styles.urgencyTextSelected : styles.urgencyText}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Sending Request...' : 'Submit Request'}
          </Text>
        </TouchableOpacity>
      </View>

      {itemToRequest && (
        <View style={styles.linkedItemCard}>
          <Text style={styles.linkedItemTitle}>Requesting Help For:</Text>
          <Text style={styles.linkedItemName}>{itemToRequest.item_name}</Text>
          <Text style={styles.linkedItemDetail}>Quantity: {itemToRequest.quantity}</Text>
          {itemToRequest.expiration_date && (
            <Text style={styles.linkedItemDetail}>
              Expires: {new Date(itemToRequest.expiration_date).toLocaleDateString()}
            </Text>
          )}
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
        <TouchableOpacity style={styles.actionCard} onPress={navigateToGeneralChat}>
          <View style={styles.actionIconContainer}>
            <Ionicons name="people" size={24} color="#5a2ca0" />
          </View>
          <Text style={styles.actionTitle}>Community Chat</Text>
        </TouchableOpacity>

        {isValidUUID(sharerId) && (
          <TouchableOpacity style={styles.actionCard} onPress={navigateToPrivateChat}>
            <View style={styles.actionIconContainer}>
              <Ionicons name="person" size={24} color="#5a2ca0" />
            </View>
            <Text style={styles.actionTitle}>Chat with Sharer</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionCard} onPress={navigateToSupportChat}>
          <View style={styles.actionIconContainer}>
            <Ionicons name="help-circle" size={24} color="#5a2ca0" />
          </View>
          <Text style={styles.actionTitle}>Help & Support</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How it works</Text>
        <Text style={styles.infoText}>
          1. Enter the food item you need {'\n'}
          2. Describe your request in detail {'\n'}
          3. Set urgency level {'\n'}
          4. Submit your request {'\n'}
          5. Neighbors will respond with offers
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 15 },
  input: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 16, color: '#333' },
  notesInput: { height: 100, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#5a2ca0', paddingVertical: 16, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  submitButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  horizontalScroll: { marginBottom: 20 },
  actionCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: 150, marginRight: 15, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  actionIconContainer: { backgroundColor: '#f0e6ff', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  actionTitle: { fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'center' },
  infoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  infoTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  infoText: { fontSize: 14, color: '#666', lineHeight: 22 },
  linkedItemCard: { backgroundColor: '#e8f5e9', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#c8e6c9' },
  linkedItemTitle: { fontSize: 14, fontWeight: 'bold', color: '#2e7d32', marginBottom: 8 },
  linkedItemName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  linkedItemDetail: { fontSize: 14, color: '#666', marginBottom: 4 },
  urgencyContainer: { marginBottom: 15 },
  urgencyLabel: { fontSize: 14, color: '#666', marginBottom: 8 },
  urgencyOptions: { flexDirection: 'row', justifyContent: 'space-between' },
  urgencyButton: { flex: 1, padding: 10, marginHorizontal: 4, borderRadius: 8, backgroundColor: '#f5f5f5', alignItems: 'center' },
  urgencyButtonSelected: { backgroundColor: '#5a2ca0' },
  urgencyText: { color: '#666', fontWeight: '500' },
  urgencyTextSelected: { color: '#fff', fontWeight: '500' }
});
