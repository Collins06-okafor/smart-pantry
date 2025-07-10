import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
  StyleSheet,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function ChatScreen({ route, navigation }) {
  const { recipientId, chatType = 'private', title } = route.params || {};
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (title) {
      navigation.setOptions({ title });
    }

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        await fetchMessages(user.id);
        subscribeToMessages(user.id);
      }
      setLoading(false);
    })();

    const keyboardDidShow = Keyboard.addListener('keyboardDidShow', e => {
      setKeyboardHeight(e.endCoordinates.height);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    const keyboardDidHide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardDidShow.remove();
      keyboardDidHide.remove();
    };
  }, []);

  const fetchMessages = async (userId) => {
  let query = supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true });

  if (chatType === 'private' && recipientId) {
    query = query.or(`and(sender_id.eq.${userId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${userId})`);
  } else if (chatType === 'general') {
    query = query.is('recipient_id', null);
  } else if (chatType === 'support') {
    query = query.or(`and(sender_id.eq.${userId},chat_type.eq.support),and(recipient_id.eq.${userId},chat_type.eq.support)`);
  }

  const { data, error } = await query;
  if (!error && data) {
    const filtered = data.filter(m => {
      const messageDate = new Date(m.created_at);
      return Date.now() - messageDate.getTime() <= 2 * 24 * 60 * 60 * 1000; // within 2 days
    });
    setMessages(filtered);
  } else {
    console.error('Fetch messages error:', error);
  }
};


  const subscribeToMessages = (userId) => {
    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new;
        let shouldShow = false;

        if (chatType === 'private' && recipientId) {
          shouldShow = (m.sender_id === userId && m.recipient_id === recipientId) ||
                       (m.sender_id === recipientId && m.recipient_id === userId);
        } else if (chatType === 'general') {
          shouldShow = m.recipient_id === null;
        } else if (chatType === 'support') {
          shouldShow = (m.sender_id === userId && m.chat_type === 'support') ||
                       (m.recipient_id === userId && m.chat_type === 'support');
        }

        if (shouldShow) {
  const isFresh = Date.now() - new Date(m.created_at).getTime() <= 2 * 24 * 60 * 60 * 1000;
  if (isFresh) {
    setMessages(prev => [...prev, m]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }
}

      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    const tempMessage = {
      id: Date.now(), // temporary unique ID
      sender_id: userId,
      message: message.trim(),
      chat_type: chatType,
      recipient_id: chatType === 'private' ? recipientId :
                    chatType === 'support' ? 'support' : null,
      created_at: new Date().toISOString(),
    };

    // Optimistically update UI
    setMessages(prev => [...prev, tempMessage]);
    setMessage('');

    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: tempMessage.sender_id,
        message: tempMessage.message,
        chat_type: tempMessage.chat_type,
        recipient_id: tempMessage.recipient_id,
      });

      if (error) {
        console.error('Send error:', error);
        Alert.alert('Error', 'Failed to send message');
      }
    } catch (err) {
      console.error('Unexpected send error:', err);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  const renderMessage = ({ item }) => {
    const isMyMessage = item.sender_id === userId;

    return (
      <View style={[
        styles.messageContainer,
        isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isMyMessage ? styles.myMessage : styles.theirMessage
        ]}>
          {chatType === 'general' && !isMyMessage && (
            <Text style={styles.senderName}>{item.sender_name || 'Anonymous'}</Text>
          )}
          <Text style={isMyMessage ? styles.myMessageText : styles.theirMessageText}>
            {item.message}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  const renderChatHeader = () => {
    if (chatType === 'general') {
      return (
        <View style={styles.headerInfo}>
          <Text style={styles.headerText}>🌐 Community Chat</Text>
          <Text style={styles.headerSubtext}>Connect with the community</Text>
        </View>
      );
    } else if (chatType === 'support') {
      return (
        <View style={styles.headerInfo}>
          <Text style={styles.headerText}>🆘 Support Chat</Text>
          <Text style={styles.headerSubtext}>We're here to help</Text>
        </View>
      );
    } else if (chatType === 'private') {
      return (
        <View style={styles.headerInfo}>
          <Text style={styles.headerText}>💬 Private Chat</Text>
          <Text style={styles.headerSubtext}>Direct conversation</Text>
        </View>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading chat...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {renderChatHeader()}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMessage}
        style={styles.messagesList}
        onContentSizeChange={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }}
        onLayout={() => {
          if (messages.length > 0) {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }, 100);
          }
        }}
      />

      <View style={styles.infoNoteContainer}>
  <Text style={styles.infoNote}>
    Messages older than 2 days are automatically cleared.
  </Text>
</View>


      <View style={[styles.inputContainer, Platform.OS === 'android' && keyboardHeight > 0 && { marginBottom: keyboardHeight }]}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          style={styles.input}
          placeholder={
            chatType === 'general' ? 'Message the community...' :
            chatType === 'support' ? 'How can we help you?' :
            'Type a message...'
          }
          multiline
          maxLength={500}
          onFocus={() => {
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
          }}
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
  messageBubble: { padding: 12, borderRadius: 16, maxWidth: '100%' },
  myMessage: { backgroundColor: '#007AFF', borderBottomRightRadius: 4 },
  theirMessage: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  myMessageText: { color: '#fff', fontSize: 16, lineHeight: 20 },
  theirMessageText: { color: '#333', fontSize: 16, lineHeight: 20 },
  senderName: { fontSize: 12, fontWeight: 'bold', color: '#666', marginBottom: 4 },
  timestamp: { fontSize: 11, opacity: 0.7, marginTop: 4, textAlign: 'right' },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0' },
  input: { flex: 1, borderColor: '#ddd', borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, marginRight: 12, maxHeight: 100, fontSize: 16, backgroundColor: '#f9f9f9' },
  sendButton: { backgroundColor: '#007AFF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendButtonDisabled: { backgroundColor: '#ccc' },
  sendButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  infoNoteContainer: {
  alignItems: 'center',
  paddingBottom: 8,
  backgroundColor: '#f5f5f5',
},
infoNote: {
  fontSize: 12,
  color: '#999',
  fontStyle: 'italic',
},

});
