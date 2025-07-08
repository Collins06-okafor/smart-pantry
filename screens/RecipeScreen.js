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

const { width } = Dimensions.get('window');

export default function RecipeScreen() {
  const [pantryItems, setPantryItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('pantry'); // 'pantry', 'search', 'random'
  const [searchLoading, setSearchLoading] = useState(false);

  const API_KEY = '62f8f2c9d58b4ff3952e3c6ae227136c';

  const [userAllergies, setUserAllergies] = useState([]);

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
        const allergyList = data.allergies
          .split(',')
          .map(a => a.trim().toLowerCase());
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
      // Check missedIngredients (from ingredient-based search)
      const missedIngredients = recipe?.missedIngredients || [];
      const hasMissedAllergen = missedIngredients.some(ingredient =>
        allergySet.has(ingredient.name?.toLowerCase())
      );

      // Check usedIngredients (from ingredient-based search)
      const usedIngredients = recipe?.usedIngredients || [];
      const hasUsedAllergen = usedIngredients.some(ingredient =>
        allergySet.has(ingredient.name?.toLowerCase())
      );

      // Check extendedIngredients (from complex search/random recipes)
      const extendedIngredients = recipe?.extendedIngredients || [];
      const hasExtendedAllergen = extendedIngredients.some(ingredient =>
        allergySet.has(ingredient.name?.toLowerCase())
      );

      // Return false if any allergen is found
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

  const fetchRecipesByCategory = async (cuisine = '', diet = '') => {
    setLoading(true);
    try {
      let url = `https://api.spoonacular.com/recipes/complexSearch?number=10&apiKey=${API_KEY}&addRecipeInformation=true`;
      if (cuisine) url += `&cuisine=${cuisine}`;
      if (diet) url += `&diet=${diet}`;

      const response = await fetch(url);
      const result = await response.json();

      if (result.results && Array.isArray(result.results)) {
        const filtered = filterRecipesByAllergy(result.results);
        setRecipes(filtered);
        setError('');
      } else {
        setRecipes([]);
        setError('No recipes found for this category.');
      }
    } catch (err) {
      console.error('Category recipes error:', err.message);
      setError('Failed to fetch category recipes.');
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
    // Handle both ingredient-based and search-based recipe formats
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



    return (
      <View style={styles.card}>
        <Image source={{ uri: recipeData.image }} style={styles.image} />
        <Text style={styles.title}>{recipeData.title}</Text>

        {recipeData.readyInMinutes && (
          <Text style={styles.metaText}>⏱️ {recipeData.readyInMinutes} mins</Text>
        )}
        {recipeData.servings && (
          <Text style={styles.metaText}>🍽️ Serves {recipeData.servings}</Text>
        )}

        {caloriesInfo && (
  <Text style={styles.metaText}>🔥 {Math.round(caloriesInfo.amount)} {caloriesInfo.unit} Calories</Text>
)}


        {recipeData.usedIngredients?.length > 0 && (
          <Text style={styles.ingredients}>
            Used: {recipeData.usedIngredients.map(ing => ing.name).join(', ')}
          </Text>
        )}
        {recipeData.missedIngredients?.length > 0 && (
          <Text style={[styles.ingredients, styles.missing]}>
            Missing: {recipeData.missedIngredients.map(ing => ing.name).join(', ')}
          </Text>
        )}

        <TouchableOpacity
          onPress={() =>
            Linking.openURL(`https://spoonacular.com/recipes/${recipeData.title.replace(/ /g, '-')}-${recipeData.id}`)
          }
        >
          <Text style={styles.link}>View Recipe</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTabBar = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'pantry' && styles.activeTab]}
        onPress={() => handleTabChange('pantry')}
      >
        <Text style={[styles.tabText, activeTab === 'pantry' && styles.activeTabText]}>
          From Pantry
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'search' && styles.activeTab]}
        onPress={() => handleTabChange('search')}
      >
        <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
          Search
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'random' && styles.activeTab]}
        onPress={() => handleTabChange('random')}
      >
        <Text style={[styles.tabText, activeTab === 'random' && styles.activeTabText]}>
          Random
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search for recipes..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSubmitEditing={() => searchRecipes(searchQuery)}
      />
      <TouchableOpacity
        style={styles.searchButton}
        onPress={() => searchRecipes(searchQuery)}
        disabled={searchLoading}
      >
        {searchLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.searchButtonText}>Search</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderQuickFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => fetchRecipesByCategory('african')}
      >
        <Text style={styles.filterText}>🍲 Nigerian</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => fetchRecipesByCategory('italian')}
      >
        <Text style={styles.filterText}>🍝 Italian</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => fetchRecipesByCategory('asian')}
      >
        <Text style={styles.filterText}>🍜 Asian</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => fetchRecipesByCategory('mexican')}
      >
        <Text style={styles.filterText}>🌮 Mexican</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => fetchRecipesByCategory('', 'vegetarian')}
      >
        <Text style={styles.filterText}>🥗 Vegetarian</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => fetchRecipesByCategory('', 'vegan')}
      >
        <Text style={styles.filterText}>🌱 Vegan</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Add allergy indicator if user has allergies
  const renderAllergyIndicator = () => {
    if (userAllergies.length === 0) return null;
    
    return (
      <View style={styles.allergyIndicator}>
        <Text style={styles.allergyText}>
          🚫 Filtering out: {userAllergies.join(', ')}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C897" />
        <Text style={{ color: '#666', marginTop: 10 }}>
          {activeTab === 'pantry' ? 'Fetching recipes...' : 'Loading...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Recipe Discovery</Text>
      
      {renderTabBar()}
      {renderAllergyIndicator()}
      
      {activeTab === 'pantry' && pantryItems.length > 0 && (
        <Text style={styles.basedOnText}>
          Based on: {pantryItems.join(', ')}
        </Text>
      )}
      
      {activeTab === 'search' && (
        <>
          {renderSearchBar()}
          {renderQuickFilters()}
        </>
      )}

      {error ? (
        <View style={styles.centered}>
          <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text>
        </View>
      ) : recipes.length === 0 && !loading ? (
        <View style={styles.centered}>
          <Text>
            {activeTab === 'search' 
              ? 'Enter a search term to find recipes' 
              : 'No recipes found'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderRecipeItem}
          contentContainerStyle={{ paddingBottom: 30 }}
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#00C897',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  allergyIndicator: {
    backgroundColor: '#fff3cd',
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  allergyText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#00C897',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  filtersContainer: {
    marginBottom: 16,
  },
  filterButton: {
    backgroundColor: '#f8f8f8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  basedOnText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: width * 0.5,
    borderRadius: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  metaText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  ingredients: {
    fontSize: 13,
    marginBottom: 4,
    color: '#444',
  },
  missing: {
    color: '#999',
    fontStyle: 'italic',
  },
  link: {
    color: '#00C897',
    fontWeight: 'bold',
    fontSize: 16,
    marginTop: 8,
  },
});