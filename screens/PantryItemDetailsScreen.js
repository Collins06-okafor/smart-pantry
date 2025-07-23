import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  ScrollView
} from 'react-native';
import { supabase } from '../lib/supabase';

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

const image_url = {
  'apple': require('../assets/images/apple.png'),
  'banana': require('../assets/images/banana.png'),
  'bread': require('../assets/images/bread.png'),
  'milk': require('../assets/images/milk.png'),
  'eggs': require('../assets/images/eggs.png'),
  'egg': require('../assets/images/eggs.png'),
  'cheese': require('../assets/images/cheese.png'),
  'tomato': require('../assets/images/tomato.png'),
  'tomatoes': require('../assets/images/tomato.png'),
  'potato': require('../assets/images/potato.png'),
  'carrot': require('../assets/images/carrot.png'),
  'chicken': require('../assets/images/chicken.png'),
  'fish': require('../assets/images/fish.png'),
  'rice': require('../assets/images/rice.png'),
  'pasta': require('../assets/images/pasta.png'),
  'avocado': require('../assets/images/avocado.png'),
};

export default function PantryItemDetailsScreen({ route, navigation }) {
  const { item, onItemUpdated, onItemDeleted, onItemDiscarded } = route.params;
  
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [editForm, setEditForm] = useState({
    id: item.id,
    item_name: item.item_name,
    quantity: item.quantity?.toString() || '',
    unit: item.unit || 'pieces',
    expiration_date: item.expiration_date || '',
  });
  const [loading, setLoading] = useState(false);

  const getExpirationStatus = (dateString) => {
    try {
      const expiration = new Date(dateString);
      const today = new Date();
      const diffTime = expiration - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return { status: 'expired', days: Math.abs(diffDays) };
      if (diffDays <= 3) return { status: 'expiring', days: diffDays };
      return { status: 'fresh', days: diffDays };
    } catch {
      return { status: 'unknown', days: 0 };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date)) return dateString;
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const getItemEmoji = (itemName) => {
    const name = itemName.toLowerCase();
    if (name.includes('apple')) return '🍎';
    if (name.includes('banana')) return '🍌';
    if (name.includes('bread')) return '🍞';
    if (name.includes('milk')) return '🥛';
    if (name.includes('egg')) return '🥚';
    if (name.includes('cheese')) return '🧀';
    if (name.includes('tomato')) return '🍅';
    if (name.includes('potato')) return '🥔';
    if (name.includes('carrot')) return '🥕';
    if (name.includes('meat') || name.includes('chicken')) return '🍗';
    if (name.includes('fish')) return '🐟';
    if (name.includes('rice')) return '🍚';
    if (name.includes('pasta')) return '🍝';
    if (name.includes('flour')) return '🧂';
    if (name.includes('avocado')) return '🥑';
    if (name.includes('salad')) return '🥗';
    if (name.includes('noodles')) return '🍜';
    if (name.includes('toast')) return '🍞';
    return '🥫';
  };

  const handleEdit = async () => {
    if (!editForm.item_name.trim()) {
      Alert.alert('Error', 'Item name is required');
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        item_name: editForm.item_name.trim(),
        quantity: editForm.quantity ? parseInt(editForm.quantity) : null,
        unit: editForm.unit,
        expiration_date: editForm.expiration_date || null,
      };

      const { data, error } = await supabase
        .from('pantry_items')
        .update(updateData)
        .eq('id', item.id)
        .select()
        .single();

      if (error) {
        console.error('Update error:', error);
        Alert.alert('Error', `Failed to update item: ${error.message}`);
        return;
      }

      if (onItemUpdated) {
        onItemUpdated(data);
      }

      setEditModalVisible(false);
      Alert.alert('Success', 'Item updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.item_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { error: sharedError } = await supabase
                .from('shared_items')
                .delete()
                .eq('item_link', item.id);

              if (sharedError) {
                console.error('Error deleting shared references:', sharedError);
              }

              const { error } = await supabase
                .from('pantry_items')
                .delete()
                .eq('id', item.id);

              if (error) {
                console.error('Delete error:', error);
                Alert.alert('Error', `Failed to delete item: ${error.message}`);
                return;
              }

              if (onItemDeleted) {
                onItemDeleted(item.id);
              }

              Alert.alert('Success', 'Item deleted successfully', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              console.error('Unexpected error:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDiscard = () => {
    Alert.alert(
      'Discard Item',
      `Are you sure you want to discard "${item.item_name}"? This action will remove it from your pantry.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { error: sharedError } = await supabase
                .from('shared_items')
                .delete()
                .eq('item_link', item.id);

              if (sharedError) {
                console.error('Error deleting shared references:', sharedError);
              }
              
              const { error } = await supabase
                .from('pantry_items')
                .delete()
                .eq('id', item.id);

              if (error) {
                console.error('Discard error:', error);
                Alert.alert('Error', `Failed to discard item: ${error.message}`);
                return;
              }

              if (onItemDiscarded) {
                onItemDiscarded(item.id);
              }

              Alert.alert('Success', 'Item discarded successfully', [
                { text: 'OK', onPress: () => navigation.goBack() }
              ]);
            } catch (error) {
              console.error('Unexpected error:', error);
              Alert.alert('Error', 'An unexpected error occurred');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const expirationStatus = getExpirationStatus(item.expiration_date);
  const isExpired = expirationStatus.status === 'expired';
  const isExpiring = expirationStatus.status === 'expiring';

  const itemKey = Object.keys(image_url).find(key =>
    key.toLowerCase() === item.item_name.toLowerCase()
  );
  const hasDefaultImage = itemKey && image_url[itemKey];
  
  const hasValidImageUrl = item.image_url &&
    typeof item.image_url === 'string' &&
    item.image_url.trim() !== '' &&
    item.image_url !== 'NULL' &&
    item.image_url !== 'null' &&
    !item.image_url.includes('undefined') &&
    (item.image_url.startsWith('http://') || item.image_url.startsWith('https://'));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Item Details</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Item Image */}
        <View style={styles.imageContainer}>
          {hasValidImageUrl ? (
            <Image
              source={{ uri: item.image_url }}
              style={styles.itemImage}
              resizeMode="cover"
            />
          ) : hasDefaultImage ? (
            <Image
              source={image_url[itemKey]}
              style={styles.itemImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.emojiContainer}>
              <Text style={styles.itemEmoji}>{getItemEmoji(item.item_name)}</Text>
            </View>
          )}

          {/* Status Badge */}
          {isExpired && (
            <View style={[styles.statusBadge, styles.expiredBadge]}>
              <Text style={styles.statusText}>EXPIRED</Text>
            </View>
          )}
          {isExpiring && !isExpired && (
            <View style={[styles.statusBadge, styles.expiringBadge]}>
              <Text style={styles.statusText}>EXPIRING SOON</Text>
            </View>
          )}
        </View>

        {/* Item Details */}
        <View style={styles.detailsContainer}>
          <Text style={styles.itemName}>{item.item_name}</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Quantity:</Text>
            <Text style={styles.infoValue}>
              {item.quantity ? `${item.quantity} ${item.unit || 'pieces'}` : 'N/A'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Expiration Date:</Text>
            <Text style={[
              styles.infoValue,
              isExpired && styles.expiredText,
              isExpiring && styles.expiringText
            ]}>
              {formatDate(item.expiration_date)}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status:</Text>
            <Text style={[
              styles.infoValue,
              isExpired && styles.expiredText,
              isExpiring && styles.expiringText
            ]}>
              {expirationStatus.status === 'expired' 
                ? `Expired ${expirationStatus.days} days ago`
                : expirationStatus.status === 'expiring'
                ? `Expires in ${expirationStatus.days} days`
                : `Fresh (${expirationStatus.days} days remaining)`
              }
            </Text>
          </View>

          {item.added_date && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Added:</Text>
              <Text style={styles.infoValue}>{formatDate(item.added_date)}</Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => setEditModalVisible(true)}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>✏️ Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.discardButton]}
            onPress={handleDiscard}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>🗑️ Discard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>❌ Delete</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Edit Item</Text>

                <Text style={styles.inputLabel}>Item Name</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.item_name}
                  onChangeText={(text) => setEditForm({ ...editForm, item_name: text })}
                  placeholder="Enter item name"
                />

                <Text style={styles.inputLabel}>Quantity</Text>
                <View style={styles.quantityContainer}>
                  <TextInput
                    style={[styles.input, styles.quantityInput]}
                    value={editForm.quantity}
                    onChangeText={(text) => setEditForm({ ...editForm, quantity: text })}
                    placeholder="Enter quantity"
                    keyboardType="numeric"
                  />
                  <TouchableOpacity 
                    style={styles.unitSelector}
                    onPress={() => setShowUnitDropdown(!showUnitDropdown)}
                  >
                    <Text style={styles.unitSelectorText}>{editForm.unit}</Text>
                    <Text style={styles.unitSelectorArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                {showUnitDropdown && (
                  <View style={styles.dropdownContainer}>
                    <ScrollView style={styles.dropdownScroll}>
                      {QUANTITY_UNITS.map((unit) => (
                        <TouchableOpacity
                          key={unit}
                          style={styles.dropdownItem}
                          onPress={() => {
                            setEditForm({ ...editForm, unit });
                            setShowUnitDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{unit}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <Text style={styles.inputLabel}>Expiration Date</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.expiration_date}
                  onChangeText={(text) => setEditForm({ ...editForm, expiration_date: text })}
                  placeholder="YYYY-MM-DD"
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setEditModalVisible(false)}
                    disabled={loading}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleEdit}
                    disabled={loading}
                  >
                    <Text style={styles.saveButtonText}>
                      {loading ? 'Saving...' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#4CAF50',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  imageContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#fff',
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  emojiContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  itemEmoji: {
    fontSize: 100,
  },
  statusBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  expiredBadge: {
    backgroundColor: '#f44336',
  },
  expiringBadge: {
    backgroundColor: '#ff9800',
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  detailsContainer: {
    backgroundColor: '#fff',
    padding: 20,
    margin: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  itemName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  expiredText: {
    color: '#f44336',
  },
  expiringText: {
    color: '#ff9800',
  },
  actionsContainer: {
    padding: 20,
    gap: 15,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  editButton: {
    backgroundColor: '#2196F3',
  },
  discardButton: {
    backgroundColor: '#ff9800',
  },
  deleteButton: {
    backgroundColor: '#f44336',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f9f9f9',
  },
  quantityInput: {
    flex: 2,
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    borderRadius: 0,
  },
  unitSelector: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    height: 50,
  },
  unitSelectorText: {
    fontSize: 16,
    color: '#333',
  },
  unitSelectorArrow: {
    fontSize: 12,
    color: '#666',
  },
  dropdownContainer: {
    position: 'absolute',
    top: 60,
    right: 0,
    width: '50%',
    maxHeight: 200,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    zIndex: 1000,
    elevation: 5,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
    gap: 15,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
    modalButtonText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
    
});