// utils/notificationUtils.js
import { supabase } from '../lib/supabase';

// Notification types
export const NOTIFICATION_TYPES = {
  FOOD_EXPIRY: 'food_expiry',
  FOOD_OFFER: 'food_offer',
  MESSAGE: 'message',
  SYSTEM: 'system',
  REMINDER: 'reminder',
};

// Send notification to a specific user
export const sendNotification = async (userId, title, message, type = NOTIFICATION_TYPES.SYSTEM) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([
        {
          user_id: userId,
          title,
          message,
          type,
          is_read: false,
        }
      ])
      .select()
      .single();

    if (error) throw error;
    
    console.log('Notification sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Error sending notification:', error);
    return null;
  }
};

// Send notification to multiple users
export const sendBulkNotifications = async (userIds, title, message, type = NOTIFICATION_TYPES.SYSTEM) => {
  try {
    const notifications = userIds.map(userId => ({
      user_id: userId,
      title,
      message,
      type,
      is_read: false,
    }));

    const { data, error } = await supabase
      .from('notifications')
      .insert(notifications)
      .select();

    if (error) throw error;
    
    console.log('Bulk notifications sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
    return null;
  }
};

// Send food expiry notification
export const sendExpiryNotification = async (userId, itemName, daysUntilExpiry) => {
  const title = daysUntilExpiry <= 0 
    ? 'Food Item Expired!' 
    : 'Food Item Expiring Soon!';
  
  const message = daysUntilExpiry <= 0
    ? `Your ${itemName} has expired. Consider discarding it safely.`
    : `Your ${itemName} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}. Use it soon!`;

  return await sendNotification(userId, title, message, NOTIFICATION_TYPES.FOOD_EXPIRY);
};

// Send food offer notification
export const sendOfferNotification = async (userId, offerDetails) => {
  const title = 'New Food Offer!';
  const message = `Someone offered to share ${offerDetails.itemName}. Check your offers to respond!`;

  return await sendNotification(userId, title, message, NOTIFICATION_TYPES.FOOD_OFFER);
};

// Send message notification
export const sendMessageNotification = async (userId, senderName, messagePreview) => {
  const title = `New message from ${senderName}`;
  const message = messagePreview.length > 50 
    ? `${messagePreview.substring(0, 50)}...` 
    : messagePreview;

  return await sendNotification(userId, title, message, NOTIFICATION_TYPES.MESSAGE);
};

// Send system notification
export const sendSystemNotification = async (userId, title, message) => {
  return await sendNotification(userId, title, message, NOTIFICATION_TYPES.SYSTEM);
};

// Send reminder notification
export const sendReminderNotification = async (userId, reminderTitle, reminderMessage) => {
  const title = `Reminder: ${reminderTitle}`;
  return await sendNotification(userId, title, reminderMessage, NOTIFICATION_TYPES.REMINDER);
};
