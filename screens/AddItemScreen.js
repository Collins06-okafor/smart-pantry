import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Platform,
  Dimensions,
  StatusBar,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';


const { width } = Dimensions.get('window');

export default function AddItemScreen({ route, navigation }) {
  const editingItem = route.params?.item ?? null;

  const [itemName, setItemName] = useState(editingItem?.item_name || '');
  const [quantity, setQuantity] = useState(editingItem?.quantity?.toString() || '1');
  const [expirationDate, setExpirationDate] = useState(() => {
    if (editingItem?.expiration_date) {
      return new Date(editingItem.expiration_date);
    }
    // Default to 7 days from now
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    return defaultDate;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateForDatabase = (date) => {
    return date.toISOString().split('T')[0];
  };

  const handleDateChange = (event, selectedDate) => {
    console.log('Date picker event:', event.type, selectedDate);
    
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (event.type === 'dismissed') {
      // User cancelled the picker
      setShowDatePicker(false);
      return;
    }
    
    if (selectedDate) {
      console.log('Setting new date:', selectedDate);
      setExpirationDate(selectedDate);
      if (Platform.OS === 'ios') {
        // On iOS, we might want to keep the picker open until user confirms
        // For now, we'll close it immediately
        setShowDatePicker(false);
      }
    }
  };

  const handleSave = async () => {
    if (!itemName.trim() || !quantity || !expirationDate) {
      Alert.alert('Validation Error', 'Please fill all required fields.');
      return;
    }

    const quantityNum = parseInt(quantity);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid quantity.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Auth Error', 'You must be logged in.');
        return;
      }

      const item = {
        user_id: user.id,
        item_name: itemName.trim(),
        quantity: quantityNum,
        expiration_date: formatDateForDatabase(expirationDate),
      };

      console.log('Saving item:', item);

      const response = editingItem
        ? await supabase.from('pantry_items').update(item).eq('id', editingItem.id)
        : await supabase.from('pantry_items').insert(item);

      if (response.error) {
        console.error('Save error:', response.error);
        Alert.alert('Save Failed', response.error.message);
      } else {
        console.log('Item saved successfully');
        Alert.alert('Success', `Item ${editingItem ? 'updated' : 'added'} successfully!`, [
          { text: 'OK', onPress: () => navigation.navigate('Pantry') },
        ]);
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{editingItem ? 'Edit Item' : 'Add New Item'}</Text>

      <Text style={styles.label}>Item Name *</Text>
      <TextInput
        style={styles.input}
        value={itemName}
        onChangeText={setItemName}
        placeholder="e.g. Fresh Tomatoes"
        placeholderTextColor="#999"
        autoCapitalize="words"
      />

      <Text style={styles.label}>Quantity *</Text>
      <TextInput
        style={styles.input}
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="number-pad"
        placeholder="e.g. 2"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Expiration Date *</Text>
      <TouchableOpacity 
        style={styles.dateButton}
        onPress={() => {
          console.log('Date picker button pressed');
          setShowDatePicker(true);
        }}
      >
        <Text style={styles.dateButtonText}>
          {formatDate(expirationDate)}
        </Text>
        <Text style={styles.dateButtonIcon}>📅</Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={expirationDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleDateChange}
          minimumDate={new Date()} // Prevent selecting past dates
        />
      )}

      <TouchableOpacity
        style={[styles.saveButton, loading && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={loading}
      >
        <Text style={styles.saveButtonText}>
          {loading ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
        </Text>
      </TouchableOpacity>

      {/* Quick date selection buttons */}
      <View style={styles.quickDateContainer}>
        <Text style={styles.quickDateLabel}>Quick select:</Text>
        <View style={styles.quickDateButtons}>
          <TouchableOpacity
            style={styles.quickDateButton}
            onPress={() => {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              setExpirationDate(tomorrow);
            }}
          >
            <Text style={styles.quickDateButtonText}>Tomorrow</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.quickDateButton}
            onPress={() => {
              const nextWeek = new Date();
              nextWeek.setDate(nextWeek.getDate() + 7);
              setExpirationDate(nextWeek);
            }}
          >
            <Text style={styles.quickDateButtonText}>1 Week</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.quickDateButton}
            onPress={() => {
              const nextMonth = new Date();
              nextMonth.setMonth(nextMonth.getMonth() + 1);
              setExpirationDate(nextMonth);
            }}
          >
            <Text style={styles.quickDateButtonText}>1 Month</Text>
          </TouchableOpacity>

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: '#fff' 
  },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 20,
    color: '#333'
  },
  label: { 
    fontSize: 16, 
    fontWeight: '600', 
    marginTop: 15,
    marginBottom: 8,
    color: '#333'
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    marginBottom: 10,
    fontSize: 16,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
  dateButtonIcon: {
    fontSize: 20,
  },
  saveButton: {
    backgroundColor: '#00C897',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  saveButtonDisabled: { 
    backgroundColor: '#ccc',
    elevation: 0,
    shadowOpacity: 0,
  },
  saveButtonText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  quickDateContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  quickDateLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  quickDateButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickDateButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  quickDateButtonText: {
    fontSize: 14,
    color: '#00C897',
    fontWeight: '500',
  },
});