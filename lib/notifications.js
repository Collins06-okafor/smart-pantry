import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import { useEffect } from 'react';

// Configure foreground notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Register for push notifications and return Expo token
export async function registerForPushNotificationsAsync() {
  let token;

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Permission denied for notifications');
      return null;
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('📱 Expo Push Token:', token);
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  } else {
    Alert.alert('Use Physical Device', 'Push notifications only work on real devices.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}

// Optional notification types
export const NOTIFICATION_TYPES = {
  EXPIRY_WARNING: 'expiry_warning',
  MEAL_SUGGESTION: 'meal_suggestion',
};

// In-memory store (no persistence)
let notificationStorage = {
  preferences: null,
  effectiveness: {},
};

// Smart Notification Manager
export const smartNotificationManager = {
  userPreferences: {
    expiryWarnings: true,
    maxDailyNotifications: 5,
  },

  async initializePreferences() {
    if (!notificationStorage.preferences) {
      notificationStorage.preferences = { ...this.userPreferences };
    } else {
      this.userPreferences = { ...this.userPreferences, ...notificationStorage.preferences };
    }
  },

  async updatePreferences(newPrefs) {
    this.userPreferences = { ...this.userPreferences, ...newPrefs };
    notificationStorage.preferences = { ...this.userPreferences };
  },

  async scheduleNotification(notificationData) {
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: notificationData.title,
          body: notificationData.body,
          data: notificationData.data,
          sound: 'default',
        },
        trigger: notificationData.trigger,
      });

      console.log(`✅ Scheduled notification: ${identifier}`);
      return identifier;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  },

  async scheduleSmartNotifications(pantryItems) {
    if (!this.userPreferences.expiryWarnings || !Array.isArray(pantryItems)) return;

    await Notifications.cancelAllScheduledNotificationsAsync(); // Clear previous

    const now = new Date();

    for (const item of pantryItems) {
      if (!item.expiration_date) continue;

      const expiryDate = new Date(item.expiration_date);
      const diffDays = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

      if (diffDays <= 7 && diffDays > 0) {
        const title = diffDays === 1
          ? `🚨 ${item.item_name} expires tomorrow!`
          : `⚠️ ${item.item_name} expires in ${diffDays} days`;
        const body = `Use your ${item.item_name} soon to avoid waste.`;

        await this.scheduleNotification({
          title,
          body,
          data: { itemId: item.id, type: NOTIFICATION_TYPES.EXPIRY_WARNING },
          trigger: { seconds: 10 }, // immediate for testing
        });
      }
    }
  }
};

// Initialize Android channels
export const initializeNotificationChannels = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }
};

// 🔁 Optional hook if needed in components
export function useSmartNotifications(pantryItems) {
  useEffect(() => {
    if (pantryItems?.length) {
      smartNotificationManager.scheduleSmartNotifications(pantryItems);
    }
  }, [pantryItems]);
}
