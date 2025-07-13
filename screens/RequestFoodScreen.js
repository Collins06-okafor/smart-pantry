// screens/RequestFoodScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export default function RequestFoodScreen({ navigation, route }) {
  const [itemName, setItemName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const sharerId = route?.params?.sharerId;

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

      const { error } = await supabase.from('food_requests').insert({
        requester_id: user.id,
        item_name: itemName.trim(),
        notes: notes.trim(),
      });

      if (error) throw error;

      Alert.alert('Request Sent', 'Your food request has been posted.');
      setItemName('');
      setNotes('');
      navigation.goBack();

    } catch (err) {
      console.error('Error posting request:', err.message);
      Alert.alert('Submission Failed', err.message || 'An error occurred');
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
    if (sharerId) {
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
          placeholder="Any special notes? (optional)"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          placeholderTextColor="#999"
        />

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

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <TouchableOpacity>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
        <TouchableOpacity 
          style={styles.actionCard}
          onPress={navigateToGeneralChat}
        >
          <View style={styles.actionIconContainer}>
            <Ionicons name="people" size={24} color="#5a2ca0" />
          </View>
          <Text style={styles.actionTitle}>Community Chat</Text>
        </TouchableOpacity>

        {sharerId && (
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={navigateToPrivateChat}
          >
            <View style={styles.actionIconContainer}>
              <Ionicons name="person" size={24} color="#5a2ca0" />
            </View>
            <Text style={styles.actionTitle}>Chat with Sharer</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={navigateToSupportChat}
        >
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
          2. Add any special notes if needed {'\n'}
          3. Submit your request {'\n'}
          4. Neighbors will respond with offers
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  viewAll: {
    fontSize: 14,
    color: '#5a2ca0',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#5a2ca0',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  horizontalScroll: {
    marginBottom: 20,
  },
  actionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: 150,
    marginRight: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionIconContainer: {
    backgroundColor: '#f0e6ff',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
});