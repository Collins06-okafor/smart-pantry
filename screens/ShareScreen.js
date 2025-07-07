import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  SafeAreaView,
  StatusBar,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export default function ShareScreen({ navigation }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('available'); // 'available', 'myshared', 'mypantry'
  
  // Data states
  const [sharedItems, setSharedItems] = useState([]);
  const [mySharedItems, setMySharedItems] = useState([]);
  const [myPantryItems, setMyPantryItems] = useState([]);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  
  // Modal states
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedItemForShare, setSelectedItemForShare] = useState(null);

  useEffect(() => {
    initializeScreen();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (currentUser) {
        refreshAllData();
      }
    }, [currentUser])
  );

  const initializeScreen = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user) {
        await fetchNearbyUsers(user.id);
        await refreshAllData();
      }
    } catch (error) {
      console.error('Error initializing screen:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshAllData = async () => {
    if (!currentUser) return;
    
    await Promise.all([
      fetchSharedItems(nearbyUsers),
      fetchMySharedItems(currentUser.id),
      fetchMyPantryItems(currentUser.id),
    ]);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshAllData().finally(() => setRefreshing(false));
  }, [currentUser, nearbyUsers]);

 const fetchNearbyUsers = async (userId) => {
  try {
    console.log('Fetching nearby users for:', userId);
    
    // Get current user's location
    const { data: myProfile, error: profileError } = await supabase
      .from('profile')
      .select('latitude, longitude')
      .eq('id', userId)
      .single();

    console.log('My profile:', myProfile);
    console.log('Profile error:', profileError);

    if (profileError) throw profileError;
    if (!myProfile.latitude || !myProfile.longitude) {
      console.log('No location set for current user');
      return setNearbyUsers([]);
    }

    // Query users within 10km radius
    const { data, error } = await supabase.rpc('get_nearby_users', {
      lat: myProfile.latitude,
      lng: myProfile.longitude,
      radius: 10000, // 10km in meters
      exclude_user_id: userId
    });

    console.log('Nearby users query result:', data);
    console.log('Nearby users error:', error);

    if (error) throw error;

    const userIds = data.map(u => u.id);
    console.log('Setting nearby users:', userIds);
    setNearbyUsers(userIds);
  } catch (err) {
    console.error('Error fetching nearby users:', err);
    setNearbyUsers([]);
  }
};


  const fetchSharedItems = async (userIds) => {
    if (userIds.length === 0) {
      setSharedItems([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('shared_items')
        .select(`
          id, 
          offered_at, 
          status,
          item_id,
          user_id,
          pantry_items!inner(
            id,
            item_name, 
            expiration_date, 
            quantity, 
            user_id,
            profile!pantry_items_user_id_fkey(name)
          )
        `)
        .in('user_id', userIds)
        .eq('status', 'available')
        .order('offered_at', { ascending: false });

      if (error) throw error;

      setSharedItems(data || []);
    } catch (err) {
      console.error('Error fetching shared items:', err);
      setSharedItems([]);
    }
  };

  const fetchMySharedItems = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('shared_items')
        .select(`
          id, 
          offered_at, 
          status,
          item_id,
          pantry_items!inner(
            id,
            item_name, 
            expiration_date, 
            quantity
          )
        `)
        .eq('user_id', userId)
        .order('offered_at', { ascending: false });

      if (error) throw error;

      setMySharedItems(data || []);
    } catch (err) {
      console.error('Error fetching my shared items:', err);
      setMySharedItems([]);
    }
  };

  const fetchMyPantryItems = async (userId) => {
    try {
      // Get pantry items that are NOT already shared
      const { data: sharedItemIds, error: sharedError } = await supabase
        .from('shared_items')
        .select('item_id')
        .eq('user_id', userId)
        .in('status', ['available', 'requested']);

      if (sharedError) throw sharedError;

      const excludeIds = sharedItemIds.map(item => item.item_id);
      let query = supabase
        .from('pantry_items')
        .select('id, item_name, expiration_date, quantity')
        .eq('user_id', userId)
        .order('expiration_date', { ascending: true });

      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }

      const { data, error } = await query;

      if (error) throw error;

      setMyPantryItems(data || []);
    } catch (err) {
      console.error('Error fetching pantry items:', err);
      setMyPantryItems([]);
    }
  };

  const requestItem = async (sharedItemId) => {
    try {
      const { error } = await supabase
        .from('shared_items')
        .update({ status: 'requested' })
        .eq('id', sharedItemId);

      if (error) throw error;

      Alert.alert('Success', 'Item requested! The owner will be notified.');
      await refreshAllData();
    } catch (err) {
      console.error('Error requesting item:', err);
      Alert.alert('Error', 'Failed to request item. Please try again.');
    }
  };

  const removeSharedItem = async (sharedItemId) => {
    try {
      const { error } = await supabase
        .from('shared_items')
        .delete()
        .eq('id', sharedItemId)
        .eq('user_id', currentUser.id);

      if (error) throw error;

      Alert.alert('Success', 'Item removed from sharing.');
      await refreshAllData();
    } catch (err) {
      console.error('Error removing shared item:', err);
      Alert.alert('Error', 'Failed to remove item. Please try again.');
    }
  };

  const shareItem = async (itemId) => {
    if (!currentUser) return;
    
    try {
      // Check if item is already shared
      const { data: existingShare, error: checkError } = await supabase
        .from('shared_items')
        .select('id')
        .eq('item_id', itemId)
        .eq('user_id', currentUser.id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingShare) {
        Alert.alert("Already Shared", "This item is already being shared.");
        return;
      }

      const { error } = await supabase
        .from('shared_items')
        .insert({
          item_id: itemId,
          user_id: currentUser.id,
          status: 'available',
          offered_at: new Date().toISOString()
        });

      if (error) {
        Alert.alert('Error', `Failed to share item: ${error.message}`);
      } else {
        Alert.alert('Success', 'Item shared with your neighbors!');
        setShowShareModal(false);
        await refreshAllData();
      }
    } catch (err) {
      console.error('Share error:', err);
      Alert.alert('Error', 'An unexpected error occurred while sharing the item.');
    }
  };

  const handleShareItem = (item) => {
    setSelectedItemForShare(item);
    setShowShareModal(true);
  };

  const cancelShare = () => {
    setShowShareModal(false);
    setSelectedItemForShare(null);
  };

  const confirmShare = () => {
    if (selectedItemForShare) {
      shareItem(selectedItemForShare.id);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return '#4CAF50';
      case 'requested':
        return '#FF9800';
      case 'completed':
        return '#2196F3';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'available':
        return 'Available';
      case 'requested':
        return 'Requested';
      case 'completed':
        return 'Completed';
      default:
        return 'Unknown';
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

  const renderNearbyItem = ({ item }) => {
    const pantryItem = item.pantry_items;
    if (!pantryItem) return null;

    const expirationStatus = getExpirationStatus(pantryItem.expiration_date);
    const isExpiringSoon = expirationStatus.status === 'expiring' || expirationStatus.status === 'expired';

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName}>{pantryItem.item_name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>
        
        <View style={styles.itemDetails}>
          <Text style={styles.detailText}>📦 Quantity: {pantryItem.quantity}</Text>
          <Text style={[styles.detailText, isExpiringSoon && styles.expiringText]}>
            📅 Expires: {formatDate(pantryItem.expiration_date)}
            {isExpiringSoon && ' ⚠️'}
          </Text>
          <Text style={styles.detailText}>
            👤 From: {pantryItem.profile?.name || 'Anonymous'}
          </Text>
          <Text style={styles.detailText}>
            📍 Shared: {formatDate(item.offered_at)}
          </Text>
        </View>

        {item.status === 'available' && (
          <TouchableOpacity 
            style={styles.requestButton} 
            onPress={() => requestItem(item.id)}
          >
            <Text style={styles.requestButtonText}>Request Item</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderMySharedItem = ({ item }) => {
    const pantryItem = item.pantry_items;
    if (!pantryItem) return null;

    const expirationStatus = getExpirationStatus(pantryItem.expiration_date);
    const isExpiringSoon = expirationStatus.status === 'expiring' || expirationStatus.status === 'expired';

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName}>{pantryItem.item_name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>
        
        <View style={styles.itemDetails}>
          <Text style={styles.detailText}>📦 Quantity: {pantryItem.quantity}</Text>
          <Text style={[styles.detailText, isExpiringSoon && styles.expiringText]}>
            📅 Expires: {formatDate(pantryItem.expiration_date)}
            {isExpiringSoon && ' ⚠️'}
          </Text>
          <Text style={styles.detailText}>
            📍 Shared: {formatDate(item.offered_at)}
          </Text>
        </View>

        {item.status === 'available' && (
          <TouchableOpacity 
            style={styles.removeButton} 
            onPress={() => removeSharedItem(item.id)}
          >
            <Text style={styles.removeButtonText}>Stop Sharing</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderMyPantryItem = ({ item }) => {
    const expirationStatus = getExpirationStatus(item.expiration_date);
    const isExpiringSoon = expirationStatus.status === 'expiring' || expirationStatus.status === 'expired';

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemName}>{item.item_name}</Text>
        </View>
        
        <View style={styles.itemDetails}>
          <Text style={styles.detailText}>📦 Quantity: {item.quantity}</Text>
          <Text style={[styles.detailText, isExpiringSoon && styles.expiringText]}>
            📅 Expires: {formatDate(item.expiration_date)}
            {isExpiringSoon && ' ⚠️'}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.shareButton} 
          onPress={() => handleShareItem(item)}
        >
          <Text style={styles.shareButtonText}>📤 Share</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'available':
        return (
          <FlatList
            data={sharedItems}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderNearbyItem}
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
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🏠</Text>
                <Text style={styles.emptyTitle}>No items available</Text>
                <Text style={styles.emptyText}>
                  No neighbors are sharing items right now. Check back later!
                </Text>
              </View>
            }
          />
        );
      
      case 'myshared':
        return (
          <FlatList
            data={mySharedItems}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMySharedItem}
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
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📤</Text>
                <Text style={styles.emptyTitle}>No shared items</Text>
                <Text style={styles.emptyText}>
                  You haven't shared any items yet. Share items from your pantry to help your neighbors!
                </Text>
              </View>
            }
          />
        );
      
      case 'mypantry':
        return (
          <FlatList
            data={myPantryItems}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderMyPantryItem}
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
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🥫</Text>
                <Text style={styles.emptyTitle}>All items shared</Text>
                <Text style={styles.emptyText}>
                  All your pantry items are already shared or you don't have any items to share.
                </Text>
              </View>
            }
          />
        );
      
      default:
        return null;
    }
  };

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'available' && styles.activeTab]}
        onPress={() => setActiveTab('available')}
      >
        <Text style={[styles.tabText, activeTab === 'available' && styles.activeTabText]}>
          Available ({sharedItems.length})
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tab, activeTab === 'myshared' && styles.activeTab]}
        onPress={() => setActiveTab('myshared')}
      >
        <Text style={[styles.tabText, activeTab === 'myshared' && styles.activeTabText]}>
          My Shared ({mySharedItems.length})
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tab, activeTab === 'mypantry' && styles.activeTab]}
        onPress={() => setActiveTab('mypantry')}
      >
        <Text style={[styles.tabText, activeTab === 'mypantry' && styles.activeTabText]}>
          Share More ({myPantryItems.length})
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00C897" />
          <Text style={styles.loadingText}>Loading sharing options...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
  <SafeAreaView style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

    <View style={styles.header}>
      <Text style={styles.title}>Community Sharing</Text>
      <Text style={styles.subtitle}>Share food, reduce waste</Text>
    </View>

    {/* Request Food Button */}
    <TouchableOpacity
      style={styles.requestButtonTop}
      onPress={() => navigation.navigate('RequestFood')}
    >
      <Text style={styles.requestButtonTextTop}>🤝 Request Food</Text>
    </TouchableOpacity>

    {renderTabs()}
    {renderTabContent()}


      {/* Share Confirmation Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={showShareModal}
        onRequestClose={cancelShare}
      >
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
              Share this item with your neighbors. They'll be able to see and request it. You can stop sharing at any time.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelShare}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={confirmShare}>
                <Text style={styles.confirmButtonText}>📤 Share Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#00C897',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  activeTabText: {
    color: '#fff',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  itemDetails: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  expiringText: {
    color: '#ff9800',
    fontWeight: '600',
  },
  requestButton: {
    backgroundColor: '#00C897',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  removeButton: {
    backgroundColor: '#f44336',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 200,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Modal Styles
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
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
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
  confirmButton: {
    backgroundColor: '#00C897',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 1,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  requestButtonTop: {
  marginHorizontal: 20,
  marginBottom: 10,
  paddingVertical: 12,
  borderRadius: 8,
  backgroundColor: '#5a2ca0',
  alignItems: 'center',
},
requestButtonTextTop: {
  color: '#fff',
  fontWeight: 'bold',
  fontSize: 16,
},
});