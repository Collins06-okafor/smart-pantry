// UserListScreen.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Image, Alert
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function UserListScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchUsers();
    }
  }, [currentUserId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchUsers = async () => {
    if (!currentUserId) return;

    setLoading(true);
   const { data, error } = await supabase
    .from('profile')
    .select('id, name, surname, profile_photo_url, is_online, last_active')
    .neq('id', currentUserId)
    .order('is_online', { ascending: false })
    .order('name');


    if (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to load users');
      setLoading(false);
      return;
    }

    setUsers(data || []);
    setLoading(false);
  };

  const startPrivateChat = async (selectedUser) => {
    try {
      if (!currentUserId) return;

      // Check existing conversation
      const { data: existingConversation, error } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant_1.eq.${currentUserId},participant_2.eq.${selectedUser.id}),and(participant_1.eq.${selectedUser.id},participant_2.eq.${currentUserId})`)
        .single();

      if (error && error.code !== 'PGRST116') { // ignore "no rows found" error
        console.error('Error checking conversation:', error);
        Alert.alert('Error', 'Failed to check existing conversation');
        return;
      }

      let conversationId;

      if (existingConversation) {
        conversationId = existingConversation.id;
      } else {
        // Create new conversation
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

      // Navigate to chat screen
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

  const renderUser = ({ item }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => startPrivateChat(item)}
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

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'unknown';
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));

    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search users..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        refreshing={loading}
        onRefresh={fetchUsers}
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
