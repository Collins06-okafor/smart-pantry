// screens/MainTabsStack.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet } from 'react-native';
import {
  Home,
  Package,
  Plus,
  ChefHat,
  Settings,
} from 'lucide-react-native';

// Screens
import Dashboard from './Dashboard';
import PantryScreen from './PantryScreen';
import AddItemScreen from './AddItemScreen';
import RecipeScreen from './RecipeScreen';
import ProfileScreen from './ProfileScreen';

const Tab = createBottomTabNavigator();

export default function MainTabsStack() {
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
            <Home size={22} color={focused ? '#00C897' : '#666'} />
          ),
        }}
      />

      <Tab.Screen 
        name="Pantry" 
        component={PantryScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Package size={22} color={focused ? '#00C897' : '#666'} />
          ),
        }}
      />

      <Tab.Screen 
        name="Add" 
        component={AddItemScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.addButton, { backgroundColor: focused ? '#00A876' : '#00C897' }]}>
              <Plus size={22} color="#fff" />
            </View>
          ),
          tabBarLabel: '', // Hide label for center Add button
        }}
      />

      <Tab.Screen 
        name="Recipes" 
        component={RecipeScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <ChefHat size={22} color={focused ? '#00C897' : '#666'} />
          ),
        }}
      />

      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Settings size={22} color={focused ? '#00C897' : '#666'} />
          ),
        }}
      />
    </Tab.Navigator>
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
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
});
