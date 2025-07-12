import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  Image, 
  ScrollView, 
  ActivityIndicator, 
  StyleSheet, 
  TouchableOpacity,
  Linking,
  Dimensions
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const API_KEY = '62f8f2c9d58b4ff3952e3c6ae227136c';

export default function RecipeDetailScreen() {
  const route = useRoute();
  const { recipeId } = route.params;
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ingredients');

  useEffect(() => {
    const fetchRecipeDetails = async () => {
      try {
        const response = await fetch(
          `https://api.spoonacular.com/recipes/${recipeId}/information?includeNutrition=true&apiKey=${API_KEY}`
        );
        const data = await response.json();
        setRecipe(data);
      } catch (error) {
        console.error('Failed to fetch recipe details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecipeDetails();
  }, [recipeId]);

  const renderNutritionInfo = () => {
    if (!recipe.nutrition?.nutrients) return null;
    
    const importantNutrients = ['Calories', 'Protein', 'Carbohydrates', 'Fat', 'Fiber'];
    
    return (
      <View style={styles.nutritionContainer}>
        <Text style={styles.sectionTitle}>Nutrition Facts</Text>
        <View style={styles.nutritionGrid}>
          {recipe.nutrition.nutrients
            .filter(nutrient => importantNutrients.includes(nutrient.name))
            .map((nutrient, index) => (
              <View key={index} style={styles.nutrientCard}>
                <Text style={styles.nutrientAmount}>
                  {Math.round(nutrient.amount)}{nutrient.unit}
                </Text>
                <Text style={styles.nutrientName}>{nutrient.name}</Text>
              </View>
            ))}
        </View>
      </View>
    );
  };

  const renderIngredients = () => (
    <View style={styles.section}>
      {recipe.extendedIngredients.map((ingredient, index) => (
        <View key={index} style={styles.ingredientItem}>
          <View style={styles.ingredientBullet} />
          <Text style={styles.ingredientText}>
            {ingredient.original}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderInstructions = () => (
    <View style={styles.section}>
      {recipe.analyzedInstructions?.[0]?.steps ? (
        recipe.analyzedInstructions[0].steps.map((step, index) => (
          <View key={index} style={styles.stepContainer}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{step.number}</Text>
            </View>
            <Text style={styles.stepText}>{step.step}</Text>
          </View>
        ))
      ) : recipe.instructions ? (
        <Text style={styles.stepText}>
          {recipe.instructions.replace(/<[^>]*>/g, '')}
        </Text>
      ) : (
        <Text style={styles.noInstructions}>No instructions available</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00C897" />
        <Text style={styles.loadingText}>Preparing your recipe...</Text>
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={styles.centered}>
        <Ionicons name="sad-outline" size={48} color="#ff6b6b" />
        <Text style={styles.errorText}>Recipe not found</Text>
        <Text style={styles.errorSubtext}>Please try another recipe</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={{ uri: recipe.image }} style={styles.image} />
      
      <View style={styles.header}>
        <Text style={styles.title}>{recipe.title}</Text>
        <View style={styles.metaContainer}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={styles.metaText}>{recipe.readyInMinutes} min</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="restaurant-outline" size={16} color="#666" />
            <Text style={styles.metaText}>{recipe.servings} servings</Text>
          </View>
        </View>
      </View>

      <Text style={styles.summary}>{recipe.summary.replace(/<[^>]*>/g, '')}</Text>

      {renderNutritionInfo()}

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ingredients' && styles.activeTab]}
          onPress={() => setActiveTab('ingredients')}
        >
          <Text style={[styles.tabText, activeTab === 'ingredients' && styles.activeTabText]}>
            Ingredients
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'instructions' && styles.activeTab]}
          onPress={() => setActiveTab('instructions')}
        >
          <Text style={[styles.tabText, activeTab === 'instructions' && styles.activeTabText]}>
            Instructions
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'ingredients' ? renderIngredients() : renderInstructions()}

      <TouchableOpacity 
        style={styles.sourceButton}
        onPress={() => Linking.openURL(recipe.sourceUrl)}
      >
        <Text style={styles.sourceButtonText}>View Original Recipe</Text>
        <Ionicons name="open-outline" size={18} color="#00C897" />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
    backgroundColor: '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
    fontSize: 16,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ff6b6b',
    marginTop: 16,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  image: {
    width: '100%',
    height: width * 0.7,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  metaContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  metaText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  summary: {
    fontSize: 15,
    lineHeight: 22,
    color: '#555',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  nutritionContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nutrientCard: {
    width: '48%',
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  nutrientAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00C897',
  },
  nutrientName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#00C897',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  section: {
    paddingHorizontal: 20,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00C897',
    marginTop: 8,
    marginRight: 10,
  },
  ingredientText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#444',
    flex: 1,
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#00C897',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  stepText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#444',
    flex: 1,
  },
  noInstructions: {
    fontSize: 15,
    color: '#888',
    fontStyle: 'italic',
  },
  sourceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#00C897',
    borderRadius: 10,
  },
  sourceButtonText: {
    color: '#00C897',
    fontWeight: '600',
    marginRight: 8,
  },
});