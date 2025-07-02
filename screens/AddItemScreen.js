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
// import { BarCodeScanner } from 'expo-barcode-scanner';

const { width } = Dimensions.get('window');

export default function AddItemScreen({ route, navigation }) {
  const editingItem = route.params?.item ?? null;

  const [itemName, setItemName] = useState(editingItem?.item_name || '');
  const [quantity, setQuantity] = useState(editingItem?.quantity?.toString() || '1');
  const [expirationDate, setExpirationDate] = useState(editingItem?.expiration_date || new Date().toISOString().split('T')[0]);
  const [barcode, setBarcode] = useState(editingItem?.barcode || '');
  const [showScanner, setShowScanner] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  // Request camera permission on mount
  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };
    getBarCodeScannerPermissions();
  }, []);

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned) return;

    setScanned(true);
    setBarcode(data);
    await fetchProductInfo(data);

    setTimeout(() => {
      setShowScanner(false);
      setScanned(false);
    }, 1000);
  };

  const fetchProductInfo = async (barcodeData) => {
    setLoading(true);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcodeData}.json`);
      const json = await res.json();

      if (json.status === 1 && json.product) {
        const product = json.product;
        setItemName(product.product_name || product.product_name_en || '');
        Alert.alert('Product Found', `Name: ${product.product_name || 'Unknown'}`);
      } else {
        Alert.alert('Not Found', 'Product info not available. Enter manually.');
      }
    } catch (err) {
      console.log('Fetch error:', err);
      Alert.alert('Scan Successful', 'Please enter details manually.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!itemName || !expirationDate || !quantity) {
      Alert.alert('Validation Error', 'Please fill all required fields.');
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
        quantity: parseInt(quantity),
        expiration_date: expirationDate,
        barcode: barcode.trim(),
      };

      const response = editingItem
        ? await supabase.from('pantry_items').update(item).eq('id', editingItem.id)
        : await supabase.from('pantry_items').insert(item);

      if (response.error) {
        Alert.alert('Save Failed', response.error.message);
      } else {
        Alert.alert('Success', `Item ${editingItem ? 'updated' : 'added'}!`, [
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

  const startScanning = () => {
    if (hasPermission === null) {
      Alert.alert('Permission Needed', 'Requesting camera permission...');
    } else if (!hasPermission) {
      Alert.alert('Camera Blocked', 'Enable camera in settings.');
    } else {
      setScanned(false);
      setShowScanner(true);
    }
  };

  if (showScanner) {
    return (
      <View style={styles.scannerContainer}>
        <StatusBar barStyle="light-content" />
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={styles.scanner}
        />
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerHeader}>
            <TouchableOpacity onPress={() => setShowScanner(false)} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>✕ Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.scannerFrame}>
            <View style={styles.scannerBox} />
            <Text style={styles.scannerText}>
              {scanned ? 'Scanned!' : 'Point camera at barcode'}
            </Text>
          </View>
          <View style={styles.scannerFooter}>
            <Text style={styles.instructionText}>Position barcode inside frame</Text>
          </View>
        </View>
      </View>
    );
  }

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
      <TouchableOpacity onPress={() => setShowDatePicker(true)}>
        <TextInput
          style={[styles.input, styles.dateInput]}
          value={expirationDate}
          editable={false}
          placeholder="Choose date"
        />
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={new Date(expirationDate)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(e, selectedDate) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (selectedDate) setExpirationDate(selectedDate.toISOString().split('T')[0]);
          }}
        />
      )}

      <Text style={styles.label}>Barcode (Optional)</Text>
      <View style={styles.barcodeContainer}>
        <TextInput
          style={[styles.input, styles.barcodeInput]}
          value={barcode}
          onChangeText={setBarcode}
          placeholder="Scan or enter manually"
          placeholderTextColor="#999"
        />
        <TouchableOpacity style={styles.scanButton} onPress={startScanning}>
          <Text style={styles.scanButtonText}>📷 Scan</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, loading && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={loading}
      >
        <Text style={styles.saveButtonText}>
          {loading ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', marginTop: 15 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    marginBottom: 10,
  },
  dateInput: { color: '#333' },
  barcodeContainer: { flexDirection: 'row', alignItems: 'center' },
  barcodeInput: { flex: 1, marginRight: 10 },
  scanButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  scanButtonText: { color: '#fff', fontWeight: '600' },
  saveButton: {
    backgroundColor: '#00C897',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
  },
  saveButtonDisabled: { backgroundColor: '#ccc' },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // Scanner styles
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  scanner: { ...StyleSheet.absoluteFillObject },
  scannerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  scannerHeader: { paddingTop: 50, paddingHorizontal: 20, paddingBottom: 20 },
  cancelButton: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cancelButtonText: { color: '#fff', fontSize: 16 },
  scannerFrame: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scannerBox: {
    width: width * 0.7,
    height: width * 0.3,
    borderWidth: 2,
    borderColor: '#00C897',
    borderRadius: 10,
  },
  scannerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  scannerFooter: { paddingBottom: 50, paddingHorizontal: 20 },
  instructionText: { color: '#ccc', fontSize: 14, textAlign: 'center' },
});
