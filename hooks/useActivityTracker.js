// hooks/useActivityTracker.js
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { supabase } from '../lib/supabase';

export const useActivityTracker = (userId) => {
  const intervalRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());

  const updateLastActive = async (forceUpdate = false) => {
    if (!userId) return;

    const now = Date.now();
    // Only update if 30 seconds have passed since last update (to avoid too many DB calls)
    if (!forceUpdate && now - lastUpdateRef.current < 30000) {
      return;
    }

    try {
      const { error } = await supabase
        .from('profile')
        .update({
          last_active: new Date().toISOString(),
          is_online: true
        })
        .eq('id', userId);

      if (!error) {
        lastUpdateRef.current = now;
      }
    } catch (error) {
      console.error('Error updating last active:', error);
    }
  };

  const setOffline = async () => {
    if (!userId) return;

    try {
      await supabase
        .from('profile')
        .update({
          is_online: false,
          last_active: new Date().toISOString()
        })
        .eq('id', userId);
    } catch (error) {
      console.error('Error setting offline:', error);
    }
  };

  useEffect(() => {
    if (!userId) return;

    // Update immediately when hook starts
    updateLastActive(true);

    // Set up periodic updates every 60 seconds while app is active
    intervalRef.current = setInterval(() => {
      updateLastActive();
    }, 60000);

    // Handle app state changes
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        updateLastActive(true);
        // Restart interval when app becomes active
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        intervalRef.current = setInterval(() => {
          updateLastActive();
        }, 60000);
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Update one last time before going background
        updateLastActive(true);
        // Clear interval to save battery
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      subscription?.remove();
      setOffline(); // Set user offline when component unmounts
    };
  }, [userId]);

  // Return function to manually trigger activity update
  return {
    updateActivity: () => updateLastActive(true),
    setOffline
  };
};