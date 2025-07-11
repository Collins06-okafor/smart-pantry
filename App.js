import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';

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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();


// Bottom Tab Navigator Component
function MainTabsStack() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#00C897',
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIconStyle: styles.tabBarIcon,
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={Dashboard}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Text style={[styles.tabIcon, { color: focused ? '#00C897' : '#666' }]}>
              🏠
            </Text>
          ),
        }}
      />
      
      <Tab.Screen 
        name="Pantry" 
        component={PantryScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Text style={[styles.tabIcon, { color: focused ? '#00C897' : '#666' }]}>
              📦
            </Text>
          ),
        }}
      />
      
      <Tab.Screen 
        name="Add" 
        component={AddItemScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.addButton, { backgroundColor: focused ? '#00A876' : '#00C897' }]}>
              <Text style={styles.addButtonIcon}>+</Text>
            </View>
          ),
        }}
      />
      
      <Tab.Screen 
        name="Recipes" 
        component={RecipeScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Text style={[styles.tabIcon, { color: focused ? '#00C897' : '#666' }]}>
              🍽️
            </Text>
          ),
        }}
      />
      
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Text style={[styles.tabIcon, { color: focused ? '#00C897' : '#666' }]}>
              ⚙️
            </Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    console.log("Using JS engine:", global.HermesInternal ? "Hermes" : "JSC");
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Landing">
        {/* Authentication Screens */}
        <Stack.Screen
          name="Landing"
          component={LandingPage}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={Login}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Signup"
          component={Signup}
          options={{ headerShown: false }}
        />
        
        {/* Location Screen (part of onboarding) */}
        <Stack.Screen
          name="Location"
          component={LocationScreen}
          options={{ title: 'Share Location' }}
        />
        
        {/* Main App with Bottom Tabs */}
        <Stack.Screen
          name="MainTabs"
          component={MainTabsStack}
          options={{ headerShown: false }}
        />
        
        {/* Additional screens that don't need bottom tabs */}
        <Stack.Screen 
          name="Share" 
          component={ShareScreen}
          options={{ title: 'Share Food' }}
        />
        <Stack.Screen 
          name="RequestFood" 
          component={RequestFoodScreen}
          options={{ title: 'Request Food' }}
        />

        <Stack.Screen 
          name="Chat" 
          component={ChatScreen}
          options={{ title: 'Chat' }}
        />

        <Stack.Screen 
          name="AddItem"
          component={AddItemScreen} 
        />

        <Stack.Screen 
        name="DiscardedItems" 
        component={DiscardedItemsScreen} 
        />

        <Stack.Screen
          name="WasteStats"
          component={WasteStatsScreen}
          options={{ title: 'Waste Stats' }}
        />


        <Stack.Screen 
        name="ExpiringItems" 
        component={ExpiringItemsScreen} 
        />

        <Stack.Screen
  name="NearbyUsers"
  component={NearbyUsersScreen}
  options={{ title: 'Nearby Users' }}
/>
        <Stack.Screen name="Pantry" component={PantryScreen} />


    <Stack.Screen 
          name="Camera" 
          component={CameraScreen}
          options={{
            headerShown: false, // Hide header for camera screen
            presentation: 'modal', // Optional: makes it appear as a modal
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    paddingTop: 10,
    paddingBottom: 20,
    height: 80,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  tabBarIcon: {
    marginBottom: 4,
  },
  tabIcon: {
    fontSize: 20,
  },
  addButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  addButtonIcon: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});