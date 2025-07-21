import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { registerForPushNotificationsAsync } from '../lib/notifications'; // Assuming this function exists

const OFFER_STATUSES = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
};

const REQUEST_STATUSES = {
  ACTIVE: 'active',
  FULFILLED: 'fulfilled',
  CANCELLED: 'cancelled',
};

export default function OffersScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [myRequests, setMyRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [responseType, setResponseType] = useState(null); // 'accept' or 'decline'

  // Initialize user
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUser(user);
      } catch (error) {
        console.error('Error getting user:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeUser();
  }, []);

  // Fetch user's food requests with offers
  const fetchMyRequestsWithOffers = useCallback(async () => {
    if (!currentUser) return;

    try {
      // Get user's food requests - only active ones
      const { data: requests, error: requestsError } = await supabase
        .from('food_requests')
        .select('*')
        .eq('requester_id', currentUser.id)
        .eq('status', REQUEST_STATUSES.ACTIVE) // Only fetch active requests
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      if (!requests || requests.length === 0) {
        setMyRequests([]);
        return;
      }

      // Get offers for these requests - only show pending offers
      const requestIds = requests.map(req => req.id);
      const { data: offers, error: offersError } = await supabase
        .from('food_request_offers')
        .select('*')
        .in('request_id', requestIds)
        .eq('status', OFFER_STATUSES.PENDING) // Only fetch pending offers
        .order('offered_at', { ascending: false });

      if (offersError) throw offersError;

      // Get helper profiles separately if offers exist
      let helperProfiles = [];
      if (offers && offers.length > 0) {
        const helperIds = [...new Set(offers.map(offer => offer.helper_id))];
        
        const { data: profilesData, error: profilesErr } = await supabase
          .from('profile')  // Using 'profile' table (singular)
          .select('id, name, email, profile_photo_url')
          .in('id', helperIds);

        if (!profilesErr && profilesData) {
          helperProfiles = profilesData;
        } else {
          // Fallback if profile table doesn't work
          const { data: authUsersData, error: authUsersErr } = await supabase
            .from('auth.users')
            .select('id, email')
            .in('id', helperIds);

          if (!authUsersErr && authUsersData) {
            helperProfiles = authUsersData.map(user => ({
              id: user.id,
              name: user.email.split('@')[0], // Use email prefix as name fallback
              email: user.email,
              profile_photo_url: null
            }));
          }
        }
      }

      // Combine requests with their offers and profiles
      const requestsWithOffers = requests.map(request => ({
        ...request,
        offers: offers ? offers.filter(offer => offer.request_id === request.id).map(offer => ({
          ...offer,
          profile: helperProfiles.find(profile => profile.id === offer.helper_id) || {
            id: offer.helper_id,
            name: 'Anonymous Helper',
            email: null,
            profile_photo_url: null
          }
        })) : []
      }));

      setMyRequests(requestsWithOffers);
    } catch (error) {
      console.error('Error fetching requests with offers:', error);
      Alert.alert('Error', 'Failed to load offers. Please try again.');
    }
  }, [currentUser]);

  // Realtime subscription for updates
  useEffect(() => {
    const channel = supabase
      .channel('offers_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'food_requests'
      }, () => {
        fetchMyRequestsWithOffers();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'food_request_offers'
      }, () => {
        fetchMyRequestsWithOffers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMyRequestsWithOffers]);

  const renderOffer = ({ item: offer }) => (
    <View style={styles.offerCard}>
      <View style={styles.offerHeader}>
        <View style={styles.helperInfo}>
          {offer.profile?.profile_photo_url? (
            <Image 
              source={{ uri: offer.profile.profile_photo_url }} 
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Text style={styles.profileImageText}>
                {offer.profile?.name ? offer.profile.name.charAt(0).toUpperCase() : '?'}
              </Text>
            </View>
          )}
          <View style={styles.helperDetails}>
            <Text style={styles.helperName}>
              {offer.profile?.name || 'Unknown User'}
            </Text>
            <Text style={styles.offerDate}>
              Offered {formatDate(offer.offered_at)}
            </Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: '#FF9800' }]}>
          <Text style={styles.statusText}>Pending</Text>
        </View>
      </View>

      {offer.message && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageLabel}>Message:</Text>
          <Text style={styles.messageText}>{offer.message}</Text>
        </View>
      )}

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => openResponseModal(offer, 'accept')}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.actionButtonText}> Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.declineButton}
          onPress={() => openResponseModal(offer, 'decline')}
        >
          <Ionicons name="close-circle" size={20} color="#fff" />
          <Text style={styles.actionButtonText}> Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Refresh data when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (currentUser) {
        fetchMyRequestsWithOffers();
      }
    }, [currentUser, fetchMyRequestsWithOffers])
  );

  // Handle pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMyRequestsWithOffers().finally(() => setRefreshing(false));
  }, [fetchMyRequestsWithOffers]);

  // Placeholder for sendPushNotification - you need to implement this
  const sendPushNotification = async (token, title, body) => {
    // This is a placeholder. You would typically use Expo's Push Notification API
    // or a similar service here.
    console.log(`Sending push notification to ${token}: ${title} - ${body}`);
    // Example using Expo's push notification service:
    /*
    const message = {
      to: token,
      sound: 'default',
      title,
      body,
      data: { someData: 'goes here' },
    };
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    */
  };

  // Handle offer response and delete offer after response
  const handleOfferResponse = async (offerId, status, message = '', request) => {
    try {
      console.log('Attempting to respond to and delete offer:', { offerId, status, message });
      
      // First, check if the offer exists
      const { data: existingOffer, error: checkError } = await supabase
        .from('food_request_offers')
        .select('*')
        .eq('id', offerId)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking offer:', checkError);
        throw checkError;
      }

      if (!existingOffer) {
        console.error('Offer not found:', offerId);
        throw new Error(`Offer with ID ${offerId} not found`);
      }

      console.log('Found existing offer:', existingOffer);

      // Get helper's profile for notifications
      const { data: helperProfile, error: profileError } = await supabase
        .from('profile')
        .select('push_token')
        .eq('id', existingOffer.helper_id)
        .maybeSingle();

      if (profileError) {
        console.warn('Profile error (non-fatal):', profileError);
      }

      // Send notifications before deleting the offer
      const notificationTitle = `Offer ${status}`;
      const notificationBody = request && request.item_name 
        ? `Your offer for "${request.item_name}" was ${status}.`
        : `Your offer was ${status}.`;

      // Send in-app notification to database
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: existingOffer.helper_id,
          title: notificationTitle,
          message: notificationBody,
          type: 'offer_response',
          related_offer_id: offerId,
          related_request_id: request ? request.id : selectedRequest?.id
        });

      if (notificationError) {
        console.warn('Notification error (non-fatal):', notificationError);
      }

      // Send push notification if token exists
      if (helperProfile?.push_token) {
        try {
          await sendPushNotification(helperProfile.push_token, notificationTitle, notificationBody);
        } catch (pushError) {
          console.warn('Push notification error (non-fatal):', pushError);
        }
      }

      // If accepting, update the request status to fulfilled
      if (status === OFFER_STATUSES.ACCEPTED && (request || selectedRequest)) {
        const requestToUpdate = request || selectedRequest;
        
        // Update request status to fulfilled and set updated_at
        const { error: requestUpdateError } = await supabase
          .from('food_requests')
          .update({ 
            status: REQUEST_STATUSES.FULFILLED,
            updated_at: new Date().toISOString() // Set updated_at to current timestamp
          })
          .eq('id', requestToUpdate.id);

        if (requestUpdateError) {
          console.error('Request update error:', requestUpdateError);
          throw requestUpdateError;
        }

        // Mark the shared item as unavailable if it exists
        if (existingOffer.shared_item_id) {
          const { error: itemUpdateError } = await supabase
            .from('shared_items')
            .update({ is_available: false })
            .eq('id', existingOffer.shared_item_id);

          if (itemUpdateError) {
            console.error('Shared item update error:', itemUpdateError);
            throw itemUpdateError;
          }
        }

        // Delete all other pending offers for this request since it's now fulfilled
        const { error: deleteOthersError } = await supabase
          .from('food_request_offers')
          .delete()
          .eq('request_id', requestToUpdate.id)
          .eq('status', OFFER_STATUSES.PENDING);

        if (deleteOthersError) {
          console.warn('Error deleting other pending offers (non-fatal):', deleteOthersError);
        }
      } else {
        // If declining, just delete this specific offer
        const { error: deleteError } = await supabase
          .from('food_request_offers')
          .delete()
          .eq('id', offerId);

        if (deleteError) {
          console.error('Error deleting offer:', deleteError);
          throw deleteError;
        }
      }

      Alert.alert('Success', `Offer ${status} successfully!`);
      
      // Refresh data to reflect changes
      await fetchMyRequestsWithOffers();
      
    } catch (error) {
      console.error('Error responding to offer:', error);
      Alert.alert('Error', error.message || 'Failed to respond to offer');
    } finally {
      // Close modal
      setResponseModalVisible(false);
      setResponseMessage('');
      setSelectedOffer(null);
      setResponseType(null);
    }
  };

  // Open response modal - Modified to also set the selected request
  const openResponseModal = (offer, type) => {
    setSelectedOffer(offer);
    setResponseType(type);
    setResponseMessage('');
    
    // Find the request this offer belongs to
    const request = myRequests.find(req => 
      req.offers.some(o => o.id === offer.id)
    );
    setSelectedRequest(request);
    
    setResponseModalVisible(true);
  };

  // Get urgency color
  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      case 'low': return '#4CAF50';
      default: return '#9E9E9E';
    }
  };

  // Format date
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Unknown';
    }
  };

  // Render food request with offers
  const renderRequestWithOffers = ({ item: request }) => {
    const hasOffers = request.offers && request.offers.length > 0;

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <Text style={styles.requestTitle}>{request.item_name}</Text>
          <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(request.urgency) }]}>
            <Text style={styles.urgencyText}>{request.urgency?.toUpperCase() || 'NORMAL'}</Text>
          </View>
        </View>

        <Text style={styles.requestDescription}>{request.description}</Text>
        
        <View style={styles.requestMeta}>
          <Text style={styles.metaText}>
            <Ionicons name="calendar" size={14} color="#666" /> 
            {formatDate(request.created_at)}
          </Text>
          <Text style={styles.metaText}>
            <Ionicons name="hand-left" size={14} color="#666" /> 
            {request.offers.length} pending offer{request.offers.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {hasOffers ? (
          <View style={styles.offersSection}>
            <Text style={styles.sectionTitle}>Pending Offers:</Text>
            <FlatList
              data={request.offers}
              keyExtractor={(offer) => offer.id.toString()}
              renderItem={renderOffer}
              scrollEnabled={false}
            />
          </View>
        ) : (
          <View style={styles.noOffersContainer}>
            <Ionicons name="time" size={24} color="#9E9E9E" />
            <Text style={styles.noOffersText}>No pending offers</Text>
          </View>
        )}
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="hand-left" size={64} color="#9E9E9E" />
      <Text style={styles.emptyTitle}>No Food Requests</Text>
      <Text style={styles.emptyText}>
        You haven't made any food requests yet. Go to the Share screen to request food from your neighbors.
      </Text>
      <TouchableOpacity
        style={styles.createRequestButton}
        onPress={() => navigation.navigate('RequestFood')}
      >
        <Ionicons name="add-circle" size={20} color="#fff" />
        <Text style={styles.createRequestButtonText}> Make a Request</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading your offers...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.title}>My Food Requests</Text>
          <Text style={styles.subtitle}>See who's offering to help</Text>
        </View>
        <Ionicons name="notifications" size={32} color="#4CAF50" />
      </View>

      <FlatList
        data={myRequests}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderRequestWithOffers}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        ListEmptyComponent={renderEmptyState}
      />

      {/* Response Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={responseModalVisible}
        onRequestClose={() => setResponseModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {responseType === 'accept' ? 'Accept Offer' : 'Decline Offer'}
            </Text>
            
            {selectedOffer && (
              <View style={styles.offerPreview}>
                <Text style={styles.previewHelper}>
                  From: {selectedOffer.profile?.name || 'Anonymous'}
                </Text>
                {selectedOffer.message && (
                  <Text style={styles.previewMessage}>
                    "{selectedOffer.message}"
                  </Text>
                )}
              </View>
            )}

            <Text style={styles.modalDescription}>
              {responseType === 'accept' 
                ? 'Send a message to coordinate with this helper:'
                : 'Optionally send a message explaining why you\'re declining:'
              }
            </Text>

            <TextInput
              style={styles.responseInput}
              placeholder={responseType === 'accept' 
                ? "Thanks! When and where should we meet?"
                : "Thank you, but I found another solution."
              }
              multiline
              numberOfLines={3}
              value={responseMessage}
              onChangeText={setResponseMessage}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setResponseModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  { backgroundColor: responseType === 'accept' ? '#4CAF50' : '#F44336' }
                ]}
                onPress={() => {
                  if (!selectedOffer) return;

                  const status = responseType === 'accept' ? OFFER_STATUSES.ACCEPTED : OFFER_STATUSES.DECLINED;

                  handleOfferResponse(
                    selectedOffer.id, 
                    status, 
                    responseMessage, 
                    selectedRequest
                  );
                }}
              >
                <Ionicons 
                  name={responseType === 'accept' ? 'checkmark-circle' : 'close-circle'} 
                  size={20} 
                  color="#fff" 
                />
                <Text style={styles.confirmButtonText}>
                  {responseType === 'accept' ? ' Accept Offer' : ' Decline Offer'}
                </Text>
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
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  requestTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
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
  requestDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  requestMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metaText: {
    fontSize: 12,
    color: '#666',
    flexDirection: 'row',
    alignItems: 'center',
  },
  offersSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  offerCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  helperInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  helperDetails: {
    marginLeft: 12,
    flex: 1,
  },
  helperName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  offerDate: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  messageContainer: {
    marginBottom: 8,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 6,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  declineButton: {
    backgroundColor: '#F44336',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  noOffersContainer: {
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  noOffersText: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 300,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  createRequestButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  createRequestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  offerPreview: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  previewHelper: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  previewMessage: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
  },
  responseInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    marginBottom: 20,
    backgroundColor: '#f9f9f9',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    backgroundColor: '#9E9E9E',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  confirmButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
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
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  profileImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImageText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
