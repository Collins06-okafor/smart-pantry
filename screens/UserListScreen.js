// UserListScreen.js - Enhanced with better activity tracking and organized by last seen
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Image, Alert, PanResponder
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useActivityTracker } from '../hooks/useActivityTracker';

export default function UserListScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);

  // Use the activity tracker hook
  const { updateActivity } = useActivityTracker(currentUserId);

  // Set up pan responder to detect user interactions
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => {
      updateActivity();
      return false;
    },
    onMoveShouldSetPanResponder: () => false,
  });

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchUsers();
      subscribeToProfileUpdates();
    }
  }, [currentUserId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }
  };

  const fetchUsers = async () => {
    if (!currentUserId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('profile')
      .select('id, name, surname, profile_photo_url, is_online, last_active')
      .neq('id', currentUserId);

    if (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to load users');
      setLoading(false);
      return;
    }

    // Clean up stale online statuses based on last_active
    const cleanedUsers = (data || []).map(user => ({
      ...user,
      is_online: isUserActuallyOnline(user)
    }));

    // Sort users by last_active with unknown at the bottom
    const sortedUsers = sortUsersByLastSeen(cleanedUsers);
    
    setUsers(sortedUsers);
    setLoading(false);
  };

  // Sort users by last seen with unknown at the bottom
  const sortUsersByLastSeen = (users) => {
    return [...users].sort((a, b) => {
      // Online users first
      if (a.is_online && !b.is_online) return -1;
      if (!a.is_online && b.is_online) return 1;
      
      // Both online - no need to sort further
      if (a.is_online && b.is_online) return 0;
      
      // Handle unknown last_active
      if (!a.last_active && !b.last_active) return 0;
      if (!a.last_active) return 1; // a comes after b (unknown at bottom)
      if (!b.last_active) return -1; // b comes after a (unknown at bottom)
      
      // Both have last_active - sort by most recent
      return new Date(b.last_active) - new Date(a.last_active);
    });
  };

  // More accurate online detection
  const isUserActuallyOnline = (user) => {
    if (!user.last_active) return false;
    
    const now = new Date();
    const lastActive = new Date(user.last_active);
    const diffInMinutes = Math.floor((now - lastActive) / (1000 * 60));
    
    // Consider user online if last active within 2 minutes
    // and they were marked as online
    return user.is_online && diffInMinutes < 2;
  };

  const subscribeToProfileUpdates = () => {
    const subscription = supabase
      .channel('profile_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profile',
          filter: `id.neq.${currentUserId}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setUsers(prevUsers => {
              const updatedUsers = prevUsers.map(user => {
                if (user.id === payload.new.id) {
                  return {
                    ...user,
                    ...payload.new,
                    is_online: isUserActuallyOnline(payload.new)
                  };
                }
                return user;
              });
              return sortUsersByLastSeen(updatedUsers);
            });
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const startPrivateChat = async (selectedUser) => {
    // Update activity when user performs an action
    updateActivity();

    try {
      if (!currentUserId) return;

      const { data: existingConversation, error } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant_1.eq.${currentUserId},participant_2.eq.${selectedUser.id}),and(participant_1.eq.${selectedUser.id},participant_2.eq.${currentUserId})`)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking conversation:', error);
        Alert.alert('Error', 'Failed to check existing conversation');
        return;
      }

      let conversationId;

      if (existingConversation) {
        conversationId = existingConversation.id;
      } else {
        const { data: newConversation, error: insertError } = await supabase
          .from('conversations')
          .insert({
            participant_1: currentUserId,
            participant_2: selectedUser.id
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Error creating conversation:', insertError);
          Alert.alert('Error', 'Failed to start conversation');
          return;
        }

        conversationId = newConversation.id;
      }

      navigation.navigate('Chat', {
        conversationId,
        recipientId: selectedUser.id,
        chatType: 'private',
        title: selectedUser.surname || selectedUser.name || 'User',
      });
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Error', 'Failed to start conversation');
    }
  };

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.surname?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Enhanced last seen formatter with more precise timing
  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'unknown';
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInSeconds = Math.floor((now - lastSeenDate) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInSeconds < 30) return 'just now';
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    // For older dates, show actual date
    return lastSeenDate.toLocaleDateString();
  };

  const renderUser = ({ item }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => startPrivateChat(item)}
      onPressIn={() => updateActivity()} // Track interaction
    >
      <View style={styles.userInfo}>
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: item.profile_photo_url || 'https://via.placeholder.com/50' }}
            style={styles.avatar}
          />
          {item.is_online && <View style={styles.onlineIndicator} />}
        </View>
        <View style={styles.userDetails}>
          <Text style={styles.name}>{item.surname || item.name || 'User'}</Text>
          <Text style={styles.userStatus}>
            {item.is_online ? 'Online' : `Last seen ${formatLastSeen(item.last_active)}`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search users..."
        value={searchQuery}
        onChangeText={(text) => {
          setSearchQuery(text);
          updateActivity(); // Track typing activity
        }}
        onFocus={() => updateActivity()}
      />

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        refreshing={loading}
        onRefresh={() => {
          updateActivity();
          fetchUsers();
        }}
        onScroll={() => updateActivity()} // Track scrolling
        scrollEventThrottle={5000} // Limit scroll events
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={() => !loading && <Text style={{ textAlign: 'center', marginTop: 20 }}>No users found</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 10 },
  searchInput: {
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    marginHorizontal: 15,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  listContainer: { paddingHorizontal: 15, paddingBottom: 10 },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarContainer: { position: 'relative', marginRight: 15 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#e0e0e0' },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userDetails: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  userStatus: { fontSize: 13, color: '#666', marginTop: 2 },
});