import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet } from 'react-native';

import {
  Home, Package, PlusCircle, Utensils, Settings
} from 'lucide-react-native';

import LandingPage from './screens/LandingPage';
import Login from './screens/Login';
import Signup from './screens/Signup';
import LocationScreen from './screens/LocationPickerScreen';
import Dashboard from './screens/Dashboard';
import PantryScreen from './screens/PantryScreen';
import AddItemScreen from './screens/AddItemScreen';
import RecipeScreen from './screens/RecipeScreen';
import ShareScreen from './screens/ShareScreen';
import ProfileScreen from './screens/ProfileScreen';
import RequestFoodScreen from './screens/RequestFoodScreen';
import ChatScreen from './screens/ChatScreen';
import DiscardedItemsScreen from './screens/DiscardedItemsScreen';
import WasteStatsScreen from './screens/WasteStatsScreen';
import ExpiringItemsScreen from './screens/ExpiringItemsScreen';
import NearbyUsersScreen from './screens/NearbyUsersScreen';
import CameraScreen from './screens/CameraScreen';
import RecipeDetailScreen from './screens/RecipeDetailScreen';

// --- Add ThemeContext import ---
import { ThemeProvider, useTheme } from './contexts/ThemeContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tabs UI
function MainTabsStack() {
  // --- Use theme from context ---
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          { backgroundColor: theme.tabBar, borderTopColor: theme.tabBarInactive }
        ],
        tabBarActiveTintColor: theme.tabBarActive,
        tabBarInactiveTintColor: theme.tabBarInactive,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={Dashboard}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Home size={22} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Pantry"
        component={PantryScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Package size={22} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Add"
        component={AddItemScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[
              styles.addButton,
              { backgroundColor: focused ? theme.addButtonFocused : theme.addButton }
            ]}>
              <PlusCircle size={28} color="#fff" />
            </View>
          ),
          tabBarLabel: '',
        }}
      />

      <Tab.Screen
        name="Recipes"
        component={RecipeScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Utensils size={22} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <Settings size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Main App Stack
export default function App() {
  useEffect(() => {
    console.log('Using JS engine:', global.HermesInternal ? 'Hermes' : 'JSC');
  }, []);

  // --- Wrap app in ThemeProvider ---
  return (
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Landing">
          <Stack.Screen name="Landing" component={LandingPage} options={{ headerShown: false }} />
          <Stack.Screen name="Login" component={Login} options={{ headerShown: false }} />
          <Stack.Screen name="Signup" component={Signup} options={{ headerShown: false }} />
          <Stack.Screen name="Location" component={LocationScreen} options={{ title: 'Share Location' }} />
          <Stack.Screen name="MainTabs" component={MainTabsStack} options={{ headerShown: false }} />
          <Stack.Screen name="Share" component={ShareScreen} options={{ title: 'Share Food' }} />
          <Stack.Screen name="RequestFood" component={RequestFoodScreen} options={{ title: 'Request Food' }} />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
          <Stack.Screen name="AddItem" component={AddItemScreen} />
          <Stack.Screen name="DiscardedItems" component={DiscardedItemsScreen} />
          <Stack.Screen name="WasteStats" component={WasteStatsScreen} options={{ title: 'Waste Stats' }} />
          <Stack.Screen name="ExpiringItems" component={ExpiringItemsScreen} />
          <Stack.Screen name="NearbyUsers" component={NearbyUsersScreen} options={{ title: 'Nearby Users' }} />
          <Stack.Screen name="Pantry" component={PantryScreen} />
          <Stack.Screen name="Camera" component={CameraScreen} options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}

// Styles
const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    height: 80,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    paddingBottom: 10,
    paddingTop: 10,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -4,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00C897',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    elevation: 5,
    shadowColor: '#00C897',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  addButtonFocused: {
    backgroundColor: '#00A876',
  },
});