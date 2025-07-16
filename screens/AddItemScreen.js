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
  Modal,
  ScrollView,
  Switch,
  Image,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useFocusEffect } from '@react-navigation/native'; // Added useFocusEffect
import { uploadFoodImage } from '../utils/uploadFoodImage';


const { width } = Dimensions.get('window');

// Common units for pantry items
const QUANTITY_UNITS = [
  'pieces',
  'kg',
  'g',
  'lbs',
  'oz',
  'liters',
  'ml',
  'cups',
  'tbsp',
  'tsp',
  'cans',
  'bottles',
  'boxes',
  'bags',
  'packs',
  'bundles',
  'dozen',
];

// Food safety guidelines for opened items (in days)
const OPENED_ITEM_SHELF_LIFE = {
  'default': { refrigerated: 3, room_temp: 0.125, frozen: 30 }
};

const STORAGE_CONDITIONS = [
  { value: 'refrigerated', label: 'Refrigerated', icon: 'snow' },
  { value: 'room_temp', label: 'Room Temp', icon: 'thermometer' },
  { value: 'frozen', label: 'Frozen', icon: 'ice-cream' },
];

export default function AddItemScreen({ route, navigation }) {
  const editingItem = route.params?.item ?? null;
  const scannedBarcode = route.params?.scannedBarcode || '';
  const productData = route.params?.productData || null; // Added productData
  const fromScanner = route.params?.fromScanner || false; // Added fromScanner

  const [itemName, setItemName] = useState(
    editingItem?.item_name || productData?.name || '' // Initialize with productData
  );
  const [barcode, setBarcode] = useState(
    editingItem?.barcode || scannedBarcode || '' // Initialize with productData
  );
  const [quantity, setQuantity] = useState(editingItem?.quantity?.toString() || '1');
  const [quantityUnit, setQuantityUnit] = useState(editingItem?.quantity_unit || 'pieces');
  const [showUnitPicker, setShowUnitPicker] = useState(false);
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
  const [isOpened, setIsOpened] = useState(editingItem?.is_opened || false);
  const [openingDate, setOpeningDate] = useState(() => {
    if (editingItem?.opening_date) {
      return new Date(editingItem.opening_date);
    }
    return new Date();
  });
  const [showOpeningDatePicker, setShowOpeningDatePicker] = useState(false);
  const [storageCondition, setStorageCondition] = useState(editingItem?.storage_condition || 'refrigerated');
  const [showStoragePicker, setShowStoragePicker] = useState(false);
  const [description, setDescription] = useState(
    editingItem?.description ||
    (productData ? `Ingredients: ${productData.ingredients}` : '') // Initialize with productData
  );
  const [itemImage, setItemImage] = useState(
    editingItem?.image_url || productData?.image || null // Initialize with productData
  );
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [calculatedExpirationDate, setCalculatedExpirationDate] = useState(null);
  const [showExpirationWarning, setShowExpirationWarning] = useState(false);

  useEffect(() => {
    if (!route.params?.item) {
      resetForm();
    }
  }, [route.params?.item]);

  useEffect(() => {
    if (scannedBarcode && !fromScanner) { // Only fetch if not coming from scanner with productData
      fetchProductFromBarcode(scannedBarcode);
    }
  }, [scannedBarcode, fromScanner]);

  // Add this effect to handle when coming from scanner
  useFocusEffect(
    React.useCallback(() => {
      if (fromScanner && productData) {
        // Auto-fill more fields from product data
        if (productData.quantity) {
          const qtyMatch = productData.quantity.match(/(\d+)/);
          if (qtyMatch) {
            setQuantity(qtyMatch[1]);
          }
        }

        // Set nutrition info in description if not already set
        if (!description && productData) {
          let nutritionInfo = '';
          if (productData.energy) nutritionInfo += `Energy: ${productData.energy}kJ\n`;
          if (productData.fat) nutritionInfo += `Fat: ${productData.fat}g\n`;
          if (productData.carbs) nutritionInfo += `Carbs: ${productData.carbs}g\n`;
          if (productData.proteins) nutritionInfo += `Proteins: ${productData.proteins}g\n`;

          if (nutritionInfo) {
            setDescription(prev =>
              prev ? `${prev}\n\nNutrition:\n${nutritionInfo}` : `Nutrition:\n${nutritionInfo}`
            );
          }
        }
      }
    }, [productData, fromScanner, description])
  );

  // Update your fetchProductFromBarcode function
  const fetchProductFromBarcode = async (code) => {
    try {
      setLoading(true);
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
      const data = await response.json();

      if (data.status === 1 && data.product) {
        const product = data.product;
        setItemName(product.product_name || '');
        setBarcode(code);

        // Set image if available
        if (product.image_url) {
          setItemImage(product.image_url);
        }

        // Set quantity if available
        if (product.quantity) {
          const qtyMatch = product.quantity.match(/(\d+)/);
          if (qtyMatch) {
            setQuantity(qtyMatch[1]);
          }
        }

        // Set ingredients in description
        if (product.ingredients_text) {
          setDescription(prev =>
            prev ? prev : `Ingredients: ${product.ingredients_text}`
          );
        }

        Alert.alert('Product Found', 'Product details have been auto-filled from Open Food Facts.');
      } else {
        Alert.alert('Product Not Found', 'The barcode was not found in Open Food Facts. Please enter the details manually.');
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      Alert.alert('Error', 'Could not fetch product details. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Request permissions for camera and storage
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.CAMERA,
        ];

        // For Android 13+, use READ_MEDIA_IMAGES instead of READ_EXTERNAL_STORAGE
        if (Platform.Version >= 33) {
          permissions.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
        } else {
          permissions.push(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
          permissions.push(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        }

        const granted = await PermissionsAndroid.requestMultiple(permissions);

        console.log('Permissions granted:', granted);

        const cameraGranted = granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;

        let storageGranted = false;
        if (Platform.Version >= 33) {
          storageGranted = granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] === PermissionsAndroid.RESULTS.GRANTED;
        } else {
          storageGranted = granted[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED;
        }

        if (!cameraGranted || !storageGranted) {
          Alert.alert(
            'Permissions Required',
            'Camera and storage permissions are required to take and select photos.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Settings', onPress: () => Linking.openSettings() }
            ]
          );
        }

        return { cameraGranted, storageGranted };
      } catch (err) {
        console.warn('Permission request error:', err);
        Alert.alert('Error', 'Unable to request permissions');
        return { cameraGranted: false, storageGranted: false };
      }
    }

    return { cameraGranted: true, storageGranted: true };
  };

  useEffect(() => {
    requestPermissions();
  }, []);

  // Fixed image handling with focus listener
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (route.params?.imageUri) {
        setItemImage(route.params.imageUri);
        // Clear the parameter after using it to prevent issues
        navigation.setParams({ imageUri: undefined });
      }
    });

    return unsubscribe;
  }, [navigation, route.params?.imageUri]);

  // Calculate effective expiration date when item is opened
  useEffect(() => {
    if (isOpened && openingDate) {
      calculateEffectiveExpiration();
    } else {
      setCalculatedExpirationDate(null);
      setShowExpirationWarning(false);
    }
  }, [isOpened, openingDate, storageCondition, expirationDate]);

  const calculateEffectiveExpiration = () => {
    const shelfLife = OPENED_ITEM_SHELF_LIFE.default;
    const daysToAdd = shelfLife[storageCondition] || shelfLife.refrigerated;

    const effectiveDate = new Date(openingDate);
    effectiveDate.setDate(effectiveDate.getDate() + daysToAdd);

    // Use the earlier of the two dates (original expiration or calculated)
    const finalExpiration = effectiveDate < expirationDate ? effectiveDate : expirationDate;

    setCalculatedExpirationDate(finalExpiration);

    // Show warning if calculated expiration is much earlier than original
    const timeDiff = expirationDate.getTime() - effectiveDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    setShowExpirationWarning(daysDiff > 1);
  };

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

  const getStorageIcon = (condition) => {
    const storage = STORAGE_CONDITIONS.find(s => s.value === condition);
    return storage ? storage.icon : 'cube';
  };

  const getStorageLabel = (condition) => {
    const storage = STORAGE_CONDITIONS.find(s => s.value === condition);
    return storage ? storage.label : 'Unknown';
  };

  const getDaysUntilExpiration = (date) => {
    const today = new Date();
    const timeDiff = date.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysDiff;
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }

    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }

    if (selectedDate) {
      setExpirationDate(selectedDate);
      if (Platform.OS === 'ios') {
        setShowDatePicker(false);
      }
    }
  };

  const handleOpeningDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowOpeningDatePicker(false);
    }

    if (event.type === 'dismissed') {
      setShowOpeningDatePicker(false);
      return;
    }

    if (selectedDate) {
      setOpeningDate(selectedDate);
      if (Platform.OS === 'ios') {
        setShowOpeningDatePicker(false);
      }
    }
  };

  const handleImagePicker = () => {
    setShowImageOptions(true);
  };

  const handleOpenCamera = () => {
    setShowImageOptions(false);
    navigation.navigate('Camera', {
      onPhotoTaken: (photoUri) => {
        setItemImage(photoUri);
      },
    });
  };

  const selectImageFromCamera = () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
      saveToPhotos: true,
      presentationStyle: 'fullScreen',
    };

    launchCamera(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled camera');
      } else if (response.errorMessage) {
        console.log('Camera error:', response.errorMessage);
        Alert.alert('Camera Error', response.errorMessage);
      } else if (response.assets && response.assets[0]) {
        setItemImage(response.assets[0].uri);
      }
      setShowImageOptions(false);
    });
  };

  const selectImageFromLibrary = () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
      selectionLimit: 1,
      presentationStyle: 'fullScreen',
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled image selection');
      } else if (response.errorMessage) {
        console.log('Image library error:', response.errorMessage);
        Alert.alert('Image Library Error', response.errorMessage);
      } else if (response.assets && response.assets[0]) {
        setItemImage(response.assets[0].uri);
      }
      setShowImageOptions(false);
    });
  };

  const removeImage = () => {
    setItemImage(null);
    setShowImageOptions(false);
  };

  const handleSave = async () => {
  if (!itemName.trim() || !quantity || !expirationDate) {
    Alert.alert('Validation Error', 'Please fill all required fields.');
    return;
  }

  const quantityNum = parseFloat(quantity);
  if (isNaN(quantityNum) || quantityNum <= 0) {
    Alert.alert('Validation Error', 'Please enter a valid quantity.');
    return;
  }

  setLoading(true);
  try {
    const { data: { user } } = await supabase.auth.getUser ();

    if (!user) {
      Alert.alert('Auth Error', 'You must be logged in.');
      return;
    }

    const item = {
      user_id: user.id,
      item_name: itemName.trim(),
      barcode: barcode || null,
      quantity: quantityNum,
      quantity_unit: quantityUnit,
      expiration_date: formatDateForDatabase(expirationDate),
      is_opened: isOpened,
      opening_date: isOpened ? formatDateForDatabase(openingDate) : null,
      storage_condition: isOpened ? storageCondition : null,
      description: description.trim() || null,
      image_url: itemImage,
    };

    console.log('Item to save:', item); // Debugging line

    const response = editingItem
      ? await supabase.from('pantry_items').update(item).eq('id', editingItem.id)
      : await supabase.from('pantry_items').insert(item);

    if (response.error) {
      console.error('Save error:', response.error);
      Alert.alert('Save Failed', response.error.message);
    } else {
      console.log('Item saved successfully');
      resetForm();
      Alert.alert('Success', `Item ${editingItem ? 'updated' : 'added'} successfully!`, [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Pantry')
        },
      ]);
    }
  } catch (error) {
    console.error('Save error:', error);
    Alert.alert('Error', 'An unexpected error occurred.');
  } finally {
    setLoading(false);
  }
};


  const resetForm = () => {
    setItemName('');
    setBarcode('');
    setQuantity('1');
    setQuantityUnit('pieces');
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    setExpirationDate(defaultDate);
    setIsOpened(false);
    setOpeningDate(new Date());
    setStorageCondition('refrigerated');
    setDescription('');
    setItemImage(null);
  };

  const UnitPickerModal = () => (
    <Modal
      visible={showUnitPicker}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowUnitPicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Unit</Text>
            <TouchableOpacity onPress={() => setShowUnitPicker(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.unitList}>
            {QUANTITY_UNITS.map((unit) => (
              <TouchableOpacity
                key={unit}
                style={[
                  styles.unitOption,
                  quantityUnit === unit && styles.unitOptionSelected
                ]}
                onPress={() => {
                  setQuantityUnit(unit);
                  setShowUnitPicker(false);
                }}
              >
                <Text style={[
                  styles.unitOptionText,
                  quantityUnit === unit && styles.unitOptionTextSelected
                ]}>
                  {unit}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const StoragePickerModal = () => (
    <Modal
      visible={showStoragePicker}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowStoragePicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Storage Condition</Text>
            <TouchableOpacity onPress={() => setShowStoragePicker(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <View style={styles.storageOptions}>
            {STORAGE_CONDITIONS.map((condition) => (
              <TouchableOpacity
                key={condition.value}
                style={[
                  styles.storageOption,
                  storageCondition === condition.value && styles.storageOptionSelected
                ]}
                onPress={() => {
                  setStorageCondition(condition.value);
                  setShowStoragePicker(false);
                }}
              >
                <Ionicons name={condition.icon} size={24} color={storageCondition === condition.value ? '#fff' : '#4CAF50'} />
                <Text style={[
                  styles.storageOptionText,
                  storageCondition === condition.value && styles.storageOptionTextSelected
                ]}>
                  {condition.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );

  const ImageOptionsModal = () => (
    <Modal
      visible={showImageOptions}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowImageOptions(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Photo</Text>
            <TouchableOpacity onPress={() => setShowImageOptions(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          <View style={styles.imageOptions}>
            <TouchableOpacity
              style={styles.imageOption}
              onPress={handleOpenCamera}
            >
              <Ionicons name="camera" size={24} color="#00C897" />
              <Text style={styles.imageOptionText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.imageOption}
              onPress={selectImageFromLibrary}
            >
              <Ionicons name="image" size={24} color="#00C897" />
              <Text style={styles.imageOptionText}>Choose from Library</Text>
            </TouchableOpacity>

            {itemImage && (
              <TouchableOpacity
                style={styles.imageOption}
                onPress={removeImage}
              >
                <Ionicons name="trash" size={24} color="#F44336" />
                <Text style={[styles.imageOptionText, { color: '#F44336' }]}>Remove Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{editingItem ? 'Edit Item' : 'Add New Item'}</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Main Form */}
        <View style={styles.formContainer}>
          {/* Item Image */}
          <TouchableOpacity
            style={styles.imageButton}
            onPress={handleImagePicker}
          >
            {itemImage ? (
              <Image source={{ uri: itemImage }} style={styles.itemImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="camera" size={32} color="#00C897" />
                <Text style={styles.imagePlaceholderText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Barcode Section */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Barcode</Text>
            <View style={styles.barcodeContainer}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={barcode}
                onChangeText={setBarcode}
                placeholder="Enter barcode or scan"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.scanButton}
                onPress={() => navigation.navigate('BarcodeScannerScreen')}
              >
                <Ionicons name="barcode" size={24} color="#fff" />
              </TouchableOpacity>
              {barcode && !editingItem && ( // Show fetch button only if barcode is present and not editing
                <TouchableOpacity
                  style={styles.fetchButton}
                  onPress={() => fetchProductFromBarcode(barcode)}
                  disabled={loading}
                >
                  <Ionicons name="cloud-download" size={20} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Item Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Item Name *</Text>
            <TextInput
              style={styles.input}
              value={itemName}
              onChangeText={setItemName}
              placeholder="e.g. Fresh Tomatoes"
              placeholderTextColor="#999"
              autoCapitalize="words"
            />
          </View>

          {/* Quantity and Unit */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 2, marginRight: 10 }]}>
              <Text style={styles.inputLabel}>Quantity *</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholder="e.g. 2"
                placeholderTextColor="#999"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Unit</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowUnitPicker(true)}
              >
                <Text style={styles.pickerButtonText}>{quantityUnit}</Text>
                <Ionicons name="chevron-down" size={16} color="#666" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Expiration Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Expiration Date *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.pickerButtonText}>
                {formatDate(expirationDate)}
              </Text>
              <Ionicons name="calendar" size={16} color="#666" />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={expirationDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                minimumDate={new Date()}
              />
            )}
          </View>

          {/* Quick Date Selection */}
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

          {/* Item Status */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Item Status</Text>
            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Item is opened</Text>
              <Switch
                value={isOpened}
                onValueChange={setIsOpened}
                trackColor={{ false: '#E0E0E0', true: '#43d9b4' }}
                thumbColor={isOpened ? '#00C897' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* Opened Item Details */}
          {isOpened && (
            <View style={styles.openedDetailsContainer}>
              {/* Opening Date */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Opening Date</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowOpeningDatePicker(true)}
                >
                  <Text style={styles.pickerButtonText}>
                    {formatDate(openingDate)}
                  </Text>
                  <Ionicons name="calendar" size={16} color="#666" />
                </TouchableOpacity>
                {showOpeningDatePicker && (
                  <DateTimePicker
                    value={openingDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleOpeningDateChange}
                    maximumDate={new Date()}
                  />
                )}
              </View>

              {/* Storage Condition */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Storage Condition *</Text>
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => setShowStoragePicker(true)}
                >
                  <Ionicons name={getStorageIcon(storageCondition)} size={16} color="#666" />
                  <Text style={styles.pickerButtonText}>
                    {getStorageLabel(storageCondition)}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color="#666" />
                </TouchableOpacity>
              </View>

              {/* Calculated Expiration */}
              {calculatedExpirationDate && (
                <View style={styles.expirationCalculation}>
                  <Text style={styles.calculationTitle}>Calculated Expiration</Text>
                  <Text style={styles.calculationDate}>
                    {formatDate(calculatedExpirationDate)}
                  </Text>
                  <Text style={styles.calculationDays}>
                    ({getDaysUntilExpiration(calculatedExpirationDate)} days from now)
                  </Text>

                  {showExpirationWarning && (
                    <View style={styles.warningContainer}>
                      <Ionicons name="warning" size={16} color="#FF9800" />
                      <Text style={styles.warningText}>
                        Storage conditions significantly reduce shelf life
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={styles.descriptionInput}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Ingredients: flour, eggs, milk, sugar..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Save Button */}
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
      </ScrollView>

      {/* Modals */}
      <UnitPickerModal />
      <StoragePickerModal />
      <ImageOptionsModal />
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContainer: {
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    width: 24,
  },
  formContainer: {
    padding: 20,
  },
  imageButton: {
    height: 150,
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: '#757575',
    marginTop: 8,
  },
  barcodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: '#00C897',
    borderRadius: 8,
    padding: 12,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fetchButton: { // Added style for fetch button
    backgroundColor: '#2196F3',
    borderRadius: 8,
    padding: 12,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#616161',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#333',
  },
  quickDateContainer: {
    marginBottom: 15,
  },
  quickDateLabel: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 8,
  },
  quickDateButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickDateButton: {
    backgroundColor: '#E8F5E9',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  quickDateButtonText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  openedDetailsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  expirationCalculation: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 15,
    marginTop: 10,
  },
  calculationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 5,
  },
  calculationDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  calculationDays: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FFF3CD',
    borderRadius: 6,
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
    marginLeft: 8,
    flex: 1,
  },
  descriptionInput: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    fontSize: 16,
    color: '#333',
    height: 100,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#00C897',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: width * 0.85,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  unitList: {
    maxHeight: 300,
  },
  unitOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  unitOptionSelected: {
    backgroundColor: '#E8F5E9',
  },
  unitOptionText: {
    fontSize: 16,
    color: '#333',
  },
  unitOptionTextSelected: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  storageOptions: {
    gap: 10,
  },
  storageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  storageOptionSelected: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  storageOptionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  storageOptionTextSelected: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  imageOptions: {
    gap: 15,
  },
  imageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  imageOptionText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
});
