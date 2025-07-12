import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  TextInput,
  ScrollView,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

export default function RecipeScreen() {
  const navigation = useNavigation();
  const [pantryItems, setPantryItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('pantry');
  const [searchLoading, setSearchLoading] = useState(false);
  const [userAllergies, setUserAllergies] = useState([]);

  const API_KEY = '62f8f2c9d58b4ff3952e3c6ae227136c';

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  useEffect(() => {
    fetchPantryItems();
    fetchAllergies();
  }, []);

  const fetchPantryItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const { data, error } = await supabase
        .from('pantry_items')
        .select('item_name, expiration_date')
        .eq('user_id', user.id)
        .order('expiration_date', { ascending: true });

      if (error) throw error;

      const names = data.map(item => item.item_name).filter(Boolean);
      setPantryItems(names);

      if (names.length > 0) {
        fetchRecipesByIngredients(names);
      } else {
        setLoading(false);
        setError('No pantry items found to suggest recipes.');
      }
    } catch (err) {
      console.error('Pantry fetch error:', err.message);
      setError('Failed to load pantry items.');
      setLoading(false);
    }
  };

  const fetchAllergies = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profile')
        .select('allergies')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data?.allergies) {
        let allergyList = [];
        
        if (Array.isArray(data.allergies)) {
          allergyList = data.allergies.map(a => a.trim().toLowerCase()).filter(a => a.length > 0);
        } else if (typeof data.allergies === 'string') {
          allergyList = data.allergies
            .split(',')
            .map(a => a.trim().toLowerCase())
            .filter(a => a.length > 0);
        }
        
        setUserAllergies(allergyList);
      }
    } catch (err) {
      console.error('Failed to fetch allergies:', err.message);
    }
  };

  const filterRecipesByAllergy = (recipesList) => {
    if (!userAllergies.length) return recipesList;

    const allergySet = new Set(userAllergies);

    return recipesList.filter(recipe => {
      const missedIngredients = recipe?.missedIngredients || [];
      const hasMissedAllergen = missedIngredients.some(ingredient =>
        allergySet.has(ingredient.name?.toLowerCase())
      );

      const usedIngredients = recipe?.usedIngredients || [];
      const hasUsedAllergen = usedIngredients.some(ingredient =>
        allergySet.has(ingredient.name?.toLowerCase())
      );

      const extendedIngredients = recipe?.extendedIngredients || [];
      const hasExtendedAllergen = extendedIngredients.some(ingredient =>
        allergySet.has(ingredient.name?.toLowerCase())
      );

      return !hasMissedAllergen && !hasUsedAllergen && !hasExtendedAllergen;
    });
  };

  const fetchRecipesByIngredients = async (ingredients) => {
    try {
      const ingredientQuery = ingredients.slice(0, 5).join(',');
      const response = await fetch(
        `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${ingredientQuery}&number=10&apiKey=${API_KEY}`
      );
      const result = await response.json();

      if (!Array.isArray(result)) {
        throw new Error('Unexpected response from recipe API');
      }

      const filtered = filterRecipesByAllergy(result);
      setRecipes(filtered);
      setError('');
    } catch (err) {
      console.error('Recipe fetch error:', err.message);
      setError('Failed to fetch recipes.');
    } finally {
      setLoading(false);
    }
  };

  const searchRecipes = async (query) => {
    if (!query.trim()) return;
    
    setSearchLoading(true);
    try {
      const response = await fetch(
        `https://api.spoonacular.com/recipes/complexSearch?query=${encodeURIComponent(query)}&number=10&apiKey=${API_KEY}&addRecipeInformation=true`
      );
      const result = await response.json();

      if (result.results && Array.isArray(result.results)) {
        const filtered = filterRecipesByAllergy(result.results);
        setRecipes(filtered);
        setError('');
      } else {
        setRecipes([]);
        setError('No recipes found for your search.');
      }
    } catch (err) {
      console.error('Search error:', err.message);
      setError('Failed to search recipes.');
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchRandomRecipes = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.spoonacular.com/recipes/random?number=10&apiKey=${API_KEY}`
      );
      const result = await response.json();

      if (result.recipes && Array.isArray(result.recipes)) {
        const filtered = filterRecipesByAllergy(result.recipes);
        setRecipes(filtered);
        setError('');
      } else {
        setRecipes([]);
        setError('No random recipes found.');
      }
    } catch (err) {
      console.error('Random recipes error:', err.message);
      setError('Failed to fetch random recipes.');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError('');
    
    if (tab === 'pantry') {
      setLoading(true);
      if (pantryItems.length > 0) {
        fetchRecipesByIngredients(pantryItems);
      } else {
        setLoading(false);
        setError('No pantry items found.');
      }
    } else if (tab === 'random') {
      fetchRandomRecipes();
    } else if (tab === 'search') {
      setRecipes([]);
    }
  };

  const renderRecipeItem = ({ item }) => {
    const recipeData = {
      id: item.id,
      title: item.title,
      image: item.image,
      usedIngredients: item.usedIngredients || [],
      missedIngredients: item.missedIngredients || [],
      readyInMinutes: item.readyInMinutes,
      servings: item.servings,
      summary: item.summary
    };
    const caloriesInfo = item?.nutrition?.nutrients?.find(n => n.name === 'Calories');
    const rating = item?.spoonacularScore ? (item.spoonacularScore / 20).toFixed(1) : 4.0;

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('RecipeDetail', { recipeId: recipeData.id })}
      >
        <Image source={{ uri: recipeData.image }} style={styles.image} />
        <View style={styles.cardContent}>
          <Text style={styles.title} numberOfLines={1}>{recipeData.title}</Text>
          
          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.metaText}>{recipeData.readyInMinutes || 'N/A'} min</Text>
            </View>
            
            <View style={styles.metaItem}>
              <Ionicons name="restaurant-outline" size={16} color="#666" />
              <Text style={styles.metaText}>Serves {recipeData.servings || 'N/A'}</Text>
            </View>
            
            {caloriesInfo && (
              <View style={styles.metaItem}>
                <Ionicons name="flame-outline" size={16} color="#666" />
                <Text style={styles.metaText}>{Math.round(caloriesInfo.amount)} {caloriesInfo.unit}</Text>
              </View>
            )}
          </View>

          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.ratingText}>{rating}</Text>
          </View>

          {recipeData.usedIngredients?.length > 0 && (
            <View style={styles.ingredientsContainer}>
              <Text style={styles.ingredientsLabel}>You have:</Text>
              <Text style={styles.ingredientsText} numberOfLines={2}>
                {recipeData.usedIngredients.map(ing => ing.name).join(', ')}
              </Text>
            </View>
          )}

          {recipeData.missedIngredients?.length > 0 && (
            <View style={styles.ingredientsContainer}>
              <Text style={[styles.ingredientsLabel, styles.missingLabel]}>You need:</Text>
              <Text style={[styles.ingredientsText, styles.missingText]} numberOfLines={2}>
                {recipeData.missedIngredients.map(ing => ing.name).join(', ')}
              </Text>
            </View>
          )}

          <TouchableOpacity
  style={styles.viewButton}
  onPress={() =>
    navigation.navigate('RecipeDetail', { recipeId: item.id })
  }
>
  <Text style={styles.viewButtonText}>View Recipe</Text>
  <Ionicons name="arrow-forward" size={16} color="#00C897" />
</TouchableOpacity>

        </View>
      </TouchableOpacity>
    );
  };

  const renderTabBar = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'pantry' && styles.activeTab]}
        onPress={() => handleTabChange('pantry')}
      >
        <Ionicons 
          name="basket-outline" 
          size={20} 
          color={activeTab === 'pantry' ? '#fff' : '#666'} 
        />
        <Text style={[styles.tabText, activeTab === 'pantry' && styles.activeTabText]}>
          Pantry
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'search' && styles.activeTab]}
        onPress={() => handleTabChange('search')}
      >
        <Ionicons 
          name="search-outline" 
          size={20} 
          color={activeTab === 'search' ? '#fff' : '#666'} 
        />
        <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
          Search
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'random' && styles.activeTab]}
        onPress={() => handleTabChange('random')}
      >
        <Ionicons 
          name="shuffle-outline" 
          size={20} 
          color={activeTab === 'random' ? '#fff' : '#666'} 
        />
        <Text style={[styles.tabText, activeTab === 'random' && styles.activeTabText]}>
          Random
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <Ionicons name="search-outline" size={20} color="#888" style={styles.searchIcon} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search recipes..."
        placeholderTextColor="#888"
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmitEditing={() => searchRecipes(searchQuery)}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery('')}>
          <Ionicons name="close-circle" size={20} color="#888" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderAllergyIndicator = () => {
    if (userAllergies.length === 0) return null;
    
    return (
      <View style={styles.allergyIndicator}>
        <Ionicons name="warning-outline" size={16} color="#856404" />
        <Text style={styles.allergyText}>
          Filtering out: {userAllergies.join(', ')}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C897" />
        <Text style={styles.loadingText}>
          {activeTab === 'pantry' ? 'Finding recipes from your pantry...' : 'Loading delicious recipes...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Recipe Discovery</Text>
        {activeTab === 'pantry' && pantryItems.length > 0 && (
          <Text style={styles.basedOnText}>
            Based on: {pantryItems.slice(0, 3).join(', ')}{pantryItems.length > 3 ? '...' : ''}
          </Text>
        )}
      </View>
      
      {renderTabBar()}
      {renderAllergyIndicator()}
      
      {activeTab === 'search' && renderSearchBar()}

      {error ? (
        <View style={styles.centered}>
          <Ionicons name="sad-outline" size={40} color="#ff6b6b" />
          <Text style={styles.errorText}>{error}</Text>
          {activeTab === 'pantry' && (
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={fetchPantryItems}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : recipes.length === 0 && !loading ? (
        <View style={styles.centered}>
          <Ionicons 
            name={activeTab === 'search' ? "search-outline" : "fast-food-outline"} 
            size={40} 
            color="#ccc" 
          />
          <Text style={styles.emptyText}>
            {activeTab === 'search' 
              ? 'Search for delicious recipes' 
              : 'No recipes found'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRecipeItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 40,
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  basedOnText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 6,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#00C897',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#fff',
  },
  allergyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  allergyText: {
    fontSize: 12,
    color: '#856404',
    marginLeft: 6,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#666',
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: '#aaa',
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#00C897',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 30,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: width * 0.5,
  },
  cardContent: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  ingredientsContainer: {
    marginBottom: 8,
  },
  ingredientsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00C897',
    marginBottom: 2,
  },
  ingredientsText: {
    fontSize: 13,
    color: '#555',
  },
  missingLabel: {
    color: '#ff6b6b',
  },
  missingText: {
    color: '#888',
    fontStyle: 'italic',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  viewButtonText: {
    color: '#00C897',
    fontWeight: '600',
    marginRight: 4,
  },
});