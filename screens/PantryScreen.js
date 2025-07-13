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
  TouchableWithoutFeedback,
  Dimensions,
  ScrollView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DiscardItemModal from './DiscardItemModal';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

export default function PantryScreen({ navigation }) {
  const [pantryItems, setPantryItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Filter items based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredItems(pantryItems);
    } else {
      const filtered = pantryItems.filter(item =>
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredItems(filtered);
    }
  }, [searchQuery, pantryItems]);

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
        setFilteredItems([]);
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
        setFilteredItems([]);
      } else {
        const validItems = Array.isArray(data)
          ? data.filter(item => item && item.item_name)
          : [];
        setPantryItems(validItems);
        setFilteredItems(validItems);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setPantryItems([]);
      setFilteredItems([]);
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
        month: 'short',
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
    return '🥫';
  };

  const renderGridItem = ({ item, index }) => {
  const expirationStatus = getExpirationStatus(item.expiration_date);
  const isExpired = expirationStatus.status === 'expired';
  const isExpiring = expirationStatus.status === 'expiring';
  const emoji = getItemEmoji(item.item_name);

  return (
    <TouchableOpacity 
      style={[
        styles.gridItem,
        isExpired && styles.gridItemExpired,
        isExpiring && styles.gridItemExpiring
      ]}
      onPress={() => handleEdit(item)}
      activeOpacity={0.7}
    >
      <View style={styles.gridItemContent}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemEmoji}>{emoji}</Text>
          <View style={styles.itemActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleShare(item)}
            >
              <Text style={styles.actionEmoji}>📤</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.discardButton]}
              onPress={() => handleDiscard(item)}
            >
              <Text style={styles.actionEmoji}>♻️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { marginLeft: 4 }]}
              onPress={() => handleDelete(item)}
            >
              <Text style={styles.actionEmoji}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.itemName} numberOfLines={2}>
          {item.item_name}
        </Text>
        
        <View style={styles.itemDetails}>
          <View style={styles.quantityContainer}>
            <Text style={styles.quantityDot}>●</Text>
            <Text style={styles.quantityText}>Qty {item.quantity}</Text>
          </View>
          <Text style={[
            styles.expirationText,
            isExpired && styles.expiredText,
            isExpiring && styles.expiringText
          ]}>
            {formatDate(item.expiration_date)}
          </Text>
        </View>

        {/* Fixed the badge display logic */}
        {isExpired && (
          <View style={[styles.statusBadge, styles.expiredBadge]}>
            <Text style={styles.statusText}>EXPIRED</Text>
          </View>
        )}
        {isExpiring && !isExpired && (
          <View style={[styles.statusBadge, styles.expiringBadge]}>
            <Text style={styles.statusText}>EXPIRING</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search items"
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Pantry</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddItem')}>
          <Text style={styles.viewAllText}>Add Item</Text>
        </TouchableOpacity>
      </View>
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
        <Text style={styles.addButtonText}>+ Add First Item</Text>
      </TouchableOpacity>
    </View>
  );

  const renderNoResults = () => (
    <View style={styles.noResultsContainer}>
      <Text style={styles.noResultsIcon}>🔍</Text>
      <Text style={styles.noResultsTitle}>No items found</Text>
      <Text style={styles.noResultsText}>Try searching for something else</Text>
    </View>
  );

  const renderAnalytics = () => {
    if (discardStats.length === 0) return null;

    const reasonCounts = discardStats.reduce((acc, item) => {
      const reason = item.reason || 'No reason given';
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

    const topReason = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])[0];

    return (
      <View style={styles.analyticsCard}>
        <Text style={styles.analyticsTitle}>♻️ Waste Insights</Text>
        <View style={styles.analyticsContent}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{discardStats.length}</Text>
            <Text style={styles.statLabel}>Items Discarded</Text>
          </View>
          {topReason && (
            <View style={styles.statItem}>
              <Text style={styles.statReason}>{topReason[0]}</Text>
              <Text style={styles.statLabel}>Top Reason</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading your pantry...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
      
      {pantryItems.length === 0 ? (
        renderEmptyState()
      ) : (
        <View style={styles.contentContainer}>
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderGridItem}
            ListHeaderComponent={renderHeader}
            ListFooterComponent={renderAnalytics}
            ListEmptyComponent={searchQuery.length > 0 ? renderNoResults : null}
            numColumns={2}
            columnWrapperStyle={filteredItems.length > 0 ? styles.row : null}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#4CAF50']}
                tintColor="#4CAF50"
              />
            }
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddItem')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

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
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Edit Item</Text>
                  <TouchableOpacity onPress={cancelEdit} style={styles.closeButton}>
                    <Text style={styles.closeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.formContainer}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Item Name</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.item_name}
                      onChangeText={(text) => setEditForm(prev => ({ ...prev, item_name: text }))}
                      placeholder="Enter item name"
                      placeholderTextColor="#999"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Quantity</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.quantity}
                      keyboardType="numeric"
                      onChangeText={(text) => setEditForm(prev => ({ ...prev, quantity: text }))}
                      placeholder="Enter quantity"
                      placeholderTextColor="#999"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Expiration Date</Text>
                    <TextInput
                      style={styles.input}
                      value={editForm.expiration_date}
                      onChangeText={(text) => setEditForm(prev => ({ ...prev, expiration_date: text }))}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#999"
                    />
                  </View>
                </View>

                <TouchableOpacity style={styles.saveButton} onPress={saveEdit}>
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </TouchableOpacity>
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Share Item</Text>
                <TouchableOpacity onPress={cancelShare} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {selectedItemForShare && (
                <View style={styles.sharePreview}>
                  <Text style={styles.sharePreviewEmoji}>
                    {getItemEmoji(selectedItemForShare.item_name)}
                  </Text>
                  <Text style={styles.sharePreviewName}>
                    {selectedItemForShare.item_name}
                  </Text>
                  <Text style={styles.sharePreviewDetails}>
                    Qty: {selectedItemForShare.quantity} • Expires: {formatDate(selectedItemForShare.expiration_date)}
                  </Text>
                </View>
              )}

              <Text style={styles.shareDescription}>
                Share this item with your neighbors. They'll be able to see and request it.
              </Text>

              <TouchableOpacity style={styles.shareButton} onPress={shareItem}>
                <Text style={styles.shareButtonText}>📤 Share with Neighbors</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 5,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#999',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  viewAllText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  gridItem: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    width: (width - 55) / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  gridItemExpiring: {
    backgroundColor: '#fff8e1',
    borderWidth: 1,
    borderColor: '#ffb74d',
  },
  gridItemExpired: {
    backgroundColor: '#ffebee',
    borderWidth: 2,
    borderColor: '#f44336',
  },
  gridItemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  itemEmoji: {
    fontSize: 32,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  discardButton: {
    backgroundColor: '#e8f5e8',
  },
  actionEmoji: {
    fontSize: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  itemDetails: {
    marginBottom: 8,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  quantityDot: {
    fontSize: 8,
    color: '#4CAF50',
    marginRight: 6,
  },
  quantityText: {
    fontSize: 12,
    color: '#666',
  },
  expirationText: {
    fontSize: 12,
    color: '#666',
  },
  expiringText: {
    color: '#ff9800',
    fontWeight: '600',
  },
  expiredText: {
    color: '#f44336',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  expiredBadge: {
    backgroundColor: '#f44336',
  },
  expiringBadge: {
    backgroundColor: '#ff9800',
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  analyticsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  analyticsContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statReason: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00C897',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
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
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#00C897',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#999',
  },
  formContainer: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#00C897',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sharePreview: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sharePreviewEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  sharePreviewName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sharePreviewDetails: {
    fontSize: 14,
    color: '#666',
  },
  shareDescription: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
  },
  shareButton: {
    backgroundColor: '#00C897',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});