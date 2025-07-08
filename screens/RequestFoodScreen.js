// screens/RequestFoodScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

export default function RequestFoodScreen({ navigation, route }) {
  const [itemName, setItemName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Get sharerId from route params if navigating from a specific shared item
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

      if (error) {
        throw error;
      }

      Alert.alert('Request Sent', 'Your food request has been posted anonymously.');
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

  // Navigate to general chat (community chat)
  const navigateToGeneralChat = () => {
    navigation.navigate('Chat', { 
      chatType: 'general',
      title: 'Community Chat' 
    });
  };

  // Navigate to chat with specific user (if sharerId is available)
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

  // Navigate to support chat
  const navigateToSupportChat = () => {
    navigation.navigate('Chat', { 
      chatType: 'support',
      title: 'Help & Support' 
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>📦 Request Food Item</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Enter food name (e.g. Milk, Rice...)"
        value={itemName}
        onChangeText={setItemName}
      />
      
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Optional note (e.g. for baby, gluten-free)"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={4}
      />

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Submit Request'}</Text>
      </TouchableOpacity>

      {/* Chat Navigation Section */}
      <View style={styles.chatSection}>
        <Text style={styles.chatSectionTitle}>💬 Need to Chat?</Text>
        
        <TouchableOpacity 
          style={styles.chatButton} 
          onPress={navigateToGeneralChat}
        >
          <Text style={styles.chatButtonText}>🌐 Community Chat</Text>
        </TouchableOpacity>

        {sharerId && (
          <TouchableOpacity 
            style={styles.chatButton} 
            onPress={navigateToPrivateChat}
          >
            <Text style={styles.chatButtonText}>👤 Chat with Sharer</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.chatButton} 
          onPress={navigateToSupportChat}
        >
          <Text style={styles.chatButtonText}>🆘 Help & Support</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#fff',
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#5a2ca0',
  },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  notesInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#5a2ca0',
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 30,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  chatSection: {
    marginTop: 20,
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
  },
  chatSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  chatButton: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  chatButtonText: {
    color: '#5a2ca0',
    fontWeight: '600',
    fontSize: 16,
  },
});