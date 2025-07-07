// screens/MainTabsStack.js
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabs from './MainTabs';
import RequestFoodScreen from './RequestFoodScreen'; // ✅ Add your request screen

const Stack = createNativeStackNavigator();

export default function MainTabsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen 
        name="RequestFood" 
        component={RequestFoodScreen} 
        options={{ headerShown: true, title: 'Request Food' }} 
      />
    </Stack.Navigator>
  );
}
