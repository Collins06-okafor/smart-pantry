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
  { value: 'refrigerated', label: 'Refrigerated (0-4°C)', icon: '❄️' },
  { value: 'room_temp', label: 'Room Temperature', icon: '🌡️' },
  { value: 'frozen', label: 'Frozen (-18°C)', icon: '🧊' },
];

export default function AddItemScreen({ route, navigation }) {
  const editingItem = route.params?.item ?? null;

  const [itemName, setItemName] = useState(editingItem?.item_name || '');
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
  const [description, setDescription] = useState(editingItem?.description || '');
  const [itemImage, setItemImage] = useState(editingItem?.image_url || null);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [calculatedExpirationDate, setCalculatedExpirationDate] = useState(null);
  const [showExpirationWarning, setShowExpirationWarning] = useState(false);

  useEffect(() => {
    if (!route.params?.item) {
      resetForm();
    }
  }, [route.params?.item]);

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
        // Clear the parameter after using it
        navigation.setParams({ imageUri: null });
      }
    });

    return unsubscribe;
  }, [navigation]);

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
    return storage ? storage.icon : '📦';
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
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Auth Error', 'You must be logged in.');
        return;
      }

      const item = {
        user_id: user.id,
        item_name: itemName.trim(),
        quantity: quantityNum,
        quantity_unit: quantityUnit,
        expiration_date: formatDateForDatabase(expirationDate),
        is_opened: isOpened,
        opening_date: isOpened ? formatDateForDatabase(openingDate) : null,
        storage_condition: isOpened ? storageCondition : null,
        description: description.trim() || null,
        image_url: itemImage,
      };

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
              <Text style={styles.modalCloseButton}>✕</Text>
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
              <Text style={styles.modalCloseButton}>✕</Text>
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
                <Text style={styles.storageOptionIcon}>{condition.icon}</Text>
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

// Updated section from AddItemScreen.js
// Replace the ImageOptionsModal component with this updated version

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
            <Text style={styles.modalCloseButton}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.imageOptions}>
          <TouchableOpacity
            style={styles.imageOption}
            onPress={() => {
              setShowImageOptions(false);
              // Use the correct screen name - check your navigator configuration
              navigation.navigate('Camera', {
                returnScreen: 'AddItem', // or whatever your screen is named in the navigator
                timestamp: Date.now(), // Forces fresh navigation
              });
            }}
          >
            <Text style={styles.imageOptionIcon}>📷</Text>
            <Text style={styles.imageOptionText}>Take Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.imageOption}
            onPress={selectImageFromLibrary}
          >
            <Text style={styles.imageOptionIcon}>🖼️</Text>
            <Text style={styles.imageOptionText}>Choose from Library</Text>
          </TouchableOpacity>
          
          {itemImage && (
            <TouchableOpacity
              style={styles.imageOption}
              onPress={removeImage}
            >
              <Text style={styles.imageOptionIcon}>🗑️</Text>
              <Text style={styles.imageOptionText}>Remove Photo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  </Modal>
);

  return (
    <ScrollView style={styles.container}>
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

      <View style={styles.quantityContainer}>
        <View style={styles.quantityInputContainer}>
          <Text style={styles.label}>Quantity *</Text>
          <TextInput
            style={styles.quantityInput}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            placeholder="e.g. 2"
            placeholderTextColor="#999"
          />
        </View>
        <View style={styles.unitContainer}>
          <Text style={styles.label}>Unit</Text>
          <TouchableOpacity
            style={styles.unitButton}
            onPress={() => setShowUnitPicker(true)}
          >
            <Text style={styles.unitButtonText}>{quantityUnit}</Text>
            <Text style={styles.unitButtonIcon}>⌄</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.label}>Expiration Date *</Text>
      <TouchableOpacity 
        style={styles.dateButton}
        onPress={() => setShowDatePicker(true)}
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
          minimumDate={new Date()}
        />
      )}

      <View style={styles.openedContainer}>
        <Text style={styles.label}>Item Status</Text>
        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Item is opened</Text>
          <Switch
            value={isOpened}
            onValueChange={setIsOpened}
            trackColor={{ false: '#767577', true: '#00C897' }}
            thumbColor={isOpened ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>

      {isOpened && (
        <View style={styles.openedDetailsContainer}>
          <Text style={styles.label}>Opening Date</Text>
          <TouchableOpacity 
            style={styles.dateButton}
            onPress={() => setShowOpeningDatePicker(true)}
          >
            <Text style={styles.dateButtonText}>
              {formatDate(openingDate)}
            </Text>
            <Text style={styles.dateButtonIcon}>📅</Text>
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

          <Text style={styles.label}>Storage Condition *</Text>
          <TouchableOpacity
            style={styles.storageButton}
            onPress={() => setShowStoragePicker(true)}
          >
            <View style={styles.storageButtonContent}>
              <Text style={styles.storageButtonIcon}>
                {getStorageIcon(storageCondition)}
              </Text>
              <Text style={styles.storageButtonText}>
                {getStorageLabel(storageCondition)}
              </Text>
            </View>
            <Text style={styles.storageButtonArrow}>⌄</Text>
          </TouchableOpacity>

          {calculatedExpirationDate && (
            <View style={styles.expirationCalculation}>
              <Text style={styles.calculationTitle}>📊 Calculated Expiration</Text>
              <Text style={styles.calculationDate}>
                {formatDate(calculatedExpirationDate)}
              </Text>
              <Text style={styles.calculationDays}>
                ({getDaysUntilExpiration(calculatedExpirationDate)} days from now)
              </Text>
              
              {showExpirationWarning && (
                <View style={styles.warningContainer}>
                  <Text style={styles.warningIcon}>⚠️</Text>
                  <Text style={styles.warningText}>
                    Storage conditions significantly reduce shelf life from original expiration date
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      <Text style={styles.label}>Description</Text>
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

      <Text style={styles.label}>Photo</Text>
      <TouchableOpacity
        style={styles.imageButton}
        onPress={handleImagePicker}
      >
        {itemImage ? (
          <Image source={{ uri: itemImage }} style={styles.itemImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderIcon}>📷</Text>
            <Text style={styles.imagePlaceholderText}>Add Photo</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.quickDateContainer}>
        <Text style={styles.quickDateLabel}>Quick select expiration:</Text>
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

      <TouchableOpacity
        style={[styles.saveButton, loading && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={loading}
      >
        <Text style={styles.saveButtonText}>
          {loading ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
        </Text>
      </TouchableOpacity>

      <UnitPickerModal />
      <StoragePickerModal />
      <ImageOptionsModal />
    </ScrollView>
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
  quantityContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  quantityInputContainer: {
    flex: 2,
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    fontSize: 16,
  },
  unitContainer: {
    flex: 1,
  },
  unitButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unitButtonText: {
    fontSize: 16,
    color: '#333',
  },
  unitButtonIcon: {
    fontSize: 16,
    color: '#666',
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
  openedContainer: {
    marginTop: 10,
  },
  openedDetailsContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  storageButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  storageButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storageButtonIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  storageButtonText: {
    fontSize: 16,
    color: '#333',
  },
  storageButtonArrow: {
    fontSize: 16,
    color: '#666',
  },
  expirationCalculation: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  calculationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 5,
  },
  calculationDate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  calculationDays: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fff3cd',
    borderRadius: 6,
  },
  warningIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    flex: 1,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9f9f9',
    marginBottom: 10,
    fontSize: 16,
    height: 100,
  },
  imageButton: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    marginBottom: 10,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePlaceholderIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  imagePlaceholderText: {
    fontSize: 16,
    color: '#666',
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
    marginBottom: 20,
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
    width: width * 0.8,
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
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    fontSize: 24,
    color: '#666',
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
    backgroundColor: '#00C897',
  },
  unitOptionText: {
    fontSize: 16,
    color: '#333',
  },
  unitOptionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  storageOptions: {
    gap: 10,
  },
  storageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  storageOptionSelected: {
    backgroundColor: '#00C897',
    borderColor: '#00C897',
  },
  storageOptionIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  storageOptionText: {
    fontSize: 16,
    color: '#333',
  },
  storageOptionTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  imageOptions: {
    gap: 15,
  },
  imageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
  },
  imageOptionIcon: {
    fontSize: 24,
    marginRight: 15,
  },
  imageOptionText: {
    fontSize: 16,
    color: '#333',
  },
});