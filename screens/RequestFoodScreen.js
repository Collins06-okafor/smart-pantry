// screens/RequestFoodScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export default function RequestFoodScreen({ navigation, route }) {
  const [itemName, setItemName] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [myRequests, setMyRequests] = useState([]);
  const [editingRequest, setEditingRequest] = useState(null);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState(null);

  const sharerId = route?.params?.sharerId;
  const itemToRequest = route?.params?.item;

  const isValidUUID = (str) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  useEffect(() => {
    if (itemToRequest) {
      setItemName(itemToRequest.item_name);
      setDescription(`I need ${itemToRequest.item_name} as offered by neighbor`);
    }
  }, [itemToRequest]);

  useEffect(() => {
    fetchMyRequests();
  }, []);

  // In the useEffect for real-time updates, add error handling:
useEffect(() => {
  const channel = supabase
    .channel('my_requests_changes')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'food_requests'
    }, (payload) => {
      console.log('Change received:', payload);
      fetchMyRequests();
    })
    .subscribe()
    .on('error', (error) => {
      console.error('Channel error:', error);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, [fetchMyRequests]);

 const fetchMyRequests = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('food_requests')
      .select('*')
      .eq('requester_id', user.id)
      .eq('status', 'active') // Only show active requests
      .order('created_at', { ascending: false });

    if (error) throw error;
    setMyRequests(data || []);
  } catch (err) {
    console.error('Error fetching requests:', err);
    Alert.alert('Error', 'Failed to fetch your requests');
  }
};

  const handleSubmit = async () => {
    if (!itemName.trim()) {
      Alert.alert('Validation Error', 'Item name is required.');
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Error', 'User not authenticated.');
        return;
      }

      const relatedSharerId = isValidUUID(sharerId) ? sharerId : null;
      const relatedItemId = itemToRequest?.id || null;

      if (editingRequest) {
        // Update existing request
        const { error: updateError } = await supabase
          .from('food_requests')
          .update({
            item_name: itemName,
            description: description,
            urgency: urgency,
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', editingRequest.id);

        if (updateError) throw updateError;

        Alert.alert('Request Updated', 'Your food request has been updated successfully!');
        setEditingRequest(null);
      } else {
        // Create new request
        const { data: foodRequest, error: requestError } = await supabase
          .from('food_requests')
          .insert({
            requester_id: user.id,
            item_name: itemName,
            description: description,
            urgency: urgency,
            status: 'active',
            related_sharer_id: relatedSharerId,
            related_item_id: relatedItemId
          })
          .select('id')
          .single();

        if (requestError) throw requestError;

        if (relatedItemId) {
          const { error: connectionError } = await supabase
            .from('request_item_connections')
            .insert({
              request_id: foodRequest.id,
              item_id: relatedItemId,
              requester_id: user.id,
              status: 'pending'
            });

          if (connectionError) throw connectionError;
        }

        Alert.alert('Request Sent', 'Your food request has been posted successfully!');
      }

      setItemName('');
      setDescription('');
      setUrgency('medium');
      fetchMyRequests();
      if (!editingRequest) navigation.goBack(); // Only go back if it was a new request

    } catch (err) {
      console.error('Error posting request:', err.message);
      Alert.alert('Submission Failed', err.message || 'An error occurred while submitting your request');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRequest = (request) => {
    setEditingRequest(request);
    setItemName(request.item_name);
    setDescription(request.description);
    setUrgency(request.urgency);
  };

  const handleDeleteRequest = async () => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('food_requests')
        .delete()
        .eq('id', requestToDelete.id);

      if (error) throw error;

      // Also delete any connections
      await supabase
        .from('request_item_connections')
        .delete()
        .eq('request_id', requestToDelete.id);

      Alert.alert('Request Deleted', 'Your food request has been deleted.');
      fetchMyRequests();
    } catch (err) {
      console.error('Error deleting request:', err);
      Alert.alert('Error', 'Failed to delete request');
    } finally {
      setLoading(false);
      setIsDeleteModalVisible(false);
      setRequestToDelete(null);
    }
  };

  const quickNavigate = (target, params = {}) => {
    navigation.navigate(target, params);
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'high': return '#f44336';
      case 'medium': return '#ff9800';
      case 'low': return '#4caf50';
      default: return '#9e9e9e';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {editingRequest ? 'Edit Request' : 'Request Food'}
        </Text>
        {editingRequest && (
          <TouchableOpacity onPress={() => {
            setEditingRequest(null);
            setItemName('');
            setDescription('');
            setUrgency('medium');
          }}>
            <Text style={styles.cancelEditText}>Cancel Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What do you need?</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Enter food name (e.g. Milk, Rice)"
          value={itemName}
          onChangeText={setItemName}
          placeholderTextColor="#999"
        />
        
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Describe what you need (quantity, preferences, etc.)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          placeholderTextColor="#999"
        />

        <View style={styles.urgencyContainer}>
          <Text style={styles.urgencyLabel}>Urgency:</Text>
          <View style={styles.urgencyOptions}>
            {['high', 'medium', 'low'].map(level => (
              <TouchableOpacity
                key={level}
                style={[styles.urgencyButton, urgency === level && styles.urgencyButtonSelected]}
                onPress={() => setUrgency(level)}
              >
                <Text style={urgency === level ? styles.urgencyTextSelected : styles.urgencyText}>
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && { opacity: 0.7 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Processing...' : editingRequest ? 'Update Request' : 'Submit Request'}
          </Text>
        </TouchableOpacity>
      </View>

      {itemToRequest && (
        <View style={styles.linkedItemCard}>
          <Text style={styles.linkedItemTitle}>Requesting Help For:</Text>
          <Text style={styles.linkedItemName}>{itemToRequest.item_name}</Text>
          <Text style={styles.linkedItemDetail}>Quantity: {itemToRequest.quantity}</Text>
          {itemToRequest.expiration_date && (
            <Text style={styles.linkedItemDetail}>
              Expires: {new Date(itemToRequest.expiration_date).toLocaleDateString()}
            </Text>
          )}
        </View>
      )}

      {/* My Requests Section */}
      {myRequests.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Requests</Text>
          </View>

          <View style={styles.requestsContainer}>
            {myRequests.map(request => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <Text style={styles.requestItemName}>{request.item_name}</Text>
                  <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(request.urgency) }]}>
                    <Text style={styles.urgencyBadgeText}>
                      {request.urgency.charAt(0).toUpperCase() + request.urgency.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.requestDescription}>{request.description}</Text>
                <Text style={styles.requestDate}>
                  Posted: {new Date(request.created_at).toLocaleString()}
                </Text>
                <View style={styles.requestActions}>
                  <TouchableOpacity 
                    style={styles.editButton}
                    onPress={() => handleEditRequest(request)}
                  >
                    <Ionicons name="create" size={18} color="#5a2ca0" />
                    <Text style={styles.editButtonText}> Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.deleteButton}
                    onPress={() => {
                      setRequestToDelete(request);
                      setIsDeleteModalVisible(true);
                    }}
                  >
                    <Ionicons name="trash" size={18} color="#f44336" />
                    <Text style={styles.deleteButtonText}> Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={isDeleteModalVisible}
        onRequestClose={() => setIsDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Request</Text>
            <Text style={styles.modalText}>
              Are you sure you want to delete this request for "{requestToDelete?.item_name}"?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsDeleteModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteButton}
                onPress={handleDeleteRequest}
                disabled={loading}
              >
                <Text style={styles.modalButtonText}>
                  {loading ? 'Deleting...' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Chat & Community</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>

        <TouchableOpacity style={styles.actionCard} onPress={() => quickNavigate('Chat', { chatType: 'general', title: 'Community Chat' })}>
          <View style={styles.actionIconContainer}>
            <Ionicons name="people" size={24} color="#5a2ca0" />
          </View>
          <Text style={styles.actionTitle}>Community Chat</Text>
        </TouchableOpacity>

        {isValidUUID(sharerId) && (
          <TouchableOpacity style={styles.actionCard} onPress={() => quickNavigate('Chat', { recipientId: sharerId, chatType: 'private', title: 'Chat with Sharer' })}>
            <View style={styles.actionIconContainer}>
              <Ionicons name="chatbox" size={24} color="#5a2ca0" />
            </View>
            <Text style={styles.actionTitle}>Private Chat</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionCard} onPress={() => quickNavigate('Chat', { chatType: 'support', title: 'Help & Support' })}>
          <View style={styles.actionIconContainer}>
            <Ionicons name="help-circle" size={24} color="#5a2ca0" />
          </View>
          <Text style={styles.actionTitle}>Help & Support</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => quickNavigate('ConversationList')}>
          <View style={styles.actionIconContainer}>
            <Ionicons name="chatbubbles" size={24} color="#5a2ca0" />
          </View>
          <Text style={styles.actionTitle}>My Conversations</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard} onPress={() => quickNavigate('UserList')}>
          <View style={styles.actionIconContainer}>
            <Ionicons name="people-circle" size={24} color="#5a2ca0" />
          </View>
          <Text style={styles.actionTitle}>Neighbor List</Text>
        </TouchableOpacity>

      </ScrollView>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How it works</Text>
        <Text style={styles.infoText}>
          1. Enter the food item you need {'\n'}
          2. Describe your request in detail {'\n'}
          3. Set urgency level {'\n'}
          4. Submit your request {'\n'}
          5. Neighbors will respond with offers or chat with you
        </Text>
      </View>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 15 },
  input: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 10, marginBottom: 15, fontSize: 16, color: '#333' },
  notesInput: { height: 100, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#5a2ca0', paddingVertical: 16, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  submitButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  horizontalScroll: { marginBottom: 20 },
  actionCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: 150, marginRight: 15, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  actionIconContainer: { backgroundColor: '#f0e6ff', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  actionTitle: { fontSize: 14, fontWeight: '600', color: '#333', textAlign: 'center' },
  infoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 20, marginBottom: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  infoTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  infoText: { fontSize: 14, color: '#666', lineHeight: 22 },
  linkedItemCard: { backgroundColor: '#e8f5e9', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#c8e6c9' },
  linkedItemTitle: { fontSize: 14, fontWeight: 'bold', color: '#2e7d32', marginBottom: 8 },
  linkedItemName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 4 },
  linkedItemDetail: { fontSize: 14, color: '#666', marginBottom: 4 },
  urgencyContainer: { marginBottom: 15 },
  urgencyLabel: { fontSize: 14, color: '#666', marginBottom: 8 },
  urgencyOptions: { flexDirection: 'row', justifyContent: 'space-between' },
  urgencyButton: { flex: 1, padding: 10, marginHorizontal: 4, borderRadius: 8, backgroundColor: '#f5f5f5', alignItems: 'center' },
  urgencyButtonSelected: { backgroundColor: '#5a2ca0' },
  urgencyText: { color: '#666', fontWeight: '500' },
  urgencyTextSelected: { color: '#fff', fontWeight: '500' },

  // New styles for the requests section
  requestsContainer: {
    marginBottom: 20,
  },
  requestCard: {
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
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  requestDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  requestDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  requestActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButtonText: {
    color: '#5a2ca0',
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#f44336',
    fontWeight: '500',
  },
  cancelEditText: {
    color: '#5a2ca0',
    fontWeight: '500',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  modalText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelButton: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalDeleteButton: {
    backgroundColor: '#f44336',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
});
