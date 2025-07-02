import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { BarCodeScanner } from 'expo-barcode-scanner';

export default function AddItemScreen({ route, navigation }) {
  const editingItem = route.params?.item ?? null;

  const [itemName, setItemName] = useState(editingItem?.item_name || '');
  const [quantity, setQuantity] = useState(editingItem?.quantity?.toString() || '1');
  const [expirationDate, setExpirationDate] = useState(editingItem?.expiration_date || new Date().toISOString().split('T')[0]);
  const [barcode, setBarcode] = useState(editingItem?.barcode || '');
  const [showScanner, setShowScanner] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Barcode permissions
  useEffect(() => {
  (async () => {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied to use camera for barcode scanning');
    }
  })();
}, []);


  const handleBarCodeScanned = ({ data }) => {
    setBarcode(data);
    setShowScanner(false);
  };

  const handleSave = async () => {
    if (!itemName || !expirationDate || !quantity) {
      Alert.alert('All fields are required');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    const item = {
      user_id: user.id,
      item_name: itemName,
      quantity: parseInt(quantity),
      expiration_date: expirationDate,
      barcode,
    };

    let response;
    if (editingItem) {
      response = await supabase
        .from('pantry_items')
        .update(item)
        .eq('id', editingItem.id);
    } else {
      response = await supabase
        .from('pantry_items')
        .insert(item);
    }

    if (response.error) {
      Alert.alert('Error saving item:', response.error.message);
    } else {
      Alert.alert('Success!', 'Item saved to pantry');
      navigation.navigate('Pantry'); // adjust if your screen is named differently
    }
  };

  return (
    <View style={styles.container}>
      {showScanner ? (
        <BarCodeScanner
          onBarCodeScanned={handleBarCodeScanned}
          style={{ flex: 1 }}
        />
      ) : (
        <>
          <Text style={styles.label}>Item Name</Text>
          <TextInput
            style={styles.input}
            value={itemName}
            onChangeText={setItemName}
            placeholder="e.g. Milk"
          />

          <Text style={styles.label}>Quantity</Text>
          <TextInput
            style={styles.input}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            placeholder="e.g. 1"
          />

          <Text style={styles.label}>Expiration Date</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)}>
            <TextInput
              style={styles.input}
              value={expirationDate}
              editable={false}
            />
          </TouchableOpacity>
          {showDatePicker && (
            Platform.OS === 'android' ? (
                <DateTimePicker
                value={new Date(expirationDate)}
                mode="date"
                display="default"
                onChange={(e, date) => {
                    setShowDatePicker(false);
                    if (date) {
                    setExpirationDate(date.toISOString().split('T')[0]);
                    }
                }}
                />
            ) : (
                <DateTimePicker
                value={new Date(expirationDate)}
                mode="date"
                display="spinner"
                onChange={(e, date) => {
                    if (date) {
                    setExpirationDate(date.toISOString().split('T')[0]);
                    }
                }}
                />
            )
            )}


          <Text style={styles.label}>Barcode (Optional)</Text>
          <TextInput
            style={styles.input}
            value={barcode}
            onChangeText={setBarcode}
            placeholder="Scan or enter manually"
          />
          <Button title="Scan Barcode" onPress={() => setShowScanner(true)} />

          <View style={{ marginTop: 20 }}>
            <Button title={editingItem ? "Update Item" : "Add Item"} onPress={handleSave} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  label: {
    fontSize: 14,
    marginBottom: 4,
    marginTop: 10,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
});
