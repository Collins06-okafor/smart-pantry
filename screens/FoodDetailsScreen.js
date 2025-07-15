import React, { useState, useCallback, useRef } from 'react';
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
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { supabase } from '../lib/supabase';
import DiscardItemModal from './DiscardItemModal';

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
    description: foodItem.description || ''
  });
  const [userId, setUserId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Refs for input navigation
  const quantityInputRef = useRef(null);
  const expirationInputRef = useRef(null);
  const descriptionInputRef = useRef(null);

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

  // Reset edited item when modal opens
  React.useEffect(() => {
    if (isEditModalVisible) {
      setEditedItem({
        item_name: currentItem.item_name,
        quantity: currentItem.quantity || '1',
        unit: currentItem.quantity_unit || 'pieces',
        expiration_date: currentItem.expiration_date || '',
        description: currentItem.description || ''
      });
    }
  }, [isEditModalVisible, currentItem]);

  const isExpired = expirationStatus.status === 'expired';
  const isExpiring = expirationStatus.status === 'expiring';
  const localImage = foodImages[currentItem.item_name.toLowerCase()];
  const hasUserImage = currentItem.image_url && currentItem.image_url.length > 0;

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

  const handleQuickShare = async (item) => {
    try {
      const expirationText = item.expiration_date ? 
        `Expires: ${formatDate(item.expiration_date)}` : 
        'No expiration date set';
      
      const shareMessage = `🍽️ ${item.item_name} (${item.quantity || '1'} ${item.unit || 'pieces'})
${expirationText}
${item.description ? `\n"${item.description}"` : ''}

Shared from my Smart Pantry app!`;
      
      const result = await Share.share({
        message: shareMessage,
        title: `${item.item_name} from My Pantry`,
        ...(Platform.OS === 'ios' && { url: 'https://yourapp.com' })
      });

      if (result.action === Share.sharedAction) {
        Alert.alert('Success', 'Item shared successfully!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Could not share the item. Please try again.');
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

  // Use useCallback to prevent unnecessary re-renders
  const updateEditedItem = useCallback((field, value) => {
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
        description: editedItem.description.trim()
      };

      const { error } = await supabase
        .from('pantry_items')
        .update(updatedItem)
        .eq('id', currentItem.id)
        .eq('user_id', userId);

      if (error) throw error;

      setCurrentItem({
        ...currentItem,
        ...updatedItem
      });
      
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
  >
    <SafeAreaView style={styles.modalContainer}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            
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

            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
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
                />
              </View>

            </ScrollView>

            {isUnitDropdownVisible && <UnitDropdown />}
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>
);


  return (
    <SafeAreaView style={styles.detailsContainer}>
      <ScrollView>
        <View style={styles.detailsImageContainer}>
          {hasUserImage ? (
            <Image 
              source={{ uri: currentItem.image_url }} 
              style={styles.detailsImage}
              resizeMode="cover"
            />
          ) : localImage ? (
            <Image 
              source={localImage} 
              style={styles.detailsImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.defaultImageContainer}>
              <Text style={styles.detailsFoodIcon}>{getItemEmoji(currentItem.item_name)}</Text>
            </View>
          )}
        </View>

        <View style={styles.detailsContent}>
          <Text style={styles.detailsName}>{currentItem.item_name}</Text>
          
          <View style={styles.detailsMeta}>
            <Text style={styles.detailsQuantity}>
              {currentItem.quantity || '1'} {currentItem.quantity_unit || 'pieces'}
            </Text>
            <Text style={styles.detailsExpiration}>
              Expires: {formatDate(currentItem.expiration_date) || 'Not set'}
            </Text>
          </View>
          
          <Text style={styles.detailsDescription}>
            {currentItem.description || 'No description available.'}
          </Text>
          
          <View style={styles.detailsInfoRow}>
            <Text style={[
              styles.detailsStatus,
              isExpired && styles.statusExpired,
              isExpiring && styles.statusExpiring
            ]}>
              {isExpired ? 'Expired' : isExpiring ? 'Expiring Soon' : 'Fresh'}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.editButton,
              isExpired && styles.editButtonExpired,
              isExpiring && styles.editButtonExpiring
            ]}
            onPress={() => setIsEditModalVisible(true)}
          >
            <Text style={styles.editButtonText}>✏️ Edit Item</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      
      <View style={styles.detailsActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDelete(currentItem)}
        >
          <Text style={styles.actionIcon}>🗑️</Text>
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleShare(currentItem)}
        >
          <Text style={styles.actionIcon}>📤</Text>
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleDiscard(currentItem)}
        >
          <Text style={styles.actionIcon}>♻️</Text>
          <Text style={styles.actionText}>Discard</Text>
        </TouchableOpacity>
      </View>

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  detailsContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  detailsImageContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsImage: {
    width: '100%',
    height: '100%',
  },
  defaultImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  detailsFoodIcon: {
    fontSize: 100,
  },
  detailsContent: {
    padding: 20,
  },
  detailsName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  detailsMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailsQuantity: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  detailsExpiration: {
    fontSize: 14,
    color: '#666',
  },
  detailsDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 22,
    marginBottom: 25,
  },
  detailsInfoRow: {
    marginBottom: 30,
  },
  detailsStatus: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
    textAlign: 'center',
    padding: 10,
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
  },
  statusExpiring: {
    color: '#FFA000',
    backgroundColor: '#FFF3E0',
  },
  statusExpired: {
    color: '#F44336',
    backgroundColor: '#FFEBEE',
  },
  editButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  editButtonExpiring: {
    backgroundColor: '#FFA000',
  },
  editButtonExpired: {
    backgroundColor: '#F44336',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  detailsActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionButton: {
    alignItems: 'center',
    padding: 10,
  },
  actionIcon: {
    fontSize: 20,
    marginBottom: 5,
  },
  actionText: {
    fontSize: 12,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalCancelButton: {
    fontSize: 16,
    color: '#666',
  },
  modalSaveButton: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputGroupHalf: {
    width: '48%',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  textInputMultiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    color: '#666',
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
    color: '#666',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    maxHeight: 300,
    width: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  dropdownScrollView: {
    maxHeight: 300,
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownItemSelected: {
    backgroundColor: '#E3F2FD',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownItemTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
});

export default FoodDetailsScreen;