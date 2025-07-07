// MainTabs.js - Only tab screens
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Dashboard from './Dashboard';
import PantryScreen from './PantryScreen';
import RecipeScreen from './RecipeScreen';
import ShareScreen from './ShareScreen';
import ProfileScreen from './ProfileScreen';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = 'home-outline';
          } else if (route.name === 'Pantry') {
            iconName = 'cube-outline';
          } else if (route.name === 'Recipes') {
            iconName = 'restaurant-outline';
          } else if (route.name === 'Share') {
            iconName = 'people-outline';
          } else if (route.name === 'Profile') {
            iconName = 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#00C897',
        tabBarInactiveTintColor: 'gray',
        headerShown: false, // Hide headers for tab screens
      })}
    >
      <Tab.Screen name="Dashboard" component={Dashboard} />
      <Tab.Screen name="Pantry" component={PantryScreen} />
      <Tab.Screen name="Recipes" component={RecipeScreen} />
      <Tab.Screen name="Share" component={ShareScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}