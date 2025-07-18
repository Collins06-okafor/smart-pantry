import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import {
  Package, AlertTriangle, Trash2, LogOut, RefreshCw, Search,
  Plus, ChefHat, UserPlus, History, BarChart3, Users, User
} from 'lucide-react-native';

const COLORS = {
  primary: '#00C897',
  bg: '#F8F9FA',
  white: '#FFFFFF',
  text: '#212529',
  gray: '#6C757D',
  yellow: '#FFC107',
  red: '#DC3545',
  green: '#28A745',
  blue: '#007BFF',
  orange: '#FD7E14',
};

export default function DashboardScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dashboardData, setDashboardData] = useState({
    name: '',
    email: '',
    profilePhotoUrl: null,
    pantryCount: 0,
    expiringSoon: [],
    discardedStats: { thisMonth: 0, total: 0 }
  });

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    navigation.navigate('Pantry', { query: searchQuery.trim() });
    setSearchQuery('');
  };

  const getNameFromEmail = (email) => {
    if (!email) return '';
    
    const localPart = email.split('@')[0]; // 'john.doe'
    const nameParts = localPart.split(/[._-]/); // Split by dot, underscore, or hyphen
    
    // Filter out empty parts and numbers, then capitalize each part
    const validParts = nameParts.filter(part => part.length > 0 && !(/^\d+$/.test(part)));
    
    return validParts.map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!user || userError) {
        console.error('User not found');
        return;
      }

      const [profileResult, pantryResult, discardedResult] = await Promise.all([
        supabase.from('profile').select('name, first_name, last_name, profile_photo_url').eq('id', user.id).single(),
        supabase.from('pantry_items').select('*').eq('user_id', user.id),
        supabase.from('discarded_items').select('timestamp, item_id').eq('user_id', user.id), // Include item_id to filter out discarded items
      ]);

      const profile = profileResult.data;
      const pantryItems = pantryResult.data || [];
      const discardedItems = discardedResult.data || [];

      // Get IDs of discarded items to filter them out from pantry count
      const discardedItemIds = new Set(discardedItems.map(item => item.item_id));
      
      // Filter out discarded items from pantry items
      const activePantryItems = pantryItems.filter(item => !discardedItemIds.has(item.id));

      // Get full name - priority: full name field, then first+last, then email parsing
      let fullName = '';
      if (profile?.name) {
        fullName = profile.name;
      } else if (profile?.first_name || profile?.last_name) {
        fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
      } else {
        fullName = getNameFromEmail(user.email);
      }
      
      // Debug logging
      console.log('Profile data:', profile);
      console.log('User email:', user.email);
      console.log('Final fullName:', fullName);
      console.log('Total pantry items:', pantryItems.length);
      console.log('Discarded items:', discardedItems.length);
      console.log('Active pantry items:', activePantryItems.length);

      const today = new Date();
      const in3Days = new Date(today.getTime() + 3 * 86400000);
      
      // Use active pantry items for expiring soon calculation
      const expiringSoon = activePantryItems.filter(item => {
        if (!item.expiration_date) return false;
        const expDate = new Date(item.expiration_date);
        return !isNaN(expDate.getTime()) && expDate >= today && expDate <= in3Days;
      });

      const now = new Date();
      const thisMonthCount = discardedItems.filter(item => {
        const d = new Date(item.timestamp);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;

      // Set dashboard data ONCE with all the correct values
      setDashboardData({
        name: fullName,
        email: user.email,
        profilePhotoUrl: profile?.profile_photo_url,
        pantryCount: activePantryItems.length, // Use active items count instead of all items
        expiringSoon,
        discardedStats: {
          thisMonth: thisMonthCount,
          total: discardedItems.length,
        },
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text>Loading Dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>Good day</Text>
            <Text style={styles.name}>{dashboardData.name}</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.profileIcon}
              onPress={() => navigation.navigate('ProfileScreen', { userId: dashboardData.id })}
            >
              {dashboardData.profilePhotoUrl ? (
                <Image 
                  source={{ uri: dashboardData.profilePhotoUrl }} 
                  style={styles.profileImage}
                  onError={() => console.log('Profile image failed to load')}
                />
              ) : (
                <User size={24} color={COLORS.white} />
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={onRefresh} style={styles.iconButton}>
              <RefreshCw size={20} color={COLORS.gray} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={[styles.iconButton, { backgroundColor: '#FDEDED' }]}>
              <LogOut size={20} color={COLORS.red} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={18} color="#888" style={styles.searchIcon} />
          <TextInput
            placeholder="Search dishes"
            placeholderTextColor="#999"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
        </View>

        {/* Stats */}
        <View style={styles.statCards}>
          <StatCard icon={<Package size={24} color={COLORS.primary} />} count={dashboardData.pantryCount} label="Pantry Items" />
          <StatCard icon={<AlertTriangle size={24} color={COLORS.yellow} />} count={dashboardData.expiringSoon.length} label="Expiring Soon" />
        </View>

        {/* Discarded */}
        <View style={styles.discardedRow}>
          <DiscardedStatCard icon="🗑️" label="This Month" value={dashboardData.discardedStats.thisMonth} bgColor="#FFF6E5" />
          <DiscardedStatCard icon="📉" label="All Time" value={dashboardData.discardedStats.total} bgColor="#E5F6FF" />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          <QuickAction icon={<Plus size={24} color="#fff" />} label="Add Item" onPress={() => navigation.navigate('Add')} green />
          <QuickAction icon={<Package size={24} />} label="My Pantry" onPress={() => navigation.navigate('Pantry')} />
          <QuickAction icon={<ChefHat size={24} />} label="Recipes" onPress={() => navigation.navigate('Recipes')} />
          <QuickAction icon={<UserPlus size={24} />} label="Share" onPress={() => navigation.navigate('Share')} />
        </View>

        {/* Expiring Soon */}
        {dashboardData.expiringSoon.length > 0 && (
          <View style={styles.expiringContainer}>
            <View style={styles.expiringHeader}>
              <Text style={styles.sectionTitle}>Expiring Soon</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ExpiringItems')}>
                <Text style={styles.viewAll}>View All</Text>
              </TouchableOpacity>
            </View>
            {dashboardData.expiringSoon.slice(0, 3).map((item, index) => (
              <View key={item.id || index} style={styles.expiringItem}>
                <Text style={styles.emoji}>{item.emoji || '🧃'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.item_name}</Text>
                  <Text style={styles.itemSub}>Expires {item.expiration_date}</Text>
                  <Text style={styles.itemSub}>{item.calories || 'N/A'}  ⭐ 4.5</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Extra Options */}
        <View style={styles.extraCards}>
          <ExtraCard icon={<History size={22} color={COLORS.blue} />} title="Discarded History" subtitle="View discarded items" onPress={() => navigation.navigate('DiscardedItems')} />
          <ExtraCard icon={<BarChart3 size={22} color="#6f42c1" />} title="Waste Stats" subtitle="Track food waste" onPress={() => navigation.navigate('WasteStats')} />
          <ExtraCard icon={<Users size={22} color={COLORS.orange} />} title="Nearby Users" subtitle="Connect with others" onPress={() => navigation.navigate('NearbyUsers')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Components ---
const StatCard = ({ icon, count, label }) => (
  <View style={styles.statCard}>
    <View style={styles.statIcon}>{icon}</View>
    <Text style={styles.statNumber}>{count}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const DiscardedStatCard = ({ icon, label, value, bgColor }) => (
  <View style={[styles.discardedStatCard, { backgroundColor: bgColor }]}>
    <Text style={styles.discardedIcon}>{icon}</Text>
    <Text style={styles.discardedLabel}>{label}</Text>
    <Text style={styles.discardedValue}>{value}</Text>
  </View>
);

const QuickAction = ({ icon, label, onPress, green = false }) => (
  <TouchableOpacity style={[styles.quickAction, green && styles.greenAction]} onPress={onPress}>
    {icon}
    <Text style={[styles.quickLabel, green && styles.greenLabel]}>{label}</Text>
  </TouchableOpacity>
);

const ExtraCard = ({ icon, title, subtitle, onPress }) => (
  <TouchableOpacity style={styles.extraCard} onPress={onPress}>
    {icon}
    <View>
      <Text style={styles.extraTitle}>{title}</Text>
      <Text style={styles.extraSubtitle}>{subtitle}</Text>
    </View>
  </TouchableOpacity>
);

// --- Styles ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  container: { flexGrow: 1, padding: 20, backgroundColor: COLORS.bg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  greeting: { fontSize: 16, color: COLORS.gray, marginBottom: 4 },
  name: { fontSize: 24, fontWeight: 'bold', color: COLORS.text },
  profileIcon: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: COLORS.primary, 
    justifyContent: 'center', 
    alignItems: 'center',
    overflow: 'hidden', // Important for circular image
  },
  profileImage: {
  width: 36,
  height: 36,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: '#fff',
},

  actions: { flexDirection: 'row', gap: 10 },
  iconButton: { padding: 10, borderRadius: 999, backgroundColor: '#eee' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eee', borderRadius: 20, padding: 10, marginBottom: 20 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16 },
  statCards: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 12 },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 16, alignItems: 'center' },
  statIcon: { marginBottom: 10 },
  statNumber: { fontSize: 24, fontWeight: 'bold' },
  statLabel: { fontSize: 14, color: COLORS.gray },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 10 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickAction: { width: '48%', backgroundColor: COLORS.white, padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
  greenAction: { backgroundColor: COLORS.primary },
  greenLabel: { color: COLORS.white },
  quickLabel: { marginTop: 8, fontSize: 14, fontWeight: '500', color: COLORS.text },
  extraCards: { gap: 16, marginTop: 20 },
  extraCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 16, borderRadius: 12, gap: 12 },
  extraTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  extraSubtitle: { fontSize: 12, color: COLORS.gray },
  discardedRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 12 },
  discardedStatCard: { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center' },
  discardedIcon: { fontSize: 24, marginBottom: 6 },
  discardedLabel: { fontSize: 14, color: COLORS.gray, marginBottom: 4 },
  discardedValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  expiringContainer: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, marginTop: 10, marginBottom: 20 },
  expiringHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  viewAll: { color: COLORS.primary, fontWeight: '600' },
  expiringItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  emoji: { fontSize: 28, marginRight: 12 },
  itemName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  itemSub: { fontSize: 13, color: COLORS.gray },
});