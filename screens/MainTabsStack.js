// MainTabsStack.js - Create this new file
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet } from 'react-native';

// Import your screen components
import Dashboard from './Dashboard';
import PantryScreen from './PantryScreen';
import AddItemScreen from './AddItemScreen';
import RecipeScreen from './RecipeScreen';
import ProfileScreen from './ProfileScreen';

const Tab = createBottomTabNavigator();

function MainTabsStack() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false, // Hide the default header
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

export default MainTabsStack;