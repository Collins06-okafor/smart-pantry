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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

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
    // Get current user's location
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

    // Get nearby users (excluding current user)
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
  try {
    console.log('Fetching food requests for user:', currentUser?.id);
    const { data, error } = await supabase
      .from('food_requests')
      .select(`
        id,
        item_name,
        description,
        urgency,
        created_at,
        status,
        requester_id,
        profile!food_requests_requester_id_fkey(name)
      `)
      .neq('requester_id', currentUser.id)
      .eq('status', STATUSES.ACTIVE)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    console.log('Fetched requests:', data);
    setFoodRequests(data || []);
  } catch (err) {
    console.error('Error in fetchFoodRequests:', err);
    setFoodRequests([]);
  }
}, [currentUser?.id]);

  const fetchSharedItems = useCallback(async (userIds) => {
  if (userIds.length === 0) {
    setSharedItems([]);
    return;
  }

  try {
    // First fetch the shared items with basic info
    const { data: sharedItemsData, error: sharedError } = await supabase
      .from('shared_items')
      .select(`
        id, 
        offered_at, 
        status,
        item_link,
        user_id
      `)
      .in('user_id', userIds)
      .eq('status', STATUSES.AVAILABLE)
      .order('offered_at', { ascending: false });

    if (sharedError) throw sharedError;
    if (!sharedItemsData || sharedItemsData.length === 0) {
      setSharedItems([]);
      return;
    }

    // Get all unique pantry item IDs
    const pantryItemIds = sharedItemsData
      .map(item => item.item_link)
      .filter(id => id !== null);

    // Fetch the associated pantry items
    const { data: pantryItemsData, error: pantryError } = await supabase
      .from('pantry_items')
      .select('*')
      .in('id', pantryItemIds);

    if (pantryError) throw pantryError;

    // Get all unique user IDs from both shared items and pantry items
    const allUserIds = [
      ...new Set([
        ...sharedItemsData.map(item => item.user_id),
        ...(pantryItemsData?.map(item => item.user_id) || [])
      ])
    ];

    // Fetch user profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profile')
      .select('id, name')
      .in('id', allUserIds);

    if (profilesError) throw profilesError;

    // Combine all the data
    const combinedData = sharedItemsData.map(sharedItem => {
      const pantryItem = pantryItemsData?.find(item => item.id === sharedItem.item_link);
      const ownerProfile = profilesData?.find(p => p.id === sharedItem.user_id);
      const pantryOwnerProfile = pantryItem ? 
        profilesData?.find(p => p.id === pantryItem.user_id) : 
        null;

      return {
        ...sharedItem,
        pantry_items: pantryItem ? {
          ...pantryItem,
          profile: pantryOwnerProfile || ownerProfile || null
        } : null
      };
    }).filter(item => item.pantry_items !== null); // Filter out items with no pantry data

    setSharedItems(combinedData);
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
          item_link,
          pantry_items!shared_items_item_link_fkey(
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
      
      const validItems = (data || []).filter(item => item.pantry_items);
      setMySharedItems(validItems);
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

      const excludeIds = sharedItemIds
        .map(item => item.item_link)
        .filter(id => id != null && id !== '' && !isNaN(parseInt(id)))
        .map(id => parseInt(id));

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
export default function ShareScreen({ navigation, route }) {
  const initialTab = route.params?.initialTab || TABS.AVAILABLE;
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

  useEffect(() => {
    if (route.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route.params?.initialTab]);

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
    // 1. Fetch the shared item details
    const { data: sharedItem, error: fetchError } = await supabase
      .from('shared_items')
      .select('*, pantry_items(*)')
      .eq('id', sharedItemId)
      .single();

    if (fetchError) throw fetchError;
    if (!sharedItem) throw new Error('Shared item not found');

    // 2. Create the food request
    const { data: request, error: requestError } = await supabase
      .from('food_requests')
      .insert({
        requester_id: currentUser.id,
        item_name: sharedItem.pantry_items?.item_name || 'Food Item',
        description: `Request for ${sharedItem.pantry_items?.item_name || 'food item'}`,
        urgency: 'medium',
        status: 'active',
        related_item_id: sharedItem.item_link,
        related_sharer_id: sharedItem.user_id
      })
      .select()
      .single();

    if (requestError) throw requestError;
    if (!request?.id) throw new Error('Failed to create food request');

    // 3. Update the shared item status
    const { error: updateError } = await supabase
      .from('shared_items')
      .update({ status: STATUSES.REQUESTED })
      .eq('id', sharedItemId);

    if (updateError) throw updateError;

    Alert.alert('Success', 'Item requested! The owner will be notified.');
    await refreshAllData();
  } catch (err) {
    console.error('Error requesting item:', err);
    Alert.alert('Error', err.message || 'Failed to request item. Please try again.');
  }
}, [currentUser?.id, refreshAllData]);

const fetchConnectedRequests = useCallback(async (userId) => {
  try {
    const { data, error } = await supabase
      .from('request_item_connections')
      .select(`
        *,
        food_requests!inner(*),
        pantry_items!inner(*)
      `)
      .or(`pantry_items.user_id.eq.${userId},food_requests.requester_id.eq.${userId}`);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error fetching connected requests:', err);
    return [];
  }
}, []);

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
      const { data: existingShare, error: checkError } = await supabase
        .from('shared_items')
        .select('id')
        .eq('item_link', itemId)
        .eq('user_id', currentUser.id)
        .in('status', [STATUSES.AVAILABLE, STATUSES.REQUESTED]);

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingShare && existingShare.length > 0) {
        Alert.alert("Already Shared", "This item is already being shared.");
        return;
      }

      const { error } = await supabase
        .from('shared_items')
        .insert({
          item_link: itemId,
          user_id: currentUser.id,
          status: STATUSES.AVAILABLE,
          offered_at: new Date().toISOString()
        });

      if (error) throw error;

      Alert.alert('Success', 'Item shared with your neighbors!');
      shareModal.close();
      await refreshAllData();
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
        📅 Requested: {formatDate(item.created_at)}
      </Text>
    </View>

    <TouchableOpacity 
      style={styles.helpButton} 
      onPress={() => offerModal.open(item)}
      accessibilityLabel={`Offer help for ${item.item_name}`}
    >
      <Ionicons name="hand-left" size={20} color="#fff" />
      <Text style={styles.helpButtonText}> Offer Help</Text>
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
          <Text style={styles.detailText}>
            <Ionicons name="cube" size={16} color="#666" /> Quantity: {pantryItem.quantity}
          </Text>
          <Text style={[styles.detailText, isExpiringSoon && styles.expiringText]}>
            <Ionicons name="calendar" size={16} color={isExpiringSoon ? '#FF9800' : '#666'} /> 
            Expires: {formatDate(pantryItem.expiration_date)}
            {isExpiringSoon && ' ⚠️'}
          </Text>
          <Text style={styles.detailText}>
            <Ionicons name="person" size={16} color="#666" /> From: {pantryItem.profile?.name || 'Anonymous'}
          </Text>
          <Text style={styles.detailText}>
            <Ionicons name="time" size={16} color="#666" /> Shared: {formatDate(item.offered_at)}
          </Text>
        </View>
      
      {item.status === STATUSES.AVAILABLE && (
        <>
          <TouchableOpacity 
            style={styles.requestButton} 
            onPress={() => handleRequestItem(item.id)}
            accessibilityLabel={`Request ${pantryItem.item_name}`}
          >
            <Ionicons name="cart" size={20} color="#fff" />
            <Text style={styles.requestButtonText}> Request Item</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.requestHelpButton} 
            onPress={() => navigation.navigate('RequestFood', { 
              sharerId: item.user_id,
              item: pantryItem 
            })}
          >
            <Ionicons name="hand-left" size={20} color="#fff" />
            <Text style={styles.requestButtonText}> Request Help for This</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}, [handleRequestItem, navigation]);

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
          <Text style={styles.detailText}>
            <Ionicons name="cube" size={16} color="#666" /> Quantity: {pantryItem.quantity}
          </Text>
          <Text style={[styles.detailText, isExpiringSoon && styles.expiringText]}>
            <Ionicons name="calendar" size={16} color={isExpiringSoon ? '#FF9800' : '#666'} /> 
            Expires: {formatDate(pantryItem.expiration_date)}
            {isExpiringSoon && ' ⚠️'}
          </Text>
          <Text style={styles.detailText}>
            <Ionicons name="time" size={16} color="#666" /> Shared: {formatDate(item.offered_at)}
          </Text>
        </View>

        {item.status === STATUSES.AVAILABLE && (
          <TouchableOpacity 
            style={styles.removeButton} 
            onPress={() => handleRemoveSharedItem(item.id)}
            accessibilityLabel={`Stop sharing ${pantryItem.item_name}`}
          >
            <Ionicons name="trash" size={20} color="#fff" />
            <Text style={styles.removeButtonText}> Delete Sharing</Text>
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
          <Text style={styles.detailText}>
            <Ionicons name="cube" size={16} color="#666" /> Quantity: {item.quantity}
          </Text>
          <Text style={[styles.detailText, isExpiringSoon && styles.expiringText]}>
            <Ionicons name="calendar" size={16} color={isExpiringSoon ? '#FF9800' : '#666'} /> 
            Expires: {formatDate(item.expiration_date)}
            {isExpiringSoon && ' ⚠️'}
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.shareButton} 
          onPress={() => shareModal.open(item)}
          accessibilityLabel={`Share ${item.item_name}`}
        >
          <Ionicons name="share-social" size={20} color="#fff" />
          <Text style={styles.shareButtonText}> Share</Text>
        </TouchableOpacity>
      </View>
    );
  }, [shareModal]);

  const renderEmptyState = useCallback((icon, title, text) => (
    <View style={styles.emptyContainer}>
      <Ionicons name={icon} size={48} color="#9E9E9E" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  ), []);

  const renderTabContent = useCallback(() => {
    const tabConfig = {
      [TABS.AVAILABLE]: {
        data: enrichedSharedItems,
        renderItem: renderNearbyItem,
        emptyState: renderEmptyState('home', 'No items available', 'No neighbors are sharing items right now. Check back later!'),
      },
      [TABS.REQUESTS]: {
        data: foodRequests,
        renderItem: renderFoodRequest,
        emptyState: renderEmptyState('hand-left', 'No food requests', 'No neighbors are requesting food right now. Check back later!'),
      },
      [TABS.MY_SHARED]: {
        data: enrichedMySharedItems,
        renderItem: renderMySharedItem,
        emptyState: renderEmptyState('share-social', 'No shared items', "You haven't shared any items yet. Share items from your pantry to help your neighbors!"),
      },
      [TABS.MY_PANTRY]: {
        data: enrichedMyPantryItems,
        renderItem: renderMyPantryItem,
        emptyState: renderEmptyState('fast-food', 'All items shared', "All your pantry items are already shared or you don't have any items to share."),
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
            colors={['#4CAF50']}
            tintColor="#4CAF50"
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
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading sharing options...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Community Sharing</Text>
          <Text style={styles.subtitle}>Share food, reduce waste</Text>
        </View>
        <Ionicons name="fast-food" size={80} color="#4CAF50" />
      </View>

      <TouchableOpacity
        style={styles.requestButtonTop}
        onPress={() => navigation.navigate('RequestFood')}
        accessibilityLabel="Request food from neighbors"
      >
        <Ionicons name="hand-left" size={20} color="#fff" />
        <Text style={styles.requestButtonTextTop}> Request Food</Text>
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
                <Text style={styles.shareItemDetail}>
                  <Ionicons name="cube" size={16} color="#666" /> Quantity: {shareModal.selectedItem.quantity}
                </Text>
                <Text style={styles.shareItemDetail}>
                  <Ionicons name="calendar" size={16} color="#666" /> 
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
                <Ionicons name="share-social" size={20} color="#fff" />
                <Text style={styles.confirmButtonText}> Share Item</Text>
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
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    style={styles.modalOverlay}
  >
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Offer Help</Text>
      
      {offerModal.selectedItem && (
        <View style={styles.shareItemPreview}>
          <Text style={styles.shareItemName}>
            {offerModal.selectedItem.item_name}
          </Text>
          <Text style={styles.shareItemDetail}>
            <Ionicons name="person" size={16} color="#666" /> 
            Requested by: {offerModal.selectedItem.profile?.name || 'Anonymous'}
          </Text>
          <Text style={styles.shareItemDetail}>
            <Ionicons name="document-text" size={16} color="#666" /> 
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
          <Ionicons name="hand-left" size={20} color="#fff" />
          <Text style={styles.confirmButtonText}> Send Offer</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
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
    backgroundColor: '#4CAF50',
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
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  urgencyText: {
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  expiringText: {
    color: '#FF9800',
    fontWeight: '600',
  },
  requestButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  removeButton: {
    backgroundColor: '#F44336',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
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
    flexDirection: 'row',
    justifyContent: 'center',
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helpButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  helpButtonText: {
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
  emptyTitle: {
    fontSize: 18,
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
  requestButtonTop: {
    marginHorizontal: 20,
    marginBottom: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#5a2ca0',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestButtonTextTop: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  requestHelpButton: {
    backgroundColor: '#5a2ca0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
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
    fontSize: 20,
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
    marginBottom: 8,
  },
  shareItemDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
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
    backgroundColor: '#F44336',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});