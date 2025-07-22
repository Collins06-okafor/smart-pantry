import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  ActionSheetIOS,
  ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import DiscardItemModal from './DiscardItemModal';
import NetInfo from '@react-native-community/netinfo';
import { uploadFoodImage } from '../utils/uploadFoodImage';
import * as FileSystem from 'expo-file-system';

const { width, height } = Dimensions.get('window');

// Helper to get emoji for item name (used in ImageWithFallback)
const getItemEmoji = (name) => {
  if (!name) return '❓';
  
  const lower = name.toLowerCase();
  
  if (lower.includes('apple')) return '🍎';
  if (lower.includes('banana')) return '🍌';
  if (lower.includes('bread')) return '🍞';
  if (lower.includes('milk')) return '🥛';
  if (lower.includes('eggs')) return '🥚';
  if (lower.includes('cheese')) return '🧀';
  if (lower.includes('tomato')) return '🍅';
  if (lower.includes('potato')) return '🥔';
  if (lower.includes('carrot')) return '🥕';
  if (lower.includes('chicken')) return '🍗';
  if (lower.includes('fish')) return '🐟';
  if (lower.includes('rice')) return '🍚';
  if (lower.includes('pasta')) return '🍝';
  if (lower.includes('avocado')) return '🥑';
  
  return '🍽️'; // default
};

// Local image assets for common food items (replace with your actual paths)
const foodImages = {
  'apple': require('../assets/images/apple.png'),
  'banana': require('../assets/images/banana.png'),
  'bread': require('../assets/images/bread.png'),
  'milk': require('../assets/images/milk.png'),
  'eggs': require('../assets/images/eggs.png'),
  'cheese': require('../assets/images/cheese.png'),
  'tomato': require('../assets/images/tomato.png'),
  'potato': require('../assets/images/potato.png'),
  'carrot': require('../assets/images/carrot.png'),
  'chicken': require('../assets/images/chicken.png'),
  'fish': require('../assets/images/fish.png'),
  'rice': require('../assets/images/rice.png'),
  'pasta': require('../assets/images/pasta.png'),
  'avocado': require('../assets/images/avocado.png'),
};

// Options for quantity units
const UNIT_OPTIONS = [
  'pieces', 'kg', 'g', 'lbs', 'oz', 'liters', 'ml', 'cups', 'tbsp', 'tsp',
  'cans', 'bottles', 'boxes', 'bags', 'packs', 'bundles', 'dozen',
];

// Image component with fallback logic
const ImageWithFallback = ({ 
  imageUrl, 
  localImage, 
  itemName, 
  style, 
  onImageError, 
  ...props 
}) => {
  const [currentImageUrl, setCurrentImageUrl] = useState(imageUrl);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    setCurrentImageUrl(imageUrl);
    setHasError(false);
    setIsLoading(!!imageUrl);
  }, [imageUrl]);

  const handleImageError = (error) => {
    console.log('Image error for:', currentImageUrl, error);
    setHasError(true);
    setIsLoading(false);
    onImageError && onImageError(error);
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  // Show loading indicator while image is loading
  if (isLoading) {
    return (
      <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Show remote image if available and no error
  if (currentImageUrl && !hasError) {
    return (
      <Image
        source={{ uri: currentImageUrl }}
        style={style}
        onError={handleImageError}
        onLoad={handleImageLoad}
        {...props}
      />
    );
  }

  // Show local image if available
  if (localImage) {
    return (
      <Image
        source={localImage}
        style={style}
        onLoad={handleImageLoad}
        {...props}
      />
    );
  }

  // Show emoji fallback
  return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
      <Text style={{ fontSize: style.width ? style.width * 0.4 : 80 }}>
        {getItemEmoji(itemName)}
      </Text>
    </View>
  );
};

const FoodDetailsScreen = ({ route, navigation }) => {
  const mockFoodItem = {
    id: 'mock-item-123',
    item_name: 'Apple',
    quantity: 5,
    quantity_unit: 'pieces',
    expiration_date: '2023-12-25',
    description: 'Fresh organic apples from local farm. Great for snacks or baking.',
    image_url: 'https://picsum.photos/id/1080/400/400',
  };
  const mockExpirationStatus = {
    status: 'fresh',
    daysLeft: 30
  };

  const { 
    foodItem = mockFoodItem, 
    expirationStatus = mockExpirationStatus, 
    onItemUpdated,
    onItemDeleted,
    onItemDiscarded
  } = route.params || {};

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isDiscardModalVisible, setIsDiscardModalVisible] = useState(false);
  const [isUnitDropdownVisible, setIsUnitDropdownVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState(foodItem);
  const [editedItem, setEditedItem] = useState({
    item_name: foodItem.item_name,
    quantity: foodItem.quantity ? String(foodItem.quantity) : '1',
    unit: foodItem.quantity_unit || 'pieces',
    expiration_date: foodItem.expiration_date || '',
    description: foodItem.description || '',
    image_url: foodItem.image_url || ''
  });
  const [userId, setUserId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState(null);
  
  const quantityInputRef = useRef(null);
  const expirationInputRef = useRef(null);
  const descriptionInputRef = useRef(null);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    const getUserId = async () => {
      try {
        const user = { id: 'mock-user-id-123' }; 
        if (user?.id) {
          setUserId(user.id);
        }
      } catch (error) {
        console.error('Error getting user:', error);
      }
    };
    getUserId();
  }, []);

  useEffect(() => {
    if (isEditModalVisible) {
      setEditedItem({
        item_name: currentItem.item_name,
        quantity: currentItem.quantity ? String(currentItem.quantity) : '1',
        unit: currentItem.quantity_unit || 'pieces',
        expiration_date: currentItem.expiration_date || '',
        description: currentItem.description || '',
        image_url: currentItem.image_url || ''
      });
      setSelectedImageUri(null);
    }
  }, [isEditModalVisible, currentItem]);

  const isExpired = expirationStatus.status === 'expired';
  const isExpiring = expirationStatus.status === 'expiring';
  
  // Fix: Safely get local image with error handling
  const getLocalImage = (itemName) => {
    if (!itemName) return null;
    try {
      const key = itemName.toLowerCase();
      return foodImages[key] || null;
    } catch (error) {
      console.log('Error getting local image:', error);
      return null;
    }
  };
  
  const localImage = getLocalImage(currentItem.item_name);

  const deleteOldFoodImage = async (imageUrl) => {
    if (!imageUrl || imageUrl.startsWith('file://')) return; 

    try {
      console.log('Mock: Deleting old food image:', imageUrl);
    } catch (error) {
      console.log('Error in deleteOldFoodImage:', error);
    }
  };
  
  const uploadFoodItemImage = async (imageUri, userId, itemId) => {
    const fileName = `${userId}_${itemId}_${Date.now()}.jpg`;

    // Convert local image URI to blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    const { data, error } = await supabase.storage
      .from('pantry-item-images')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from('pantry-item-images')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  };

  const checkNetworkConnection = async () => {
    return true; 
  };

  const handleImagePicker = () => {
    const options = [
      { text: 'Take Photo', onPress: () => openCamera() },
      { text: 'Choose from Library', onPress: () => openImageLibrary() },
      ...(editedItem.image_url ? [{ text: 'Remove Photo', onPress: () => removePhoto() }] : []),
      { text: 'Cancel', style: 'cancel' }
    ];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: options.map(option => option.text),
          destructiveButtonIndex: editedItem.image_url ? 2 : -1, 
          cancelButtonIndex: options.length - 1, 
        },
        (buttonIndex) => {
          if (buttonIndex < options.length - 1) { 
            options[buttonIndex].onPress();
          }
        }
      );
    } else {
      Alert.alert(
        'Select Image',
        'Choose an option',
        options.map(option => ({
          text: option.text,
          onPress: option.onPress,
          style: option.style || 'default'
        }))
      );
    }
  };

  const removePhoto = () => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            updateEditedItem('image_url', ''); 
            setSelectedImageUri(null);
          }
        }
      ]
    );
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      handleImageSelection(result.assets[0]);
    }
  };

  const openImageLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need photo library permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      handleImageSelection(result.assets[0]);
    }
  };

  const handleImageSelection = async (imageAsset) => {
    console.log('Starting image selection...', imageAsset);
    
    if (!imageAsset.uri) {
      Alert.alert('Error', 'No image selected');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setIsUploadingImage(true);
    setSelectedImageUri(imageAsset.uri); // Set the selected image immediately
    
    try {
      // Update the edited item with the local URI first for immediate display
      updateEditedItem('image_url', imageAsset.uri);

      console.log('Uploading image...');
      const publicUrl = await uploadFoodItemImage(imageAsset.uri, userId, currentItem.id);
      console.log('Image uploaded successfully:', publicUrl);
      
      // Delete old image if it exists
      if (currentItem.image_url && 
          currentItem.image_url !== publicUrl && 
          !currentItem.image_url.startsWith('file://')) {
        console.log('Deleting old image...');
        await deleteOldFoodImage(currentItem.image_url);
      }

      // Update with the public URL
      updateEditedItem('image_url', publicUrl);
      setSelectedImageUri(null); // Clear selected URI since we now have public URL
      
      Alert.alert('Success', 'Image uploaded successfully!');
      
    } catch (error) {
      console.error('Error uploading image:', error);
      // Revert to original image on error
      updateEditedItem('image_url', currentItem.image_url || '');
      setSelectedImageUri(null);
      
      let errorMessage = 'Failed to upload image. Please try again.';
      if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('size')) {
        errorMessage = 'Image file is too large. Please choose a smaller image.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleDelete = (item) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete ${item.item_name} from your pantry?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            if (!item.id || !userId) {
              Alert.alert('Error', 'Unable to delete item. Please try again.');
              return;
            }

            try {
              if (item.image_url) {
                await deleteOldFoodImage(item.image_url);
              }

              console.log(`Mock: Deleting item ${item.id} for user ${userId}`);
              
              if (onItemDeleted) {
                onItemDeleted(item.id);
              }
              
              Alert.alert(
                'Item Deleted',
                `${item.item_name} has been removed from your pantry.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }] 
              );
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleShare = async (item) => {
    try {
      Alert.alert('Share Mock', `Would share ${item.item_name}`);
    } catch (error) {
      console.error('Error navigating to share screen:', error);
      Alert.alert('Error', 'Could not open share screen. Please try again.');
    }
  };

  const handleDiscard = (item) => {
    if (!item.id || !userId) {
      Alert.alert(
        'Error', 
        'Unable to discard item. Please try again.',
        [{ text: 'OK' }]
      );
      return;
    }
    setIsDiscardModalVisible(true);
  };

  const handleDiscardComplete = () => {
    console.log('Mock: Discard complete, navigating back.');
    
    if (onItemDiscarded) {
      onItemDiscarded(currentItem.id);
    }
    
    navigation.goBack();
  };

  const updateEditedItem = useCallback((field, value) => {
    setEditedItem(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleSaveEdit = async () => {
    const isConnected = await checkNetworkConnection();
    if (!isConnected) {
      Alert.alert('No Connection', 'Please check your internet connection and try again.');
      return;
    }

    if (!editedItem.item_name.trim()) {
      Alert.alert('Error', 'Item name cannot be empty');
      return;
    }

    const parsedQuantity = parseFloat(editedItem.quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity greater than 0');
      return;
    }

    if (editedItem.expiration_date.trim()) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(editedItem.expiration_date)) {
        Alert.alert('Error', 'Please enter date in YYYY-MM-DD format');
        return;
      }

      const date = new Date(editedItem.expiration_date);
      if (isNaN(date.getTime())) {
        Alert.alert('Error', 'Please enter a valid date');
        return;
      }
    }

    if (!currentItem.id || !userId) {
      Alert.alert('Error', 'Unable to update item. Please try again.');
      return;
    }

    setIsSaving(true);

    try {
      const updatedItem = {
        item_name: editedItem.item_name.trim(),
        quantity: parsedQuantity,
        quantity_unit: editedItem.unit.trim(),
        expiration_date: editedItem.expiration_date.trim() || null,
        description: editedItem.description.trim(),
        image_url: editedItem.image_url.trim() || null,
        updated_at: new Date().toISOString()
      };

      // Real Supabase Update
      const { error } = await supabase
        .from('pantry_items')
        .update(updatedItem)
        .eq('id', currentItem.id)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      const newCurrentItem = {
        ...currentItem,
        ...updatedItem
      };

      setCurrentItem(newCurrentItem);

      if (onItemUpdated) {
        onItemUpdated(newCurrentItem);
      }

      setIsEditModalVisible(false);

      setTimeout(() => {
        Alert.alert('Success', 'Item updated successfully!');
      }, 300);

    } catch (error) {
      console.error('Error updating item:', error);

      let errorMessage = 'Failed to update item. Please try again.';

      if (error.message.includes('JWT')) {
        errorMessage = 'Authentication error. Please log in again.';
      } else if (error.message.includes('permission')) {
        errorMessage = 'You don\'t have permission to update this item.';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check your connection.';
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString; 
      }
      return date.toLocaleDateString();
    } catch (e) {
      console.error("Error formatting date:", e);
      return dateString; 
    }
  };

  const UnitDropdown = () => (
    <Modal
      visible={isUnitDropdownVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setIsUnitDropdownVisible(false)}
    >
      <TouchableOpacity 
        style={styles.dropdownOverlay}
        onPress={() => setIsUnitDropdownVisible(false)} 
      >
        <View style={styles.dropdownContainer}>
          <ScrollView style={styles.dropdownScrollView}>
            {UNIT_OPTIONS.map((unit) => (
              <TouchableOpacity
                key={unit}
                style={[
                  styles.dropdownItem,
                  editedItem.unit === unit && styles.dropdownItemSelected
                ]}
                onPress={() => {
                  updateEditedItem('unit', unit);
                  setIsUnitDropdownVisible(false);
                }}
              >
                <Text style={[
                  styles.dropdownItemText,
                  editedItem.unit === unit && styles.dropdownItemTextSelected
                ]}>
                  {unit}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const EditModal = () => (
    <Modal
      visible={isEditModalVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setIsEditModalVisible(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20} 
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsEditModalVisible(false)} disabled={isSaving}>
              <Text style={[styles.modalCancelButton, isSaving && { opacity: 0.5 }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Item</Text>
            <TouchableOpacity 
              onPress={handleSaveEdit} 
              disabled={isSaving || isUploadingImage}
              style={[
                styles.modalSaveButtonContainer,
                (isSaving || isUploadingImage) && styles.buttonDisabled
              ]}
            >
              <Text style={[
                styles.modalSaveButton,
                (isSaving || isUploadingImage) && styles.buttonTextDisabled
              ]}>
                {isSaving ? 'Saving...' : isUploadingImage ? 'Uploading...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            ref={scrollViewRef} 
            contentContainerStyle={styles.modalContent} 
            keyboardShouldPersistTaps="handled" 
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.imageEditSection}>
              <TouchableOpacity 
                style={styles.imageEditContainer}
                onPress={handleImagePicker}
                disabled={isUploadingImage} 
              >
                <ImageWithFallback
                  imageUrl={selectedImageUri || editedItem.image_url}
                  localImage={localImage} 
                  itemName={editedItem.item_name}
                  style={styles.editImage}
                  onImageError={() => {
                    console.log('Image error in edit modal, clearing image_url');
                    updateEditedItem('image_url', '');
                  }}
                  resizeMode="cover"
                />
                
                {!isUploadingImage && (
                  <View style={styles.imageEditOverlay}>
                    <Text style={styles.editImageIcon}>📷</Text>
                    <Text style={styles.editImageText}>
                      {editedItem.image_url ? 'Change Photo' : 'Add Photo'}
                    </Text>
                  </View>
                )}
                
                {isUploadingImage && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.uploadingText}>Uploading...</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Item Name</Text>
              <TextInput
                style={styles.textInput}
                value={editedItem.item_name}
                onChangeText={(text) => updateEditedItem('item_name', text)}
                placeholder="Enter item name"
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => quantityInputRef.current?.focus()}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, styles.inputGroupHalf]}>
                <Text style={styles.inputLabel}>Quantity</Text>
                <TextInput
                  ref={quantityInputRef} 
                  style={styles.textInput}
                  value={editedItem.quantity}
                  onChangeText={(text) => {
                    const numericValue = text.replace(/[^0-9.]/g, '');
                    if ((numericValue.match(/\./g) || []).length > 1) {
                      return;
                    }
                    updateEditedItem('quantity', numericValue);
                  }}
                  placeholder="1"
                  keyboardType="numeric"
                  returnKeyType="next"
                  onSubmitEditing={() => expirationInputRef.current?.focus()}
                />
              </View>

              <View style={[styles.inputGroup, styles.inputGroupHalf]}>
                <Text style={styles.inputLabel}>Unit</Text>
                <TouchableOpacity
                  style={[styles.textInput, styles.unitSelector]}
                  onPress={() => setIsUnitDropdownVisible(true)}
                >
                  <Text style={styles.unitSelectorText}>{editedItem.unit}</Text>
                  <Text style={styles.unitSelectorArrow}>▼</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Expiration Date</Text>
              <TextInput
                ref={expirationInputRef} 
                style={styles.textInput}
                value={editedItem.expiration_date}
                onChangeText={(text) => updateEditedItem('expiration_date', text)}
                placeholder="YYYY-MM-DD"
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                returnKeyType="next"
                onSubmitEditing={() => descriptionInputRef.current?.focus()}
              />
              <Text style={styles.inputHint}>Format: YYYY-MM-DD</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                ref={descriptionInputRef} 
                style={[styles.textInput, styles.textInputMultiline]}
                value={editedItem.description}
                onChangeText={(text) => updateEditedItem('description', text)}
                placeholder="Optional description"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                  }, 100); 
                }}
              />
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          {isUnitDropdownVisible && <UnitDropdown />}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  if (isSaving) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Saving...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary navigation={navigation}>
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.backButtonText}>← Back</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => setIsEditModalVisible(true)}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.imageSection}>
              <ImageWithFallback
                imageUrl={currentItem.image_url}
                localImage={localImage}
                itemName={currentItem.item_name}
                style={styles.foodImage}
                onImageError={() => {
                  console.log('Image error in main view, clearing image_url');
                  setCurrentItem(prev => ({ ...prev, image_url: '' }));
                }}
                resizeMode="cover"
              />
            </View>

            <View style={styles.detailsSection}>
              <View style={styles.titleRow}>
                <Text style={styles.itemTitle}>{currentItem.item_name}</Text>
                <View style={[
                  styles.statusBadge,
                  isExpired && styles.statusBadgeExpired,
                  isExpiring && styles.statusBadgeExpiring
                ]}>
                  <Text style={[
                    styles.statusText,
                    isExpired && styles.statusTextExpired,
                    isExpiring && styles.statusTextExpiring
                  ]}>
                    {isExpired ? '⚠️ Expired' : isExpiring ? '⏰ Expiring Soon' : '✅ Fresh'}
                  </Text>
                </View>
              </View>

              <View style={styles.quantitySection}>
                <Text style={styles.quantityText}>
                  {currentItem.quantity} {currentItem.quantity_unit}
                </Text>
              </View>

              {currentItem.expiration_date && (
                <View style={styles.expirationSection}>
                  <Text style={styles.sectionLabel}>Expires:</Text>
                  <Text style={[
                    styles.expirationDate,
                    isExpired && styles.expirationDateExpired,
                    isExpiring && styles.expirationDateExpiring
                  ]}>
                    {formatDate(currentItem.expiration_date)}
                    {expirationStatus.daysLeft !== undefined && (
                      <Text style={styles.daysLeft}>
                        {isExpired 
                          ? ` (${Math.abs(expirationStatus.daysLeft)} days ago)`
                          : ` (${expirationStatus.daysLeft} days left)`
                        }
                      </Text>
                    )}
                  </Text>
                </View>
              )}

              {currentItem.description && (
                <View style={styles.descriptionSection}>
                  <Text style={styles.sectionLabel}>Description:</Text>
                  <Text style={styles.descriptionText}>{currentItem.description}</Text>
                </View>
              )}
            </View>

            <View style={styles.actionsSection}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.shareButton]}
                onPress={() => handleShare(currentItem)}
              >
                <Text style={styles.shareButtonText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, styles.discardButton]}
                onPress={() => handleDiscard(currentItem)}
              >
                <Text style={styles.discardButtonText}>Discard</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleDelete(currentItem)}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <EditModal />

          <DiscardItemModal
            visible={isDiscardModalVisible}
            onClose={() => setIsDiscardModalVisible(false)}
            onDiscard={handleDiscardComplete}
            foodItem={currentItem}
            userId={userId}
          />
        </SafeAreaView>
      </View>
    </ErrorBoundary>
  );
};

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('FoodDetailsScreen Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorMessage}>
              Unable to load food item details. Please try again.
            </Text>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={() => this.props.navigation.goBack()}
            >
              <Text style={styles.errorButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  editButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  editButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  imageSection: {
    backgroundColor: 'white',
    paddingTop: 20,
    alignItems: 'center',
  },
  foodImage: {
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  detailsSection: {
    backgroundColor: 'white',
    padding: 20,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  itemTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#e8f5e8',
  },
  statusBadgeExpired: {
    backgroundColor: '#ffeaea',
  },
  statusBadgeExpiring: {
    backgroundColor: '#fff3cd',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#28a745',
  },
  statusTextExpired: {
    color: '#dc3545',
  },
  statusTextExpiring: {
    color: '#ffc107',
  },
  quantitySection: {
    marginBottom: 16,
  },
  quantityText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
  },
  expirationSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  expirationDate: {
    fontSize: 18,
    color: '#666',
  },
  expirationDateExpired: {
    color: '#dc3545',
    fontWeight: '600',
  },
  expirationDateExpiring: {
    color: '#ffc107',
    fontWeight: '600',
  },
  daysLeft: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  descriptionSection: {
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  actionsSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: 'white',
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  shareButton: {
    backgroundColor: '#007AFF',
  },
  shareButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  discardButton: {
    backgroundColor: '#ff9500',
  },
  discardButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCancelButton: {
    fontSize: 16,
    color: '#007AFF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalSaveButtonContainer: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  modalSaveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonTextDisabled: {
    color: '#999',
  },
  modalContent: {
    padding: 20,
  },
  imageEditSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  imageEditContainer: {
    position: 'relative',
  },
  editImage: {
    width: 200,
    height: 200,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  imageEditOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editImageIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  editImageText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputGroupHalf: {
    width: '48%',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
    color: '#333',
  },
  textInputMultiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  unitSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unitSelectorText: {
    fontSize: 16,
    color: '#333',
  },
  unitSelectorArrow: {
    fontSize: 12,
    color: '#999',
  },
  // Dropdown Styles
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    maxHeight: height * 0.5,
    width: width * 0.7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownScrollView: {
    maxHeight: height * 0.4,
  },
  dropdownItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemSelected: {
    backgroundColor: '#f0f8ff',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownItemTextSelected: {
    color: '#007AFF',
    fontWeight: '600',
  },
  // Error Boundary Styles
  errorContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContent: {
    padding: 24,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  errorButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FoodDetailsScreen;