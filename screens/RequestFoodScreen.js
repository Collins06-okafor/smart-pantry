// screens/RequestFoodScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

export default function RequestFoodScreen({ navigation }) {
  const [itemName, setItemName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

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
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});