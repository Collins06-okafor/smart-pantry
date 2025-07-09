import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import {
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';


const DiscardItemModal = ({ visible, onClose, itemId, userId, onDiscardComplete }) => {
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDiscard = async () => {
    // Add validation for itemId and userId
    if (!itemId || !userId || itemId === '' || userId === '') {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    // Convert itemId to number if it's a string (assuming it's an integer)
    const numericItemId = typeof itemId === 'string' ? parseInt(itemId) : itemId;
    
    // Validate that itemId conversion was successful
    if (isNaN(numericItemId)) {
      Alert.alert('Error', 'Invalid item ID');
      return;
    }

    // userId should be a UUID string, so keep it as is
    const validUserId = userId;

    setIsProcessing(true);
    try {
      // First, get the item details before discarding
      const { data: itemData, error: fetchError } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('id', numericItemId)
        .eq('user_id', validUserId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch item: ${fetchError.message}`);
      }

      // Insert into discarded_items table with item details
      const { error: discardError } = await supabase
        .from('discarded_items')
        .insert({
          user_id: validUserId,
          //id: numericItemId,
          item_link: numericItemId, // Using image_url from pantry_items
          item_name: itemData.item_name,
          quantity: itemData.quantity,
          expiration_date: itemData.expiration_date,
          reason: reason.trim() || 'No reason provided',
          timestamp: new Date().toISOString()
        });

      if (discardError) {
        throw new Error(`Failed to log discard: ${discardError.message}`);
      }

      // Remove the item from pantry_items table
      const { error: deleteError } = await supabase
        .from('pantry_items')
        .delete()
        .eq('id', numericItemId)
        .eq('user_id', validUserId);

      if (deleteError) {
        throw new Error(`Failed to remove item from pantry: ${deleteError.message}`);
      }

      Alert.alert('Success', 'Item discarded successfully');
      setReason(''); // Reset the reason field
      onClose();
      
      // Call the callback to refresh the pantry list
      if (onDiscardComplete) {
        onDiscardComplete();
      }

    } catch (error) {
      console.error('Discard failed:', error.message);
      Alert.alert('Error', `Failed to discard item: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setReason(''); // Reset the reason field
    onClose();
  };

  return (
<Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View style={styles.modalOverlay}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.modalContent}>
          <Text style={styles.title}>Discard Item</Text>
          <Text style={styles.subtitle}>
            This item will be removed from your pantry and logged for tracking purposes.
          </Text>

          <Text style={styles.label}>Reason for discarding (optional):</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., expired, spoiled, no longer needed"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton]} 
              onPress={handleCancel}
              disabled={isProcessing}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.button, styles.discardButton, isProcessing && styles.disabledButton]} 
              onPress={handleDiscard}
              disabled={isProcessing}
            >
              <Text style={styles.discardButtonText}>
                {isProcessing ? 'Discarding...' : '♻️ Discard'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  </TouchableWithoutFeedback>
</Modal>
  );
};

export default DiscardItemModal;

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    backgroundColor: '#f9f9f9',
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 80,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  discardButton: {
    backgroundColor: '#ff6b6b',
  },
  discardButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
});