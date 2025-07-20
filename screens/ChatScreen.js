// ChatScreen.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View, TextInput, TouchableOpacity, Text, FlatList, KeyboardAvoidingView,
  Platform, Keyboard, Alert, StyleSheet, Image
} from 'react-native';
import { supabase } from '../lib/supabase';
import { TouchableWithoutFeedback } from 'react-native';

export default function ChatScreen({ route, navigation }) {
  const { conversationId, recipientId, chatType = 'private', title } = route.params || {};
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recipientInfo, setRecipientInfo] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (title) navigation.setOptions({ title });
    initializeChat();
  }, []);

  const initializeChat = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      
      if (chatType === 'private' && recipientId) {
        await fetchRecipientInfo(recipientId);
      }
      
      await fetchMessages(user.id);
      subscribeToMessages(user.id);
      subscribeToTyping();
      
      // Mark messages as read
      if (conversationId) {
        await markMessagesAsRead(user.id);
      }
    }
    setLoading(false);
  };

  const fetchRecipientInfo = async (recipientId) => {
    const { data, error } = await supabase
      .from('profile')
      .select('id, surname, name, avatar_url, is_online')
      .eq('id', recipientId)
      .single();
    
    if (data) {
      setRecipientInfo(data);
      navigation.setOptions({ title: data.surname || data.name });
    }
  };

  const fetchMessages = async (userId) => {
    let query = supabase
      .from('messages')
      .select(`
        *,
        profile!sender_id(surname, name, avatar_url)
      `)
      .order('created_at', { ascending: true });

    if (chatType === 'private' && conversationId) {
      query = query.eq('conversation_id', conversationId);
    } else if (chatType === 'general') {
      query = query.is('recipient_id', null).eq('chat_type', 'general');
    } else if (chatType === 'support') {
      query = query.or(`and(sender_id.eq.${userId},chat_type.eq.support),and(recipient_id.eq.${userId},chat_type.eq.support)`);
    }

    const { data, error } = await query;
    if (!error && data) {
      setMessages(data);
    } else {
      console.error('Fetch messages error:', error);
    }
  };

  const subscribeToMessages = (userId) => {
    const channel = supabase
      .channel('messages')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' }, 
        async (payload) => {
          const newMessage = payload.new;
          
          // Get sender profile info
          const { data: senderProfile } = await supabase
            .from('profile')
            .select('surname, name, avatar_url')
            .eq('id', newMessage.sender_id)
            .single();

          const messageWithProfile = {
            ...newMessage,
            profile: senderProfile
          };

          let shouldShow = false;

          if (chatType === 'private' && conversationId) {
            shouldShow = newMessage.conversation_id === conversationId;
          } else if (chatType === 'general') {
            shouldShow = newMessage.recipient_id === null && newMessage.chat_type === 'general';
          } else if (chatType === 'support') {
            shouldShow = (newMessage.sender_id === userId && newMessage.chat_type === 'support') ||
                        (newMessage.recipient_id === userId && newMessage.chat_type === 'support');
          }

          if (shouldShow) {
            setMessages(prev => [...prev, messageWithProfile]);
            
            // Mark as read if it's not from current user
            if (newMessage.sender_id !== userId) {
              await supabase
                .from('messages')
                .update({ is_read: true })
                .eq('id', newMessage.id);
            }
            
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const subscribeToTyping = () => {
    if (!conversationId) return;

    const channel = supabase
      .channel('typing')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'typing_indicators' }, 
        (payload) => {
          const typingData = payload.new;
          if (typingData.conversation_id === conversationId && typingData.user_id !== userId) {
            setOtherUserTyping(typingData.is_typing);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const markMessagesAsRead = async (userId) => {
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId);
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    const messageData = {
  sender_id: userId,
  message: message.trim(), // ✅ This matches your DB schema
  chat_type: chatType,
  conversation_id: chatType === 'private' ? conversationId : null,
  recipient_id: chatType === 'private' ? recipientId : null,
};



    // Clear typing indicator
    await updateTypingStatus(false);

    // Add optimistic message
    const optimisticMessage = {
  ...messageData,
  id: Date.now(),
  created_at: new Date().toISOString(),
  profile: { surname: 'You' },
};


    setMessages(prev => [...prev, optimisticMessage]);
    setMessage('');

    try {
      const { error } = await supabase.from('messages').insert(messageData);
      
      if (error) {
        console.error('Send error:', error);
        Alert.alert('Error', 'Failed to send message');
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== optimisticMessage.id));
      } else {
        // Update conversation timestamp
        if (conversationId) {
          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        }
      }
    } catch (err) {
      console.error('Unexpected send error:', err);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const updateTypingStatus = async (typing) => {
    if (!conversationId) return;

    if (typing) {
      await supabase
        .from('typing_indicators')
        .upsert({
          conversation_id: conversationId,
          user_id: userId,
          is_typing: true,
          updated_at: new Date().toISOString()
        });
    } else {
      await supabase
        .from('typing_indicators')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);
    }
  };

  const handleTextChange = (text) => {
    setMessage(text);

    if (text.trim() && !isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, 1000);
  };

  const renderMessage = ({ item }) => {
    const isMine = item.sender_id === userId;
    const senderName = item.profile?.surname || item.profile?.name || 'Unknown';
    
    return (
      <View style={[
        styles.messageContainer,
        isMine ? styles.myMessageContainer : styles.theirMessageContainer
      ]}>
        {!isMine && (
          <Image
            source={{ uri: item.profile?.avatar_url || 'https://via.placeholder.com/30' }}
            style={styles.messageAvatar}
          />
        )}
        
        <View style={[
          styles.messageBubble,
          isMine ? styles.myMessage : styles.theirMessage
        ]}>
          {!isMine && chatType !== 'private' && (
            <Text style={styles.senderName}>{senderName}</Text>
          )}
          <Text style={isMine ? styles.myMessageText : styles.theirMessageText}>
            {item.content || item.message}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading chat...</Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
  ref={flatListRef}
  data={messages}
  keyExtractor={(item) => item.id.toString()}
  renderItem={renderMessage}
  style={styles.messagesList}
  onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
  ListEmptyComponent={
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>Start the conversation!</Text>
    </View>
  }
/>


        {otherUserTyping && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>
              {recipientInfo?.surname || 'Someone'} is typing...
            </Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            value={message}
            onChangeText={handleTextChange}
            style={styles.input}
            placeholder="Type a message..."
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!message.trim()}
          >
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e0e0e0', alignItems: 'center' },
  headerText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  headerSubtext: { fontSize: 14, color: '#666', marginTop: 4 },
  messagesList: { flex: 1, paddingHorizontal: 16 },
  messageContainer: { marginVertical: 4, maxWidth: '80%' },
  myMessageContainer: { alignSelf: 'flex-end' },
  theirMessageContainer: { alignSelf: 'flex-start' },
  messageBubble: { padding: 12, borderRadius: 16 },
  myMessage: { backgroundColor: '#007AFF', borderBottomRightRadius: 4 },
  theirMessage: { backgroundColor: '#fff', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1, elevation: 1 },
  myMessageText: { color: '#fff', fontSize: 16 },
  theirMessageText: { color: '#333', fontSize: 16 },
  timestamp: { fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: 'right' },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  input: { flex: 1, borderColor: '#ddd', borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, maxHeight: 100, fontSize: 16, backgroundColor: '#f9f9f9' },
  sendButton: { backgroundColor: '#007AFF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
  sendButtonDisabled: { backgroundColor: '#ccc' },
  sendButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  infoNoteContainer: { alignItems: 'center', paddingBottom: 8 },
  infoNote: { fontSize: 12, color: '#999', fontStyle: 'italic' },
  messageAvatar: { width: 30, height: 30, borderRadius: 15, marginRight: 8 },
  senderName: { fontSize: 12, fontWeight: '600', color: '#666', marginBottom: 4 },
  typingIndicator: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff' },
  typingText: { fontSize: 12, color: '#666', fontStyle: 'italic' },
  emptyContainer: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 20
},
emptyText: {
  fontSize: 14,
  color: '#999',
  fontStyle: 'italic'
}

});