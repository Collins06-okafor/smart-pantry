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
  Share,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  ActionSheetIOS
} from 'react-native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { supabase } from '../lib/supabase';
import DiscardItemModal from './DiscardItemModal';
import { Ionicons } from '@expo/vector-icons';
import { uploadFoodImage } from '../utils/uploadFoodImage';


const { width, height } = Dimensions.get('window');

const getItemEmoji = (name) => {
  if (!name) return '❓';
  
  const lower = name.toLowerCase();
  
  if (lower.includes('apple')) return '🍎';
  if (lower.includes('banana')) return '🍌';
  if (lower.includes('bread')) return '🍞';
  if (lower.includes('milk')) return '🥛';
  
  return '🍽️'; // default
};

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

const UNIT_OPTIONS = [
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

// Image validation helper
const validateImageUrl = async (url) => {
  if (!url) return false;
  
  try {
    const response = await fetch(url, { 
      method: 'HEAD'
    });
    
    const contentLength = response.headers.get('content-length');
    const contentType = response.headers.get('content-type');
    
    return response.ok && 
           contentLength && 
           parseInt(contentLength) > 0 && 
           contentType && 
           contentType.startsWith('image/');
  } catch (error) {
    console.log('Image validation failed:', error);
    return false;
  }
};

// Image component with fallback
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
  
  useEffect(() => {
    setCurrentImageUrl(imageUrl);
    setHasError(false);
  }, [imageUrl]);

  const handleImageError = (error) => {
    console.log('Image error for:', currentImageUrl, error);
    setHasError(true);
    onImageError && onImageError(error);
  };

  if (currentImageUrl && !hasError) {
    return (
      <Image
        source={{ uri: currentImageUrl }}
        style={style}
        onError={handleImageError}
        {...props}
      />
    );
  }

  if (localImage) {
    return (
      <Image
        source={localImage}
        style={style}
        {...props}
      />
    );
  }

  return (
    <View style={[style, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }]}>
      <Text style={{ fontSize: style.width ? style.width * 0.4 : 80 }}>
        {getItemEmoji(itemName)}
      </Text>
    </View>
  );
};

const FoodDetailsScreen = ({ route, navigation }) => {
  const { foodItem, expirationStatus } = route.params;
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isDiscardModalVisible, setIsDiscardModalVisible] = useState(false);
  const [isUnitDropdownVisible, setIsUnitDropdownVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState(foodItem);
  const [editedItem, setEditedItem] = useState({
    item_name: foodItem.item_name,
    quantity: foodItem.quantity || '1',
    unit: foodItem.quantity_unit || 'pieces',
    expiration_date: foodItem.expiration_date || '',
    description: foodItem.description || '',
    image_url: foodItem.image_url || ''
  });
  const [userId, setUserId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  const quantityInputRef = useRef(null);
  const expirationInputRef = useRef(null);
  const descriptionInputRef = useRef(null);
  const scrollViewRef = useRef(null);

  React.useEffect(() => {
    const getUserId = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) {
          setUserId(user.id);
        }
      } catch (error) {
        console.error('Error getting user:', error);
      }
    };
    getUserId();
  }, []);

  React.useEffect(() => {
    if (isEditModalVisible) {
      setEditedItem({
        item_name: currentItem.item_name,
        quantity: currentItem.quantity || '1',
        unit: currentItem.quantity_unit || 'pieces',
        expiration_date: currentItem.expiration_date || '',
        description: currentItem.description || '',
        image_url: currentItem.image_url || ''
      });
    }
  }, [isEditModalVisible, currentItem]);

  const isExpired = expirationStatus.status === 'expired';
  const isExpiring = expirationStatus.status === 'expiring';
  const localImage = foodImages[currentItem.item_name.toLowerCase()];

  const getItemEmoji = (itemName) => {
    const emojiMap = {
      'apple': '🍎',
      'banana': '🍌',
      'bread': '🍞',
      'milk': '🥛',
      'eggs': '🥚',
      'cheese': '🧀',
      'tomato': '🍅',
      'potato': '🥔',
      'carrot': '🥕',
      'chicken': '🍗',
      'fish': '🐟',
      'rice': '🍚',
      'pasta': '🍝',
      'avocado': '🥑',
    };
    return emojiMap[itemName.toLowerCase()] || '🍽️';
  };

  const deleteOldFoodImage = async (imageUrl) => {
    if (!imageUrl) return;

    try {
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0];
      const filePath = `${fileName}`;

      const { error } = await supabase.storage
        .from('pantry-item-images')
        .remove([filePath]);

      if (error) {
        console.log('Error deleting old food image:', error);
      }
    } catch (error) {
      console.log('Error in deleteOldFoodImage:', error);
    }
  };
  

  const uploadFoodItemImage = async (imageUri) => {
  return await uploadFoodImage(imageUri, userId);
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
        options
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
          }
        }
      ]
    );
  };

  const openCamera = () => {
    setIsEditModalVisible(false);
    navigation.navigate('Camera', {
      onPhotoTaken: (uri) => {
        // Set local URI first for immediate display
        setEditedItem(prev => ({
          ...prev,
          image_url: uri
        }));
        
        // Then upload and update with the public URL
        handleImageSelection({ uri });
        setIsEditModalVisible(true);
      }
    });
  };

  const openImageLibrary = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1000,
      maxHeight: 1000,
    };

    launchImageLibrary(options, (response) => {
      if (response.assets && response.assets[0]) {
        handleImageSelection(response.assets[0]);
      }
    });
  };

  const handleImageSelection = async (imageAsset) => {
    setIsUploadingImage(true);
    try {
      // First validate the local image
      if (!imageAsset.uri) {
        throw new Error('No image selected');
      }

      // Set a temporary local image for immediate feedback
      updateEditedItem('image_url', imageAsset.uri);

      const publicUrl = await uploadFoodItemImage(imageAsset.uri);
      
      // Delete old image if it exists
      if (currentItem.image_url && currentItem.image_url !== imageAsset.uri) {
        await deleteOldFoodImage(currentItem.image_url);
      }

      // Update with the new public URL
      updateEditedItem('image_url', publicUrl);
      
      Alert.alert('Success', 'Image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      // Revert to original image on error
      updateEditedItem('image_url', currentItem.image_url || '');
      Alert.alert('Error', error.message || 'Failed to upload image. Please try again.');
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

              const { error } = await supabase
                .from('pantry_items')
                .delete()
                .eq('id', item.id)
                .eq('user_id', userId);

              if (error) throw error;

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
      navigation.navigate('Share', {
        itemToShare: item,
        fromScreen: 'FoodDetails',
        initialTab: 'mypantry'
      });
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
    navigation.goBack();
  };

  const updateEditedItem = useCallback((field, value) => {
    console.log(`Updating ${field} to:`, value);
    setEditedItem(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleSaveEdit = async () => {
    if (!editedItem.item_name.trim()) {
      Alert.alert('Error', 'Item name cannot be empty');
      return;
    }

    if (!editedItem.quantity.trim() || isNaN(editedItem.quantity) || parseFloat(editedItem.quantity) <= 0) {
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
        quantity: editedItem.quantity.trim(),
        quantity_unit: editedItem.unit.trim(),
        expiration_date: editedItem.expiration_date.trim() || null,
        description: editedItem.description.trim(),
        image_url: editedItem.image_url.trim() || null
      };

      const { error } = await supabase
        .from('pantry_items')
        .update(updatedItem)
        .eq('id', currentItem.id)
        .eq('user_id', userId);

      if (error) throw error;

      const newCurrentItem = {
        ...currentItem,
        ...updatedItem
      };
      setCurrentItem(newCurrentItem);
      
      setIsEditModalVisible(false);

      setTimeout(() => {
        Alert.alert('Success', 'Item updated successfully!');
      }, 300);

    } catch (error) {
      console.error('Error updating item:', error);
      Alert.alert('Error', 'Failed to update item. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
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
            <TouchableOpacity onPress={handleSaveEdit} disabled={isSaving}>
              <Text style={[styles.modalSaveButton, isSaving && { opacity: 0.5 }]}>
                {isSaving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={styles.modalContent} 
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Improved Image Section */}
            <View style={styles.imageEditSection}>
              <TouchableOpacity 
                style={styles.imageEditContainer}
                onPress={handleImagePicker}
                disabled={isUploadingImage}
              >
                <ImageWithFallback
                  imageUrl={editedItem.image_url}
                  localImage={localImage}
                  itemName={editedItem.item_name}
                  style={styles.editImage}
                  onImageError={() => {
                    updateEditedItem('image_url', '');
                  }}
                  resizeMode="cover"
                />
                
                {/* Overlay for adding/changing image */}
                <View style={styles.imageEditOverlay}>
                  <Text style={styles.editImageIcon}>📷</Text>
                  <Text style={styles.editImageText}>
                    {isUploadingImage ? 'Uploading...' : editedItem.image_url ? 'Change Photo' : 'Add Photo'}
                  </Text>
                </View>
                
                {isUploadingImage && (
                  <View style={styles.uploadingOverlay}>
                    <Text style={styles.uploadingText}>Uploading...</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Form Inputs */}
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
                  onChangeText={(text) => updateEditedItem('quantity', text)}
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

            {/* Extra space for keyboard */}
            <View style={{ height: 100 }} />
          </ScrollView>

          {isUnitDropdownVisible && <UnitDropdown />}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.bookmarkButton}
              onPress={() => setIsEditModalVisible(true)}
            >
              <Text style={styles.bookmarkButtonText}>✏️</Text>
            </TouchableOpacity>
          </View>

          {/* Improved Image Section */}
          <View style={styles.imageSection}>
            <View style={styles.imageContainer}>
              <ImageWithFallback
                imageUrl={currentItem.image_url}
                localImage={localImage}
                itemName={currentItem.item_name}
                style={styles.foodImage}
                onImageError={() => {
                  setCurrentItem(prev => ({
                    ...prev,
                    image_url: ''
                  }));
                }}
                resizeMode="cover"
              />
            </View>
          </View>

          {/* Status Badge */}
          <View style={styles.statusBadge}>
            <View style={[
              styles.statusDot,
              isExpired && styles.statusDotExpired,
              isExpiring && styles.statusDotExpiring
            ]} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.titleSection}>
                <Text style={styles.title}>{currentItem.item_name}</Text>
                <View style={styles.ratingContainer}>
                  <Text style={styles.rating}>★ 4.5</Text>
                  <Text style={styles.ratingCount}>({currentItem.quantity || '1'} {currentItem.quantity_unit || 'pieces'})</Text>
                </View>
              </View>

              <Text style={styles.subtitle}>Details</Text>
              <Text style={styles.description}>
                {currentItem.description || 'A fresh ingredient for your meals.'}
              </Text>

              {/* Info Icons */}
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoIcon}>📦</Text>
                  <Text style={styles.infoText}>{currentItem.quantity || '1'} {currentItem.quantity_unit || 'pieces'}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoIcon}>📅</Text>
                  <Text style={styles.infoText}>{formatDate(currentItem.expiration_date) || 'No expiry'}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoIcon}>
                    {isExpired ? '⚠️' : isExpiring ? '⏰' : '✅'}
                  </Text>
                  <Text style={[
                    styles.infoText,
                    isExpired && { color: '#F44336' },
                    isExpiring && { color: '#FFA000' }
                  ]}>
                    {isExpired ? 'Expired' : isExpiring ? 'Expiring' : 'Fresh'}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleShare(currentItem)}
                >
                  <Text style={styles.actionButtonText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => handleDiscard(currentItem)}
                >
                  <Text style={styles.actionButtonText}>Discard</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDelete(currentItem)}
                >
                  <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>

        <EditModal />
        
        {userId && currentItem?.id && (
          <DiscardItemModal
            visible={isDiscardModalVisible}
            onClose={() => setIsDiscardModalVisible(false)}
            itemId={currentItem.id}
            userId={userId}
            onDiscardComplete={handleDiscardComplete}
          />
        )}
      </View>
    </ErrorBoundary>
  );
};

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('FoodDetails error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Something went wrong. Please try again.</Text>
        </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  bookmarkButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookmarkButtonText: {
    fontSize: 18,
    color: '#333',
  },
  imageSection: {
    alignItems: 'center',
    marginTop: -10,
    marginBottom: 20,
  },
  imageContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    right: width * 0.3,
    top: height * 0.25,
    zIndex: 10,
  },
  statusDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  statusDotExpiring: {
    backgroundColor: '#FFA000',
  },
  statusDotExpired: {
    backgroundColor: '#F44336',
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: 10,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 25,
    paddingTop: 30,
  },
  titleSection: {
    marginBottom: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rating: {
    fontSize: 16,
    color: '#ff6b35',
    fontWeight: '600',
  },
  ratingCount: {
    fontSize: 14,
    color: '#666',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 35,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 30,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  deleteButton: {
    backgroundColor: '#ffebee',
  },
  deleteButtonText: {
    color: '#f44336',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCancelButton: {
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalSaveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  modalContent: {
    padding: 20,
    paddingBottom: 50,
  },
  imageEditSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  imageEditContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  editImage: {
    width: '100%',
    height: '100%',
  },
  imageEditOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  editImageIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  editImageText: {
    fontSize: 10,
    color: '#fff',
  },
  uploadingOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: '#fff',
    fontSize: 14,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  inputGroupHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: '#333',
  },
  textInputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  unitSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 15,
  },
  unitSelectorText: {
    fontSize: 16,
    color: '#333',
  },
  unitSelectorArrow: {
    fontSize: 12,
    color: '#666',
  },
  // Dropdown styles
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    width: '80%',
    maxHeight: '60%',
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
  },
  dropdownScrollView: {
    maxHeight: '100%',
  },
  dropdownItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemSelected: {
    backgroundColor: '#f5f5f5',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownItemTextSelected: {
    color: '#4CAF50',
    fontWeight: '600',
  },
});

export default FoodDetailsScreen;