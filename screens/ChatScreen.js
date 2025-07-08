import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  TextInput, 
  Button, 
  FlatList, 
  Text, 
  StyleSheet, 
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard
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
    // Set the header title if provided
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

    // Keyboard event listeners
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Scroll to bottom when keyboard appears
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  const fetchMessages = async (userId) => {
    let query = supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (chatType === 'private' && recipientId) {
      // Private chat between two users
      query = query.or(`and(sender_id.eq.${userId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${userId})`);
    } else if (chatType === 'general') {
      // Community chat - messages where recipient_id is null
      query = query.is('recipient_id', null);
    } else if (chatType === 'support') {
      // Support chat - messages to/from support team
      query = query.or(`and(sender_id.eq.${userId},chat_type.eq.support),and(recipient_id.eq.${userId},chat_type.eq.support)`);
    }

    const { data, error } = await query;
    if (!error && data) {
      setMessages(data);
    } else if (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const subscribeToMessages = (userId) => {
    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new;
        
        let shouldShow = false;
        
        if (chatType === 'private' && recipientId) {
          // Show if it's between current user and recipient
          shouldShow = (m.sender_id === userId && m.recipient_id === recipientId) ||
                      (m.sender_id === recipientId && m.recipient_id === userId);
        } else if (chatType === 'general') {
          // Show if it's a general message (recipient_id is null)
          shouldShow = m.recipient_id === null;
        } else if (chatType === 'support') {
          // Show if it's a support message involving current user
          shouldShow = (m.sender_id === userId && m.chat_type === 'support') ||
                      (m.recipient_id === userId && m.chat_type === 'support');
        }

        if (shouldShow) {
          setMessages((prev) => [...prev, m]);
          // Auto-scroll to bottom for new messages
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    try {
      const messageData = {
        sender_id: userId,
        message: message.trim(),
        chat_type: chatType,
      };

      // Set recipient based on chat type
      if (chatType === 'private' && recipientId) {
        messageData.recipient_id = recipientId;
      } else if (chatType === 'general') {
        messageData.recipient_id = null; // Public message
      } else if (chatType === 'support') {
        messageData.recipient_id = 'support'; // Support team identifier
      }

      const { error } = await supabase.from('messages').insert(messageData);
      
      if (error) {
        console.error('Error sending message:', error);
        Alert.alert('Error', 'Failed to send message');
      } else {
        setMessage('');
      }
    } catch (error) {
      console.error('Send message error:', error);
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
            <Text style={styles.senderName}>
              {item.sender_name || 'Anonymous'}
            </Text>
          )}
          <Text style={[
            styles.messageText,
            isMyMessage ? styles.myMessageText : styles.theirMessageText
          ]}>
            {item.message}
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
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          // Auto-scroll to bottom when messages load
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }}
        onLayout={() => {
          // Auto-scroll to bottom when layout changes
          if (messages.length > 0) {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }, 100);
          }
        }}
      />
      
      <View style={[
        styles.inputContainer,
        Platform.OS === 'android' && keyboardHeight > 0 && {
          marginBottom: keyboardHeight
        }
      ]}>
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
            // Scroll to bottom when input is focused
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 300);
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
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  theirMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '100%',
  },
  myMessage: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#333',
  },
  senderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 11,
    opacity: 0.7,
    marginTop: 4,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  input: {
    flex: 1,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});