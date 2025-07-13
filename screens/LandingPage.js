import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function LandingPage({ navigation }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1c1c1c" />
      
      {/* Logo Section */}
      <View style={styles.logoContainer}>
        <Ionicons name="fast-food" size={80} color="#00C897" />
        <Text style={styles.title}>Smart Pantry</Text>
      </View>

      {/* Tagline */}
      <Text style={styles.subtitle}>Prevent food waste. Plan better. Eat smarter.</Text>

      {/* Feature Highlights */}
      <View style={styles.featuresContainer}>
        <View style={styles.featureItem}>
          <Ionicons name="leaf" size={24} color="#00C897" style={styles.featureIcon} />
          <Text style={styles.featureText}>Reduce food waste</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="calendar" size={24} color="#00C897" style={styles.featureIcon} />
          <Text style={styles.featureText}>Smart meal planning</Text>
        </View>
        <View style={styles.featureItem}>
          <Ionicons name="people" size={24} color="#00C897" style={styles.featureIcon} />
          <Text style={styles.featureText}>Community sharing</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.signupButton]}
          onPress={() => navigation.navigate('Signup')}
          activeOpacity={0.8}
        >
          <Text style={[styles.buttonText, styles.signupButtonText]}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1c',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#00C897',
    marginTop: 15,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 26,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    backgroundColor: 'rgba(0, 200, 151, 0.1)',
    padding: 15,
    borderRadius: 10,
  },
  featureIcon: {
    marginRight: 15,
  },
  featureText: {
    color: '#fff',
    fontSize: 16,
  },
  buttonsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#00C897',
    paddingVertical: 16,
    borderRadius: 30,
    elevation: 3,
    marginBottom: 15,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#00C897',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  signupButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#00C897',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  signupButtonText: {
    color: '#00C897',
  },
});