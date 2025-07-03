import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export default function PantryScreen({ navigation }) {
  const [pantryItems, setPantryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState({
    id: null,
    item_name: '',
    quantity: '',
    expiration_date: '',
  });

  useEffect(() => {
    fetchPantryItems();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPantryItems();
    }, [])
  );

  const fetchPantryItems = async () => {
    if (!refreshing) setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setPantryItems([]);
        return;
      }

      const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', user.id)
        .order('expiration_date', { ascending: true });

      if (error) {
        console.error('Fetch error:', error.message);
        setPantryItems([]);
      } else {
        const validItems = Array.isArray(data)
          ? data.filter(item => item && item.item_name)
          : [];
        setPantryItems(validItems);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setPantryItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPantryItems();
  }, []);

  const handleDelete = (item) => {
    Alert.alert(
      "Delete Item",
      `Are you sure you want to delete "${item.item_name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteItem(item.id),
        },
      ]
    );
  };

  const deleteItem = async (itemId) => {
  console.log('Attempting to delete item with ID:', itemId);
  console.log('Item ID type:', typeof itemId);
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current user:', user?.id);
    console.log('User ID type:', typeof user?.id);
    
    if (!user?.id) {
      Alert.alert("Error", "User not authenticated");
      return;
    }
    
    const { data, error } = await supabase
      .from('pantry_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', user.id);

    console.log('Delete response:', { data, error });

    if (error) {
      console.error('Delete error details:', error);
      Alert.alert("Error", `Failed to delete item: ${error.message}`);
    } else {
      console.log('Delete successful, refreshing data');
      fetchPantryItems();
    }
  } catch (err) {
    console.error('Unexpected delete error:', err);
    Alert.alert("Error", "An unexpected error occurred.");
  }
};

  const handleEdit = (item) => {
    setEditForm({
      id: item.id,
      item_name: item.item_name || '',
      quantity: String(item.quantity || ''),
      expiration_date: item.expiration_date || '',
    });
    setEditModalVisible(true);
  };

  const cancelEdit = () => {
    setEditModalVisible(false);
    setEditForm({ id: null, item_name: '', quantity: '', expiration_date: '' });
  };

  const saveEdit = async () => {
  console.log('Attempting to save edit:', editForm);
  console.log('Edit form ID type:', typeof editForm.id);
  
  if (!editForm.item_name || !editForm.quantity || !editForm.expiration_date) {
    Alert.alert("Missing Fields", "Please fill in all fields.");
    return;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current user:', user?.id);
    console.log('User ID type:', typeof user?.id);
    
    if (!user?.id) {
      Alert.alert("Error", "User not authenticated");
      return;
    }
    
    const updateData = {
      item_name: editForm.item_name,
      quantity: parseInt(editForm.quantity) || 0,
      expiration_date: editForm.expiration_date,
    };
    
    console.log('Update data:', updateData);
    console.log('Updating item with ID:', editForm.id);

    const { data, error } = await supabase
      .from('pantry_items')
      .update(updateData)
      .eq('id', editForm.id)
      .eq('user_id', user.id)
      .select();

    console.log('Update response:', { data, error });

    if (error) {
      console.error('Update error details:', error);
      Alert.alert("Error", `Failed to update item: ${error.message}`);
    } else {
      console.log('Update successful, refreshing data');
      fetchPantryItems();
      cancelEdit();
    }
  } catch (err) {
    console.error('Unexpected update error:', err);
    Alert.alert("Error", "An unexpected error occurred.");
  }
};

  const renderItem = ({ item }) => {
    const formatDate = (dateString) => {
      if (!dateString) return 'N/A';
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      } catch {
        return dateString;
      }
    };

    const isExpiringSoon = (dateString) => {
      try {
        const expiration = new Date(dateString);
        const today = new Date();
        const threeDays = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
        return expiration <= threeDays;
      } catch {
        return false;
      }
    };

    const isExpiring = isExpiringSoon(item.expiration_date);

    return (
      <View style={[styles.item, isExpiring && styles.itemExpiring]}>
        <View style={styles.itemContent}>
          <Text style={styles.name}>{item.item_name}</Text>
          <Text style={styles.detail}>Quantity: {item.quantity}</Text>
          <Text style={[styles.detail, isExpiring && styles.expiringText]}>
            Expires: {formatDate(item.expiration_date)}
          </Text>
          {isExpiring && <Text style={styles.warningText}>⚠️ Expiring Soon!</Text>}
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity style={styles.editButton} onPress={() => handleEdit(item)}>
            <Text style={styles.editButtonText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C897" />
        <Text style={styles.loadingText}>Loading your pantry...</Text>
      </View>
    );
  }

  if (!pantryItems.length) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Your pantry is empty. Add some items!</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddItem')}
        >
          <Text style={styles.addButtonText}>➕ Add Item</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Pantry ({pantryItems.length} items)</Text>
      <FlatList
        data={pantryItems}
        keyExtractor={(item) => item.id?.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 30 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#00C897']}
          />
        }
      />

      {/* ✏️ Edit Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={editModalVisible}
        onRequestClose={cancelEdit}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Item</Text>

            <Text style={styles.label}>Item Name</Text>
            <TextInput
              style={styles.input}
              value={editForm.item_name}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, item_name: text }))}
            />

            <Text style={styles.label}>Quantity</Text>
            <TextInput
              style={styles.input}
              value={editForm.quantity}
              keyboardType="numeric"
              onChangeText={(text) => setEditForm(prev => ({ ...prev, quantity: text }))}
            />

            <Text style={styles.label}>Expiration Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={editForm.expiration_date}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, expiration_date: text }))}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={cancelEdit}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveEdit}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20,
    backgroundColor: '#f5f5f5'
  },
  centered: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 15,
    color: '#333'
  },
  item: {
    backgroundColor: '#e0f2f1',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#00C897',
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemExpiring: {
    backgroundColor: '#fff3e0',
    borderLeftColor: '#ff9800',
  },
  itemContent: {
    flex: 1,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: { 
    fontSize: 16, 
    fontWeight: 'bold',
    color: '#333'
  },
  detail: { 
    fontSize: 14, 
    color: '#666',
    marginTop: 4
  },
  expiringText: {
    color: '#ff9800',
    fontWeight: '600'
  },
  warningText: {
    fontSize: 12,
    color: '#ff9800',
    fontWeight: 'bold',
    marginTop: 4
  },
  editButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  editButtonText: {
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  empty: {
    fontSize: 18,
    textAlign: 'center',
    color: '#666',
    marginBottom: 10
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    color: '#999',
    marginBottom: 20
  },
  addButton: {
    backgroundColor: '#00C897',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    backgroundColor: '#f44336',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#00C897',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});