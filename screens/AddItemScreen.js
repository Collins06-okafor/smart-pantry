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
  StatusBar
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../lib/supabase';
import { BarCodeScanner } from 'expo-barcode-scanner';

const { width, height } = Dimensions.get('window');

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

  // Request barcode scanner permissions
  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getBarCodeScannerPermissions();
  }, []);

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned) return; // Prevent multiple scans
    
    setScanned(true);
    setBarcode(data);
    
    // Try to fetch product info from barcode (you can integrate with a product API here)
    await fetchProductInfo(data);
    
    // Close scanner after a short delay
    setTimeout(() => {
      setShowScanner(false);
      setScanned(false);
    }, 1000);
  };

  const fetchProductInfo = async (barcodeData) => {
    setLoading(true);
    try {
      // You can integrate with APIs like:
      // - Open Food Facts API
      // - UPC Database API
      // - Your own product database
      
      // Example with Open Food Facts API (free)
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcodeData}.json`);
      const productData = await response.json();
      
      if (productData.status === 1 && productData.product) {
        const product = productData.product;
        setItemName(product.product_name || product.product_name_en || '');
        
        // You could also set other fields based on the product data
        Alert.alert(
          'Product Found!', 
          `Found: ${product.product_name || product.product_name_en || 'Unknown Product'}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Product Not Found', 
          'Product information not found. Please enter details manually.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.log('Error fetching product info:', error);
      Alert.alert(
        'Info', 
        'Barcode scanned successfully! Please enter product details manually.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!itemName || !expirationDate || !quantity) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      const item = {
        user_id: user.id,
        item_name: itemName.trim(),
        quantity: parseInt(quantity),
        expiration_date: expirationDate,
        barcode: barcode.trim(),
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
        Alert.alert('Error', `Failed to save item: ${response.error.message}`);
      } else {
        Alert.alert(
          'Success!', 
          `Item ${editingItem ? 'updated' : 'added'} successfully`,
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('Pantry')
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error saving item:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const startScanning = () => {
    if (hasPermission === null) {
      Alert.alert('Permission', 'Requesting camera permission...');
      return;
    }
    if (hasPermission === false) {
      Alert.alert(
        'No Camera Access', 
        'Camera permission is required to scan barcodes. Please enable it in your device settings.',
        [
          { text: 'Cancel' },
          { text: 'Settings', onPress: () => {/* Open settings if possible */} }
        ]
      );
      return;
    }
    setScanned(false);
    setShowScanner(true);
  };

  if (showScanner) {
    return (
      <View style={styles.scannerContainer}>
        <StatusBar barStyle="light-content" />
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={styles.scanner}
        />
        
        {/* Scanner overlay */}
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerHeader}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowScanner(false)}
            >
              <Text style={styles.cancelButtonText}>✕ Cancel</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.scannerFrame}>
            <View style={styles.scannerBox} />
            <Text style={styles.scannerText}>
              {scanned ? 'Barcode Scanned!' : 'Point camera at barcode'}
            </Text>
          </View>
          
          <View style={styles.scannerFooter}>
            <Text style={styles.instructionText}>
              Position the barcode within the frame
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {editingItem ? 'Edit Item' : 'Add New Item'}
      </Text>

      <Text style={styles.label}>Item Name *</Text>
      <TextInput
        style={styles.input}
        value={itemName}
        onChangeText={setItemName}
        placeholder="e.g. Organic Milk"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Quantity *</Text>
      <TextInput
        style={styles.input}
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="number-pad"
        placeholder="e.g. 1"
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Expiration Date *</Text>
      <TouchableOpacity onPress={() => setShowDatePicker(true)}>
        <TextInput
          style={[styles.input, styles.dateInput]}
          value={expirationDate}
          editable={false}
          placeholder="Select date"
          placeholderTextColor="#999"
        />
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={new Date(expirationDate)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (selectedDate) {
              setExpirationDate(selectedDate.toISOString().split('T')[0]);
            }
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
        <TouchableOpacity 
          style={styles.scanButton}
          onPress={startScanning}
        >
          <Text style={styles.scanButtonText}>📷 Scan</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
        onPress={handleSave}
        disabled={loading}
      >
        <Text style={styles.saveButtonText}>
          {loading ? 'Saving...' : (editingItem ? 'Update Item' : 'Add Item')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  label: {
    fontSize: 16,
    marginBottom: 6,
    marginTop: 15,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  dateInput: {
    color: '#333',
  },
  barcodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  barcodeInput: {
    flex: 1,
    marginRight: 10,
    marginBottom: 0,
  },
  scanButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  // Scanner styles
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scanner: {
    ...StyleSheet.absoluteFillObject,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scannerHeader: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cancelButton: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scannerFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerBox: {
    width: width * 0.7,
    height: width * 0.3,
    borderWidth: 2,
    borderColor: '#00C897',
    backgroundColor: 'transparent',
    borderRadius: 10,
  },
  scannerText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  scannerFooter: {
    paddingBottom: 50,
    paddingHorizontal: 20,
  },
  instructionText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
  },
});