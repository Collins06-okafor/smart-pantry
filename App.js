import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LandingPage from './screens/LandingPage';
import Login from './screens/Login';
import Signup from './screens/Signup';
import LocationScreen from './screens/LocationPickerScreen';
import Dashboard from './screens/Dashboard'; 
import PantryScreen from './screens/PantryScreen';
import AddItemScreen from './screens/AddItemScreen';
import RecipeScreen from './screens/RecipeScreen';
import ShareScreen from './screens/ShareScreen';
import ProfileScreen from './screens/ProfileScreen'; // ✅ Import added

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    console.log("Using JS engine:", global.HermesInternal ? "Hermes" : "JSC");
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Landing">
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
        <Stack.Screen
          name="Location"
          component={LocationScreen}
          options={{ title: 'Share Location' }}
        />
        <Stack.Screen
          name="Dashboard"
          component={Dashboard}
          options={{ headerShown: false }}
        />
        <Stack.Screen 
          name="Pantry" 
          component={PantryScreen}
          options={{ title: 'My Pantry' }}
        />
        <Stack.Screen 
          name="AddItem" 
          component={AddItemScreen}
          options={{ title: 'Add Item' }}
        />
        <Stack.Screen 
          name="Recipes" 
          component={RecipeScreen}
          options={{ title: 'Recipes' }}
        />
        <Stack.Screen 
          name="Share" 
          component={ShareScreen}
        />
        <Stack.Screen 
          name="Profile" 
          component={ProfileScreen}
          options={{ title: 'Profile & Settings' }} // ✅ Screen added
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
