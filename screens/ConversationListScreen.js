// ConversationListScreen.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Image
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function ConversationListScreen({ navigation }) {
  const [conversations, setConversations] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchConversations();
      const cleanup = subscribeToConversations();
      return cleanup;
    }
  }, [currentUserId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchConversations = async () => {
   const { data, error } = await supabase
  .from('conversations')
  .select(`
    id,
    participant_1,
    participant_2,
    updated_at,
    participant1:profile!conversations_participant_1_fkey(id, surname, name, avatar_url, is_online),
    participant2:profile!conversations_participant_2_fkey(id, surname, name, avatar_url, is_online)
  `)
  .or(`participant_1.eq.${currentUserId},participant_2.eq.${currentUserId}`)
  .order('updated_at', { ascending: false });


    if (error) {
      console.error('Error fetching conversations:', error);
      return;
    }
    if (!data) return;

    // Fetch last message and unread count for each conversation
    const conversationsWithMeta = await Promise.all(data.map(async (conv) => {
      const { data: lastMessage } = await supabase
        .from('messages')
        .select('content, created_at, sender_id')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { count: unreadCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .eq('is_read', false)
        .neq('sender_id', currentUserId);

      return {
        ...conv,
        lastMessage,
        unreadCount: unreadCount || 0,
      };
    }));

    setConversations(conversationsWithMeta);
  };

  const subscribeToConversations = () => {
    const channel = supabase
      .channel('conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetchConversations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchConversations)
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const getOtherParticipant = (conversation) => {
  if (conversation.participant_1 === currentUserId) {
    return conversation.participant2;
  } else {
    return conversation.participant1;
  }
};


  const renderConversation = ({ item }) => {
    const otherUser = getOtherParticipant(item);
    if (!otherUser) return null;

    const lastMessage = item.lastMessage;

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => navigation.navigate('Chat', {
          conversationId: item.id,
          recipientId: otherUser.id,
          chatType: 'private',
          title: otherUser.surname || otherUser.name || 'User',
        })}
      >
        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: otherUser.avatar_url || 'https://via.placeholder.com/50' }}
            style={styles.avatar}
          />
          {otherUser.is_online && <View style={styles.onlineIndicator} />}
        </View>

        <View style={styles.conversationInfo}>
          <Text style={styles.surname}>{otherUser.surname || otherUser.name || 'User'}</Text>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {lastMessage ? lastMessage.content : 'No messages yet'}
          </Text>
        </View>

        <View style={styles.conversationMeta}>
          <Text style={styles.timestamp}>
            {lastMessage ? formatTime(lastMessage.created_at) : ''}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 10 },
  listContainer: { paddingHorizontal: 15, paddingBottom: 10 },
  conversationItem: {
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
  conversationInfo: { flex: 1, marginRight: 10 },
  surname: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  lastMessage: { fontSize: 13, color: '#666', marginTop: 2 },
  conversationMeta: { alignItems: 'flex-end' },
  timestamp: { fontSize: 12, color: '#999', marginBottom: 5 },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadCount: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
});
