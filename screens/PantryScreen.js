import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DiscardItemModal from './DiscardItemModal';
import { supabase } from '../lib/supabase';

export default function PantryScreen({ navigation }) {
  const [pantryItems, setPantryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    item_name: '',
    quantity: '',
    expiration_date: '',
  });

  // Share Modal State
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedItemForShare, setSelectedItemForShare] = useState(null);

  const [discardModalVisible, setDiscardModalVisible] = useState(false);
  const [selectedItemForDiscard, setSelectedItemForDiscard] = useState(null);

  const [discardStats, setDiscardStats] = useState([]);

  useEffect(() => {
    initializeScreen();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPantryItems();
    }, [])
  );

  const initializeScreen = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user) {
        await fetchPantryItems();
        await fetchDiscardedItemsStats();
      }
    } catch (error) {
      console.error('Error initializing screen:', error);
    }
  };

  const fetchPantryItems = async () => {
    if (!refreshing) setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setPantryItems([]);
        return;
      }

      const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', user.id)
        .order('expiration_date', { ascending: true });

      if (error) {
        console.error('Fetch error:', error.message);
        setPantryItems([]);
      } else {
        const validItems = Array.isArray(data)
          ? data.filter(item => item && item.item_name)
          : [];
        setPantryItems(validItems);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setPantryItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPantryItems();
  }, []);

  const handleDelete = (item) => {
    Alert.alert(
      "Delete Item",
      `Are you sure you want to delete "${item.item_name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteItem(item.id),
        },
      ]
    );
  };

  const deleteItem = async (itemId) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      const { error } = await supabase
        .from('pantry_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) {
        Alert.alert("Error", `Failed to delete item: ${error.message}`);
      } else {
        Alert.alert("Success", "Item deleted successfully");
        await fetchPantryItems();
      }
    } catch (err) {
      console.error('Delete error:', err);
      Alert.alert("Error", "An unexpected error occurred.");
    }
  };

  const fetchDiscardedItemsStats = async () => {
    if (!currentUser?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('discarded_items')
        .select('reason, timestamp, item_name, quantity')
        .eq('user_id', currentUser.id)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Discard fetch error:', error.message);
        setDiscardStats([]);
      } else {
        setDiscardStats(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching discard stats:', err);
      setDiscardStats([]);
    }
  };

  const handleDiscard = (item) => {
    setSelectedItemForDiscard(item);
    setDiscardModalVisible(true);
  };

  const handleEdit = (item) => {
    setEditForm({
      id: item.id,
      item_name: item.item_name || '',
      quantity: String(item.quantity || ''),
      expiration_date: item.expiration_date || '',
    });
    setEditModalVisible(true);
  };

  const cancelEdit = () => {
    setEditModalVisible(false);
    setEditForm({ id: null, item_name: '', quantity: '', expiration_date: '' });
  };

  const saveEdit = async () => {
    if (!editForm.item_name.trim() || !editForm.quantity.trim() || !editForm.expiration_date.trim()) {
      Alert.alert("Missing Fields", "Please fill in all fields.");
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(editForm.expiration_date)) {
      Alert.alert("Invalid Date", "Please use YYYY-MM-DD format for the expiration date.");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        Alert.alert("Error", "User not authenticated");
        return;
      }

      const updateData = {
        item_name: editForm.item_name.trim(),
        quantity: parseInt(editForm.quantity) || 0,
        expiration_date: editForm.expiration_date,
      };

      const { error } = await supabase
        .from('pantry_items')
        .update(updateData)
        .eq('id', editForm.id)
        .eq('user_id', user.id);

      if (error) {
        Alert.alert("Error", `Failed to update item: ${error.message}`);
      } else {
        Alert.alert("Success", "Item updated successfully");
        await fetchPantryItems();
        cancelEdit();
      }
    } catch (err) {
      console.error('Update error:', err);
      Alert.alert("Error", "An unexpected error occurred.");
    }
  };

  const handleShare = (item) => {
    setSelectedItemForShare(item);
    setShareModalVisible(true);
  };

  const shareItem = async () => {
    if (!currentUser || !selectedItemForShare) return;
    
    try {
      const { data: existingShare, error: checkError } = await supabase
        .from('shared_items')
        .select('id')
        .eq('item_id', selectedItemForShare.id)
        .eq('user_id', currentUser.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingShare) {
        Alert.alert("Already Shared", "This item is already being shared.");
        setShareModalVisible(false);
        return;
      }

      const { error } = await supabase
        .from('shared_items')
        .insert({
          item_id: selectedItemForShare.id,
          user_id: currentUser.id,
          status: 'available',
          offered_at: new Date().toISOString()
        });

      if (error) {
        Alert.alert('Error', `Failed to share item: ${error.message}`);
      } else {
        Alert.alert('Success', 'Item shared with your neighbors!');
        setShareModalVisible(false);
        setSelectedItemForShare(null);
      }
    } catch (err) {
      console.error('Share error:', err);
      Alert.alert('Error', 'An unexpected error occurred while sharing the item.');
    }
  };

  const cancelShare = () => {
    setShareModalVisible(false);
    setSelectedItemForShare(null);
  };

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
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const renderItem = ({ item }) => {
    const expirationStatus = getExpirationStatus(item.expiration_date);
    const isExpired = expirationStatus.status === 'expired';
    const isExpiring = expirationStatus.status === 'expiring';

    return (
      <View style={[
        styles.item,
        isExpired && styles.itemExpired,
        isExpiring && styles.itemExpiring
      ]}>
        <View style={styles.itemContent}>
          <Text style={styles.name}>{item.item_name}</Text>
          <Text style={styles.detail}>Quantity: {item.quantity}</Text>
          <Text style={[
            styles.detail,
            isExpired && styles.expiredText,
            isExpiring && styles.expiringText
          ]}>
            Expires: {formatDate(item.expiration_date)}
          </Text>
          {isExpired && (
            <Text style={styles.expiredWarning}>❌ Expired {expirationStatus.days} days ago</Text>
          )}
          {isExpiring && (
            <Text style={styles.warningText}>⚠️ Expires in {expirationStatus.days} day(s)</Text>
          )}
        </View>
        
        <View style={styles.itemActions}>
          <TouchableOpacity
            style={[styles.deleteButton, { backgroundColor: '#888' }]}
            onPress={() => handleDiscard(item)}
          >
            <Text style={styles.deleteButtonText}>♻️</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.shareButton} 
            onPress={() => handleShare(item)}
          >
            <Text style={styles.shareButtonText}>📤</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => handleEdit(item)}
          >
            <Text style={styles.editButtonText}>✏️</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.deleteButton} 
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>My Pantry</Text>
      <Text style={styles.subtitle}>
        {pantryItems.length} {pantryItems.length === 1 ? 'item' : 'items'}
      </Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🥫</Text>
      <Text style={styles.emptyTitle}>Your pantry is empty</Text>
      <Text style={styles.emptyText}>Start adding items to track your food inventory</Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddItem')}
      >
        <Text style={styles.addButtonText}>➕ Add First Item</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDiscardAnalytics = () => {
    if (discardStats.length === 0) return null;

    const reasonCounts = discardStats.reduce((acc, item) => {
      const reason = item.reason || 'No reason given';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

    const topReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return (
      <View style={styles.discardAnalytics}>
        <Text style={styles.discardTitle}>♻️ Discard Analytics</Text>
        <View style={styles.discardStats}>
          <Text style={styles.discardStat}>
            Total Discarded: <Text style={styles.statValue}>{discardStats.length}</Text>
          </Text>
          <Text style={styles.discardStat}>
            Last Discarded: <Text style={styles.statValue}>{formatDate(discardStats[0]?.timestamp)}</Text>
          </Text>
        </View>

        <Text style={styles.reasonsTitle}>Top Discard Reasons:</Text>
        {topReasons.map(([reason, count], index) => (
          <Text key={index} style={styles.reasonItem}>
            • {reason} ({count} time{count > 1 ? 's' : ''})
          </Text>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00C897" />
          <Text style={styles.loadingText}>Loading your pantry...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      
      {pantryItems.length === 0 ? (
        renderEmptyState()
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.contentContainer}>
              <FlatList
                data={pantryItems}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
                ListHeaderComponent={renderHeader}
                contentContainerStyle={styles.listContainer}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={['#00C897']}
                    tintColor="#00C897"
                  />
                }
                showsVerticalScrollIndicator={false}
              />
              
              {renderDiscardAnalytics()}
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}

      {/* Discard Modal */}
      <DiscardItemModal
        visible={discardModalVisible}
        onClose={() => {
          setDiscardModalVisible(false);
          setSelectedItemForDiscard(null);
        }}
        itemId={selectedItemForDiscard?.id}
        userId={currentUser?.id}
        onDiscardComplete={() => {
          fetchPantryItems();
          fetchDiscardedItemsStats();
          setDiscardModalVisible(false);
          setSelectedItemForDiscard(null);
        }}
      />

      {/* Edit Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={editModalVisible}
        onRequestClose={cancelEdit}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKeyboardAvoidingView}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Edit Item</Text>

                <Text style={styles.label}>Item Name</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.item_name}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, item_name: text }))}
                  placeholder="Enter item name"
                />

                <Text style={styles.label}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.quantity}
                  keyboardType="numeric"
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, quantity: text }))}
                  placeholder="Enter quantity"
                />

                <Text style={styles.label}>Expiration Date</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.expiration_date}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, expiration_date: text }))}
                  placeholder="YYYY-MM-DD"
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={cancelEdit}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveButton} onPress={saveEdit}>
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Share Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={shareModalVisible}
        onRequestClose={cancelShare}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalKeyboardAvoidingView}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Share Item</Text>
                
                {selectedItemForShare && (
                  <View style={styles.shareItemPreview}>
                    <Text style={styles.shareItemName}>{selectedItemForShare.item_name}</Text>
                    <Text style={styles.shareItemDetail}>Quantity: {selectedItemForShare.quantity}</Text>
                    <Text style={styles.shareItemDetail}>
                      Expires: {formatDate(selectedItemForShare.expiration_date)}
                    </Text>
                  </View>
                )}

                <Text style={styles.shareDescription}>
                  Share this item with your neighbors. They'll be able to see and request it.
                </Text>

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.cancelButton} onPress={cancelShare}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.shareConfirmButton} onPress={shareItem}>
                    <Text style={styles.shareConfirmButtonText}>📤 Share Item</Text>
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
    backgroundColor: '#f5f5f5',
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
  },
  modalKeyboardAvoidingView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  item: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#00C897',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemExpiring: {
    backgroundColor: '#fff8e1',
    borderLeftColor: '#ff9800',
  },
  itemExpired: {
    backgroundColor: '#ffebee',
    borderLeftColor: '#f44336',
  },
  itemContent: {
    flex: 1,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  detail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  expiringText: {
    color: '#ff9800',
    fontWeight: '600',
  },
  expiredText: {
    color: '#f44336',
    fontWeight: '600',
  },
  warningText: {
    fontSize: 12,
    color: '#ff9800',
    fontWeight: 'bold',
    marginTop: 4,
  },
  expiredWarning: {
    fontSize: 12,
    color: '#f44336',
    fontWeight: 'bold',
    marginTop: 4,
  },
  shareButton: {
    backgroundColor: '#00C897',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  shareButtonText: {
    fontSize: 16,
  },
  editButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editButtonText: {
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  addButton: {
    backgroundColor: '#00C897',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 25,
    shadowColor: '#00C897',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#f44336',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 1,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#00C897',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 1,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  shareItemPreview: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  shareItemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  shareItemDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  shareDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 10,
  },
  shareConfirmButton: {
    backgroundColor: '#00C897',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 1,
  },
  shareConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  discardStats: {
    marginBottom: 12,
  },
  discardStat: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontWeight: 'bold',
    color: '#333',
  },
  reasonsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  reasonItem: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  discardAnalytics: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  discardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
});