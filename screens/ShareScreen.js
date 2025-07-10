import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

// Constants
const TABS = {
  AVAILABLE: 'available',
  REQUESTS: 'requests',
  MY_SHARED: 'myshared',
  MY_PANTRY: 'mypantry',
};

const STATUSES = {
  AVAILABLE: 'available',
  REQUESTED: 'requested',
  COMPLETED: 'completed',
  ACTIVE: 'active',
};

const URGENCY_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

const NEARBY_RADIUS = 10000; // 10km in meters

// Custom hooks
const useModal = (initialState = false) => {
  const [isOpen, setIsOpen] = useState(initialState);
  const [selectedItem, setSelectedItem] = useState(null);
  
  const open = useCallback((item = null) => {
    setSelectedItem(item);
    setIsOpen(true);
  }, []);
  
  const close = useCallback(() => {
    setIsOpen(false);
    setSelectedItem(null);
  }, []);
  
  return { isOpen, selectedItem, open, close };
};

const useShareData = (currentUser) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState([]);
  
  // Data states
  const [sharedItems, setSharedItems] = useState([]);
  const [foodRequests, setFoodRequests] = useState([]);
  const [mySharedItems, setMySharedItems] = useState([]);
  const [myPantryItems, setMyPantryItems] = useState([]);

  const fetchNearbyUsers = useCallback(async (userId) => {
    try {
      const { data: myProfile, error: profileError } = await supabase
        .from('profile')
        .select('latitude, longitude')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      if (!myProfile.latitude || !myProfile.longitude) {
        setNearbyUsers([]);
        return;
      }

      const { data, error } = await supabase.rpc('get_nearby_users', {
        lat: myProfile.latitude,
        lng: myProfile.longitude,
        radius: NEARBY_RADIUS,
        exclude_user_id: userId
      });

      if (error) throw error;
      setNearbyUsers(data?.map(u => u.id) || []);
    } catch (err) {
      console.error('Error fetching nearby users:', err);
      setNearbyUsers([]);
    }
  }, []);

  const fetchFoodRequests = useCallback(async (userIds) => {
    if (userIds.length === 0) {
      setFoodRequests([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('food_requests')
        .select(`
          id,
          item_name,
          description,
          urgency,
          requested_at,
          status,
          user_id,
          profile!food_requests_user_id_fkey(name, latitude, longitude)
        `)
        .in('user_id', userIds)
        .eq('status', STATUSES.ACTIVE)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      setFoodRequests(data || []);
    } catch (err) {
      console.error('Error fetching food requests:', err);
      setFoodRequests([]);
    }
  }, []);

  const fetchSharedItems = useCallback(async (userIds) => {
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
          item_link,
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
        .eq('status', STATUSES.AVAILABLE)
        .order('offered_at', { ascending: false });

      if (error) throw error;
      setSharedItems(data || []);
    } catch (err) {
      console.error('Error fetching shared items:', err);
      setSharedItems([]);
    }
  }, []);

  const fetchMySharedItems = useCallback(async (userId) => {
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
        .in('status', [STATUSES.AVAILABLE, STATUSES.REQUESTED])
        .order('offered_at', { ascending: false });

      if (error) throw error;
      setMySharedItems(data || []);
    } catch (err) {
      console.error('Error fetching my shared items:', err);
      setMySharedItems([]);
    }
  }, []);

  const fetchMyPantryItems = useCallback(async (userId) => {
    try {
      const { data: sharedItemIds, error: sharedError } = await supabase
        .from('shared_items')
        .select('item_link')
        .eq('user_id', userId)
        .in('status', [STATUSES.AVAILABLE, STATUSES.REQUESTED]);

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
  }, []);

  const refreshAllData = useCallback(async () => {
    if (!currentUser) return;
    
    await Promise.all([
      fetchSharedItems(nearbyUsers),
      fetchFoodRequests(nearbyUsers),
      fetchMySharedItems(currentUser.id),
      fetchMyPantryItems(currentUser.id),
    ]);
  }, [currentUser, nearbyUsers, fetchSharedItems, fetchFoodRequests, fetchMySharedItems, fetchMyPantryItems]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshAllData().finally(() => setRefreshing(false));
  }, [refreshAllData]);

  return {
    loading,
    setLoading,
    refreshing,
    sharedItems,
    foodRequests,
    mySharedItems,
    myPantryItems,
    nearbyUsers,
    fetchNearbyUsers,
    refreshAllData,
    onRefresh,
  };
};

// Utility functions
const getStatusColor = (status) => {
  const colors = {
    [STATUSES.AVAILABLE]: '#4CAF50',
    [STATUSES.REQUESTED]: '#FF9800',
    [STATUSES.COMPLETED]: '#2196F3',
  };
  return colors[status] || '#9E9E9E';
};

const getStatusText = (status) => {
  const texts = {
    [STATUSES.AVAILABLE]: 'Available',
    [STATUSES.REQUESTED]: 'Requested',
    [STATUSES.COMPLETED]: 'Completed',
  };
  return texts[status] || 'Unknown';
};

const getUrgencyColor = (urgency) => {
  const colors = {
    [URGENCY_LEVELS.HIGH]: '#f44336',
    [URGENCY_LEVELS.MEDIUM]: '#ff9800',
    [URGENCY_LEVELS.LOW]: '#4caf50',
  };
  return colors[urgency] || '#9e9e9e';
};

const getUrgencyText = (urgency) => {
  const texts = {
    [URGENCY_LEVELS.HIGH]: 'Urgent',
    [URGENCY_LEVELS.MEDIUM]: 'Medium',
    [URGENCY_LEVELS.LOW]: 'Low',
  };
  return texts[urgency] || 'Normal';
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
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

// Main component
export default function ShareScreen({ navigation }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState(TABS.AVAILABLE);
  const [offerMessage, setOfferMessage] = useState('');
  
  const shareModal = useModal();
  const offerModal = useModal();
  
  const {
    loading,
    setLoading,
    refreshing,
    sharedItems,
    foodRequests,
    mySharedItems,
    myPantryItems,
    nearbyUsers,
    fetchNearbyUsers,
    refreshAllData,
    onRefresh,
  } = useShareData(currentUser);

  // Memoized computed values
  const tabCounts = useMemo(() => ({
    [TABS.AVAILABLE]: sharedItems.length,
    [TABS.REQUESTS]: foodRequests.length,
    [TABS.MY_SHARED]: mySharedItems.length,
    [TABS.MY_PANTRY]: myPantryItems.length,
  }), [sharedItems.length, foodRequests.length, mySharedItems.length, myPantryItems.length]);

  const enrichedSharedItems = useMemo(() => 
    sharedItems.map(item => ({
      ...item,
      expirationStatus: getExpirationStatus(item.pantry_items?.expiration_date),
    })), [sharedItems]
  );

  const enrichedMySharedItems = useMemo(() => 
    mySharedItems.map(item => ({
      ...item,
      expirationStatus: getExpirationStatus(item.pantry_items?.expiration_date),
    })), [mySharedItems]
  );

  const enrichedMyPantryItems = useMemo(() => 
    myPantryItems.map(item => ({
      ...item,
      expirationStatus: getExpirationStatus(item.expiration_date),
    })), [myPantryItems]
  );

  // Effects
  useEffect(() => {
    const initializeScreen = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
        if (user) {
          await fetchNearbyUsers(user.id);
        }
      } catch (error) {
        console.error('Error initializing screen:', error);
        Alert.alert('Error', 'Failed to initialize screen. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    initializeScreen();
  }, [fetchNearbyUsers, setLoading]);

  useFocusEffect(
    useCallback(() => {
      if (currentUser) {
        refreshAllData();
      }
    }, [currentUser, refreshAllData])
  );

  useEffect(() => {
    const channel = supabase
      .channel('shared_items_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'shared_items',
      }, () => {
        refreshAllData();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'food_requests',
      }, () => {
        refreshAllData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshAllData]);

  // Action handlers
  const handleRequestItem = useCallback(async (sharedItemId) => {
    try {
      const { error } = await supabase
        .from('shared_items')
        .update({ status: STATUSES.REQUESTED })
        .eq('id', sharedItemId);

      if (error) throw error;

      Alert.alert('Success', 'Item requested! The owner will be notified.');
      await refreshAllData();
    } catch (err) {
      console.error('Error requesting item:', err);
      Alert.alert('Error', 'Failed to request item. Please try again.');
    }
  }, [refreshAllData]);

  const handleRemoveSharedItem = useCallback(async (sharedItemId) => {
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
  }, [currentUser?.id, refreshAllData]);

  const handleShareItem = useCallback(async (itemId) => {
  if (!currentUser) return;
  
  try {
    // Check if item is already shared
    const { data: existingShare, error: checkError } = await supabase
      .from('shared_items')
      .select('id')
      .eq('item_id', itemId)
      .eq('user_id', currentUser.id)
      .in('status', [STATUSES.AVAILABLE, STATUSES.REQUESTED]);

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingShare && existingShare.length > 0) {
      Alert.alert("Already Shared", "This item is already being shared.");
      return;
    }

    // Insert new shared item
    const { error } = await supabase
      .from('shared_items')
      .insert({
        item_id: itemId,
        user_id: currentUser.id,
        status: STATUSES.AVAILABLE,
        offered_at: new Date().toISOString()
      });

    if (error) throw error;

    Alert.alert('Success', 'Item shared with your neighbors!');
    shareModal.close();
    await refreshAllData(); // Refresh all data to update both My Shared and My Pantry lists
  } catch (err) {
    console.error('Share error:', err);
    Alert.alert('Error', 'Failed to share item. Please try again.');
  }
}, [currentUser, shareModal, refreshAllData]);

  const handleOfferHelp = useCallback(async (requestId) => {
    try {
      const { error } = await supabase
        .from('food_request_offers')
        .insert({
          request_id: requestId,
          helper_id: currentUser.id,
          message: offerMessage,
          offered_at: new Date().toISOString()
        });

      if (error) throw error;

      Alert.alert('Success', 'Your offer has been sent to the requester!');
      offerModal.close();
      setOfferMessage('');
      await refreshAllData();
    } catch (err) {
      console.error('Error offering help:', err);
      Alert.alert('Error', 'Failed to send offer. Please try again.');
    }
  }, [currentUser?.id, offerMessage, offerModal, refreshAllData]);

  // Render functions
  const renderFoodRequest = useCallback(({ item }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.item_name}</Text>
        <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(item.urgency) }]}>
          <Text style={styles.urgencyText}>{getUrgencyText(item.urgency)}</Text>
        </View>
      </View>
      
      <View style={styles.itemDetails}>
        <Text style={styles.detailText}>📝 {item.description}</Text>
        <Text style={styles.detailText}>
          👤 Requested by: {item.profile?.name || 'Anonymous'}
        </Text>
        <Text style={styles.detailText}>
          📅 Requested: {formatDate(item.requested_at)}
        </Text>
      </View>

      <TouchableOpacity 
        style={styles.helpButton} 
        onPress={() => offerModal.open(item)}
        accessibilityLabel={`Offer help for ${item.item_name}`}
      >
        <Text style={styles.helpButtonText}>🤝 Offer Help</Text>
      </TouchableOpacity>
    </View>
  ), [offerModal]);

  const renderNearbyItem = useCallback(({ item }) => {
    const pantryItem = item.pantry_items;
    if (!pantryItem) return null;

    const isExpiringSoon = item.expirationStatus.status === 'expiring' || item.expirationStatus.status === 'expired';

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

        {item.status === STATUSES.AVAILABLE && (
          <TouchableOpacity 
            style={styles.requestButton} 
            onPress={() => handleRequestItem(item.id)}
            accessibilityLabel={`Request ${pantryItem.item_name}`}
          >
            <Text style={styles.requestButtonText}>Request Item</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [handleRequestItem]);

  const renderMySharedItem = useCallback(({ item }) => {
    const pantryItem = item.pantry_items;
    if (!pantryItem) return null;

    const isExpiringSoon = item.expirationStatus.status === 'expiring' || item.expirationStatus.status === 'expired';

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

        {item.status === STATUSES.AVAILABLE && (
          <TouchableOpacity 
            style={styles.removeButton} 
            onPress={() => handleRemoveSharedItem(item.id)}
            accessibilityLabel={`Stop sharing ${pantryItem.item_name}`}
          >
            <Text style={styles.removeButtonText}>Delete Sharing</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [handleRemoveSharedItem]);

  const renderMyPantryItem = useCallback(({ item }) => {
    const isExpiringSoon = item.expirationStatus.status === 'expiring' || item.expirationStatus.status === 'expired';

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
          onPress={() => shareModal.open(item)}
          accessibilityLabel={`Share ${item.item_name}`}
        >
          <Text style={styles.shareButtonText}>📤 Share</Text>
        </TouchableOpacity>
      </View>
    );
  }, [shareModal]);

  const renderEmptyState = useCallback((icon, title, text) => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  ), []);

  const renderTabContent = useCallback(() => {
    const tabConfig = {
      [TABS.AVAILABLE]: {
        data: enrichedSharedItems,
        renderItem: renderNearbyItem,
        emptyState: renderEmptyState('🏠', 'No items available', 'No neighbors are sharing items right now. Check back later!'),
      },
      [TABS.REQUESTS]: {
        data: foodRequests,
        renderItem: renderFoodRequest,
        emptyState: renderEmptyState('🤝', 'No food requests', 'No neighbors are requesting food right now. Check back later!'),
      },
      [TABS.MY_SHARED]: {
        data: enrichedMySharedItems,
        renderItem: renderMySharedItem,
        emptyState: renderEmptyState('📤', 'No shared items', "You haven't shared any items yet. Share items from your pantry to help your neighbors!"),
      },
      [TABS.MY_PANTRY]: {
        data: enrichedMyPantryItems,
        renderItem: renderMyPantryItem,
        emptyState: renderEmptyState('🥫', 'All items shared', "All your pantry items are already shared or you don't have any items to share."),
      },
    };

    const config = tabConfig[activeTab];
    if (!config) return null;

    return (
      <FlatList
        data={config.data}
        keyExtractor={(item) => item.id.toString()}
        renderItem={config.renderItem}
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
        ListEmptyComponent={config.emptyState}
      />
    );
  }, [activeTab, enrichedSharedItems, enrichedMySharedItems, enrichedMyPantryItems, foodRequests, renderNearbyItem, renderFoodRequest, renderMySharedItem, renderMyPantryItem, renderEmptyState, refreshing, onRefresh]);

  const renderTabs = useCallback(() => (
    <View style={styles.tabContainer}>
      {Object.entries({
        [TABS.AVAILABLE]: 'Available',
        [TABS.REQUESTS]: 'Requests',
        [TABS.MY_SHARED]: 'My Shared',
        [TABS.MY_PANTRY]: 'Share More',
      }).map(([tabKey, tabLabel]) => (
        <TouchableOpacity
          key={tabKey}
          style={[styles.tab, activeTab === tabKey && styles.activeTab]}
          onPress={() => setActiveTab(tabKey)}
          accessibilityLabel={`${tabLabel} tab`}
          accessibilityState={{ selected: activeTab === tabKey }}
        >
          <Text style={[styles.tabText, activeTab === tabKey && styles.activeTabText]}>
            {tabLabel} ({tabCounts[tabKey]})
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ), [activeTab, tabCounts]);

  // Loading state
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

      <TouchableOpacity
        style={styles.requestButtonTop}
        onPress={() => navigation.navigate('RequestFood')}
        accessibilityLabel="Request food from neighbors"
      >
        <Text style={styles.requestButtonTextTop}>🤝 Request Food</Text>
      </TouchableOpacity>

      {renderTabs()}
      {renderTabContent()}

      {/* Share Confirmation Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={shareModal.isOpen}
        onRequestClose={shareModal.close}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Share Item</Text>
            
            {shareModal.selectedItem && (
              <View style={styles.shareItemPreview}>
                <Text style={styles.shareItemName}>{shareModal.selectedItem.item_name}</Text>
                <Text style={styles.shareItemDetail}>Quantity: {shareModal.selectedItem.quantity}</Text>
                <Text style={styles.shareItemDetail}>
                  Expires: {formatDate(shareModal.selectedItem.expiration_date)}
                </Text>
              </View>
            )}

            <Text style={styles.shareDescription}>
              Share this item with your neighbors. They'll be able to see and request it. You can stop sharing at any time.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={shareModal.close}
                accessibilityLabel="Cancel sharing"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmButton} 
                onPress={() => handleShareItem(shareModal.selectedItem?.id)}
                accessibilityLabel="Confirm sharing item"
              >
                <Text style={styles.confirmButtonText}>📤 Share Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Offer Help Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={offerModal.isOpen}
        onRequestClose={offerModal.close}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Offer Help</Text>
            
            {offerModal.selectedItem && (
              <View style={styles.shareItemPreview}>
                <Text style={styles.shareItemName}>
                  {offerModal.selectedItem.item_name}
                </Text>
                <Text style={styles.shareItemDetail}>
                  Requested by: {offerModal.selectedItem.profile?.name || 'Anonymous'}
                </Text>
                <Text style={styles.shareItemDetail}>
                  {offerModal.selectedItem.description}
                </Text>
              </View>
            )}

            <Text style={styles.shareDescription}>
              Send a message to offer help with this food request:
            </Text>

            <TextInput
              style={styles.messageInput}
              placeholder="Type your message here..."
              multiline
              numberOfLines={4}
              value={offerMessage}
              onChangeText={setOfferMessage}
              accessibilityLabel="Message to offer help"
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={offerModal.close}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmButton} 
                onPress={() => handleOfferHelp(offerModal.selectedItem?.id)}
              >
                <Text style={styles.confirmButtonText}>🤝 Send Offer</Text>
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
  messageInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 10,
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
  
  // Test button styles
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
