// ChatScreen.js
import React, { useEffect, useState, useRef } from 'react';
import {
  View, TextInput, TouchableOpacity, Text, FlatList, KeyboardAvoidingView,
  Platform, Keyboard, Alert, StyleSheet,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { TouchableWithoutFeedback } from 'react-native';

export default function ChatScreen({ route, navigation }) {
  const { recipientId, chatType = 'private', title } = route.params || {};
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);

  useEffect(() => {
    if (title) navigation.setOptions({ title });

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        await fetchMessages(user.id);
        subscribeToMessages(user.id);
      }
      setLoading(false);
    })();
  }, []);

  const fetchMessages = async (userId) => {
    let query = supabase.from('messages').select('*').order('created_at', { ascending: true });

    if (chatType === 'private' && recipientId) {
      query = query.or(`and(sender_id.eq.${userId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${userId})`);
    } else if (chatType === 'general') {
      query = query.is('recipient_id', null).eq('chat_type', 'general');
    } else if (chatType === 'support') {
      query = query.or(`and(sender_id.eq.${userId},chat_type.eq.support),and(recipient_id.eq.${userId},chat_type.eq.support)`);
    }

    const { data, error } = await query;
    if (!error && data) {
      const recent = data.filter(m => Date.now() - new Date(m.created_at).getTime() <= 2 * 24 * 60 * 60 * 1000);
      setMessages(recent);
    } else {
      console.error('Fetch messages error:', error);
    }
  };

  const subscribeToMessages = (userId) => {
    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new;
        let show = false;

        if (chatType === 'private' && recipientId) {
          show = (m.sender_id === userId && m.recipient_id === recipientId) ||
                 (m.sender_id === recipientId && m.recipient_id === userId);
        } else if (chatType === 'general') {
          show = m.recipient_id === null && m.chat_type === 'general';
        } else if (chatType === 'support') {
          show = (m.sender_id === userId && m.chat_type === 'support') ||
                 (m.recipient_id === userId && m.chat_type === 'support');
        }

        if (show) {
          const fresh = Date.now() - new Date(m.created_at).getTime() <= 2 * 24 * 60 * 60 * 1000;
          if (fresh) {
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

    const tempMsg = {
      id: Date.now(),
      sender_id: userId,
      message: message.trim(),
      chat_type: chatType,
      recipient_id: chatType === 'private' ? recipientId : null,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, tempMsg]);
    setMessage('');

    try {
      const { error } = await supabase.from('messages').insert({
        sender_id: tempMsg.sender_id,
        message: tempMsg.message,
        chat_type: tempMsg.chat_type,
        recipient_id: tempMsg.recipient_id,
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
    const isMine = item.sender_id === userId;
    return (
      <View style={[
        styles.messageContainer,
        isMine ? styles.myMessageContainer : styles.theirMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isMine ? styles.myMessage : styles.theirMessage
        ]}>
          <Text style={isMine ? styles.myMessageText : styles.theirMessageText}>
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
    if (chatType === 'general') return <Header title="🌐 Community Chat" subtitle="Connect with the community" />;
    if (chatType === 'support') return <Header title="🆘 Support Chat" subtitle="We're here to help" />;
    if (chatType === 'private') return <Header title="💬 Private Chat" subtitle="Direct conversation" />;
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
  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {renderChatHeader()}

      {chatType !== 'support' && (
  <View style={styles.infoNoteContainer}>
    <Text style={styles.infoNote}>
      This chat only shows messages from the last 2 days.
    </Text>
  </View>
)}


      <FlatList
        ref={flatListRef}
        data={[...messages].reverse()} // Reverse the array to use inverted
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMessage}
        style={styles.messagesList}
        inverted={true}
      />

      <View style={styles.inputContainer}>
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

const Header = ({ title, subtitle }) => (
  <View style={styles.headerInfo}>
    <Text style={styles.headerText}>{title}</Text>
    <Text style={styles.headerSubtext}>{subtitle}</Text>
  </View>
);

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
});
