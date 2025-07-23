import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
  Image
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

const image_url = {
  'apple': require('../assets/images/apple.png'),
  'banana': require('../assets/images/banana.png'),
  'bread': require('../assets/images/bread.png'),
  'milk': require('../assets/images/milk.png'),
  'eggs': require('../assets/images/eggs.png'),
  'egg': require('../assets/images/eggs.png'), // Add singular version
  'cheese': require('../assets/images/cheese.png'),
  'tomato': require('../assets/images/tomato.png'),
  'tomatoes': require('../assets/images/tomato.png'), // Add plural version
  'potato': require('../assets/images/potato.png'),
  'carrot': require('../assets/images/carrot.png'),
  'chicken': require('../assets/images/chicken.png'),
  'fish': require('../assets/images/fish.png'),
  'rice': require('../assets/images/rice.png'),
  'pasta': require('../assets/images/pasta.png'),
  'avocado': require('../assets/images/avocado.png'),
  //'beef': require('../assets/images/beef.png'), // Add if you have this image
  //'turkey': require('../assets/images/turkey.png'), // Add if you have this image
  // Add more mappings based on your database items
};

export default function PantryScreen({ navigation }) {
  const [pantryItems, setPantryItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');


  useEffect(() => {
    initializeScreen();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPantryItems();
    }, [])
  );

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredItems(pantryItems);
    } else {
      const filtered = pantryItems.filter(item =>
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredItems(filtered);
    }
  }, [searchQuery, pantryItems]);  // Ensure both dependencies are included

  const initializeScreen = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user) {
        await fetchPantryItems();
      }
    } catch (error) {
      console.error('Error initializing screen:', error);
    }
  };

  const fetchPantryItems = async () => {
    if (!refreshing) setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setPantryItems([]);
        setFilteredItems([]);
        return;
      }

      const { data, error } = await supabase
        .from('pantry_items')
        .select('*')
        .eq('user_id', user.id)
        .order('expiration_date', { ascending: true });

      if (error) {
        console.error('Fetch error:', error.message);
        setPantryItems([]);
        setFilteredItems([]);
      } else {
        const validItems = Array.isArray(data)
          ? data.filter(item => item && item.item_name)
          : [];
        setPantryItems(validItems);
        if (searchQuery.trim() !== '') {
          const filtered = validItems.filter(item =>
            item.item_name.toLowerCase().includes(searchQuery.toLowerCase())
          );
          setFilteredItems(filtered);
        } else {
          setFilteredItems(validItems);
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setPantryItems([]);
      setFilteredItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPantryItems();
  }, [searchQuery]);

 const navigateToPantryItemDetails = (item) => {
  navigation.navigate('PantryItemDetails', {
    item: item,
    onItemUpdated: (updatedItem) => {
      setPantryItems(prevItems =>
        prevItems.map(prevItem =>
          prevItem.id === updatedItem.id ? updatedItem : prevItem
        )
      );
      setFilteredItems(prevItems =>
        prevItems.map(prevItem =>
          prevItem.id === updatedItem.id ? updatedItem : prevItem
        )
      );
    },
    onItemDeleted: (deletedItemId) => {
      setPantryItems(prevItems => prevItems.filter(item => item.id !== deletedItemId));
      setFilteredItems(prevItems => prevItems.filter(item => item.id !== deletedItemId));
    },
    onItemDiscarded: (discardedItemId) => {
      setPantryItems(prevItems => prevItems.filter(item => item.id !== discardedItemId));
      setFilteredItems(prevItems => prevItems.filter(item => item.id !== discardedItemId));
    }
  });
};

  const updateLocalItems = (newItems) => {
    setPantryItems(newItems);

    if (searchQuery.trim() === '') {
      setFilteredItems(newItems);
    } else {
      const filtered = newItems.filter(item =>
        item.item_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredItems(filtered);
    }
  };

  const getExpirationStatus = (dateString) => {
    try {
      const expiration = new Date(dateString);
      const today = new Date();
      const diffTime = expiration - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return { status: 'expired', days: Math.abs(diffDays) };
      if (diffDays <= 3) return { status: 'expiring', days: diffDays };
      return { status: 'fresh', days: diffDays };
    } catch {
      return { status: 'unknown', days: 0 };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      if (isNaN(date)) return dateString;
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const getItemEmoji = (itemName) => {
    const name = itemName.toLowerCase();
    if (name.includes('apple')) return '🍎';
    if (name.includes('banana')) return '🍌';
    if (name.includes('bread')) return '🍞';
    if (name.includes('milk')) return '🥛';
    if (name.includes('egg')) return '🥚';
    if (name.includes('cheese')) return '🧀';
    if (name.includes('tomato')) return '🍅';
    if (name.includes('potato')) return '🥔';
    if (name.includes('carrot')) return '🥕';
    if (name.includes('meat') || name.includes('chicken')) return '🍗';
    if (name.includes('fish')) return '🐟';
    if (name.includes('rice')) return '🍚';
    if (name.includes('pasta')) return '🍝';
    if (name.includes('flour')) return '🧂';
    if (name.includes('avocado')) return '🥑';
    if (name.includes('salad')) return '🥗';
    if (name.includes('noodles')) return '🍜';
    if (name.includes('toast')) return '🍞';
    return '🥫';
  };

  // Additional debugging function
  const debugImageUrl = (item) => {
    console.log('=== DEBUG IMAGE URL ===');
    console.log('Item:', item.item_name);
    console.log('Raw image_url:', item.image_url);
    console.log('Type:', typeof item.image_url);
    console.log('Length:', item.image_url?.length);
    console.log('Starts with http:', item.image_url?.startsWith('http'));
    console.log('========================');
  };

  const getFoodData = (item) => {
  const itemName = item.item_name?.toLowerCase() || '';

  // Debug the image URL
  if (item.image_url) {
    debugImageUrl(item);
  }

  // For items that don't have preparation time or calories
  if (itemName.includes('water') || itemName.includes('salt') ||
      itemName.includes('spice') || itemName.includes('oil')) {
    return {
      calories: '',
      rating: '4.5',
      distance: '0 km',
      description: `${item.item_name} ready for consumption.`
    };
  }

  // Realistic data for common items
  const foodData = {
    calories: '',
    rating: (Math.random() * 0.5 + 4.5).toFixed(1), // Rating between 4.5-5.0
    distance: (Math.random() * 5).toFixed(1) + ' km',
    description: `Fresh ${item.item_name?.toLowerCase() || 'item'} ready for preparation.`
  };

  // Set calories based on item type
  if (itemName.includes('apple') || itemName.includes('banana') ||
      itemName.includes('orange') || itemName.includes('grape')) {
    foodData.calories = '80-100 kcal';
  }
  else if (itemName.includes('chicken') || itemName.includes('meat')) {
    foodData.calories = '200-300 kcal';
  }
  else if (itemName.includes('turkey')) {
    foodData.calories = '250-350 kcal';
  }
  else if (itemName.includes('rice')) {
    foodData.calories = '200 kcal/cup';
  }
  else if (itemName.includes('pasta')) {
    foodData.calories = '220 kcal/serving';
  }
  else if (itemName.includes('bread')) {
    foodData.calories = '80 kcal/slice';
  }
  else if (itemName.includes('milk')) {
    foodData.calories = '120 kcal/cup';
  }
  else if (itemName.includes('egg')) {
    foodData.calories = '70 kcal/egg';
  }
  else if (itemName.includes('fish')) {
    foodData.calories = '150-250 kcal';
  }
  else if (itemName.includes('vegetable') || itemName.includes('salad')) {
    foodData.calories = '50-100 kcal';
  }
  else if (itemName.includes('cheese')) {
    foodData.calories = '110 kcal/oz';
  }

  return foodData;
};


  const renderGridItem = ({ item, index }) => {
    const expirationStatus = getExpirationStatus(item.expiration_date);
    const isExpired = expirationStatus.status === 'expired';
    const isExpiring = expirationStatus.status === 'expiring';

    const itemKey = Object.keys(image_url).find(key =>
      key.toLowerCase() === item.item_name.toLowerCase()
    );
    const hasDefaultImage = itemKey && image_url[itemKey];
    const foodData = getFoodData(item);

    // Improved image URL validation
    const hasValidImageUrl = item.image_url &&
      typeof item.image_url === 'string' &&
      item.image_url.trim() !== '' &&
      item.image_url !== 'NULL' &&
      item.image_url !== 'null' &&
      !item.image_url.includes('undefined') &&
      (item.image_url.startsWith('http://') || item.image_url.startsWith('https://'));

    console.log('PantryScreen - Item:', item.item_name, {
      hasValidImageUrl,
      imageUrl: item.image_url,
      hasDefaultImage,
      itemKey
    });

    return (
      <TouchableOpacity
        style={[
          styles.gridItem,
          isExpired && styles.gridItemExpired,
          isExpiring && styles.gridItemExpiring
        ]}
        onPress={() => navigateToPantryItemDetails(item)}
        activeOpacity={0.7}
      >
        <View style={styles.gridItemContent}>
          <View style={styles.foodImageContainer}>
            {hasValidImageUrl ? (
              <Image
                source={{ uri: item.image_url }}
                style={styles.foodImage}
                resizeMode="cover"
                onError={(error) => {
                  console.log('Remote image load error for', item.item_name, ':', error.nativeEvent?.error);
                }}
                onLoad={() => {
                  console.log('Remote image loaded successfully for', item.item_name);
                }}
                onLoadStart={() => {
                  console.log('Started loading remote image for', item.item_name);
                }}
                // Remove cache to ensure fresh loads during development
                cache="reload"
                key={`remote-${item.id}-${item.image_url}`}
              />
            ) : hasDefaultImage ? (
              <Image
                source={image_url[itemKey]}
                style={styles.foodImage}
                resizeMode="cover"
                onError={(error) => {
                  console.log('Default image load error for', item.item_name, ':', error);
                }}
                key={`default-${item.id}-${itemKey}`}
              />
            ) : (
              <View style={styles.iconContainer} key={`emoji-${item.id}`}>
                <Text style={styles.foodIcon}>{getItemEmoji(item.item_name)}</Text>
              </View>
            )}
          </View>

          <Text style={styles.itemName} numberOfLines={1}>
            {item.item_name}
          </Text>

          <View style={styles.foodDetails}>
  {foodData.calories ? (
    <Text style={styles.detailText}>{foodData.calories}</Text>
  ) : <View style={{flex: 1}} />}
</View>

          <View style={styles.ratingContainer}>
            <Text style={styles.ratingText}>⭐ {foodData.rating}</Text>
          </View>

          {isExpired && (
            <View style={[styles.statusBadge, styles.expiredBadge]}>
              <Text style={styles.statusText}>EXPIRED</Text>
            </View>
          )}
          {isExpiring && !isExpired && (
            <View style={[styles.statusBadge, styles.expiringBadge]}>
              <Text style={styles.statusText}>EXPIRING</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🍽️</Text>
      <Text style={styles.emptyTitle}>Empty Pantry</Text>
      <Text style={styles.emptyText}>Start adding items to your pantry</Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddItem')}
      >
        <Text style={styles.addButtonText}>+ Add First Item</Text>
      </TouchableOpacity>
    </View>
  );

  const renderNoResults = () => (
    <View style={styles.noResultsContainer}>
      <Text style={styles.noResultsIcon}>🔍</Text>
      <Text style={styles.noResultsTitle}>No items found</Text>
      <Text style={styles.noResultsText}>Try searching for something else</Text>
    </View>
  );

  const renderHeader = () => (
    <>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular Items</Text>
        </View>

        {filteredItems.length > 0 ? (
          <FlatList
            horizontal
            data={filteredItems.slice(0, 4)}
            keyExtractor={(item) => `popular-${item.id}`}
            renderItem={renderGridItem}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        ) : (
          searchQuery.length > 0 && renderNoResults()
        )}
      </View>

      {filteredItems.length > 4 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Items of the Week</Text>
          </View>

          <FlatList
            horizontal
            data={filteredItems.slice(4, 8)}
            keyExtractor={(item) => `recipe-${item.id}`}
            renderItem={renderGridItem}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        </View>
      )}

      {filteredItems.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>All Pantry Items</Text>
          </View>
        </View>
      )}
    </>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading pantry items...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9fa" />

      <View style={styles.headerContainer}>
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search pantry items"
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        ListHeaderComponent={renderHeader}
        data={filteredItems.length > 0 ? filteredItems : []}
        keyExtractor={(item) => `all-${item.id}`}
        renderItem={renderGridItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.gridList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4CAF50']}
            tintColor="#4CAF50"
          />
        }
        ListEmptyComponent={
          filteredItems.length === 0 && searchQuery.trim() === ''
            ? renderEmptyState()
            : null
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddItem')}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  contentContainer: {
    flex: 1,
  },
  modalKeyboardAvoidingView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  headerContainer: {
    padding: 20,
    paddingBottom: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 12,
    color: '#999',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 5,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#999',
  },
  section: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  viewAllText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  horizontalList: {
    paddingLeft: 20,
    paddingRight: 10,
  },
  gridList: {
    paddingHorizontal: 10,
  },
  row: {
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  gridItem: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: Dimensions.get('window').width / 2 - 30,
    marginHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
  },
  gridItemExpiring: {
    backgroundColor: '#fff8e1',
    borderWidth: 1,
    borderColor: '#ffb74d',
  },
  gridItemExpired: {
    backgroundColor: '#ffebee',
    borderWidth: 2,
    borderColor: '#f44336',
  },
  gridItemContent: {
    padding: 15,
  },
  foodImageContainer: {
    width: '100%',
    height: 120,
    borderRadius: 15,
    backgroundColor: '#f5f5f5',
    marginBottom: 12,
    overflow: 'hidden',
  },
  foodImage: {
    width: '100%',
    height: '100%',
  },
  iconContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodIcon: {
    fontSize: 50,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  foodDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    minHeight: 20,
  },
  detailText: {
    fontSize: 12,
    color: '#666',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  statusBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  expiredBadge: {
    backgroundColor: '#f44336',
  },
  expiringBadge: {
    backgroundColor: '#ff9800',
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#00C897',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#00C897',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noResultsIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  noResultsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
});