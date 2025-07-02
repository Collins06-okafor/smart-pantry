// lib/productService.js
import { Alert } from 'react-native';

class ProductService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  async fetchProductInfo(barcode) {
    console.log('🔍 ProductService: Fetching product info for:', barcode);
    
    // Check cache first
    const cached = this.getCachedProduct(barcode);
    if (cached) {
      console.log('📦 ProductService: Using cached data');
      return cached;
    }

    try {
      // Try multiple APIs in order of preference
      const result = await this.tryMultipleAPIs(barcode);
      
      if (result) {
        // Cache successful result
        this.cacheProduct(barcode, result);
        return result;
      }
      
      return null;
    } catch (error) {
      console.error('🚨 ProductService: Error fetching product info:', error);
      throw error;
    }
  }

  async tryMultipleAPIs(barcode) {
    const apis = [
      () => this.fetchFromOpenFoodFacts(barcode),
      () => this.fetchFromUPCDatabase(barcode),
      () => this.fetchFromBarcodeLookup(barcode),
    ];

    for (const apiCall of apis) {
      try {
        const result = await apiCall();
        if (result && result.found) {
          console.log('✅ ProductService: Found product data');
          return result;
        }
      } catch (error) {
        console.log('⚠️ ProductService: API call failed, trying next...', error.message);
        continue;
      }
    }

    return null;
  }

  async fetchFromOpenFoodFacts(barcode) {
    console.log('🌍 ProductService: Trying Open Food Facts API');
    
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      {
        timeout: 10000,
        headers: {
          'User-Agent': 'SmartPantry/1.0.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.status === 1 && data.product) {
      const product = data.product;
      return {
        found: true,
        source: 'Open Food Facts',
        name: product.product_name || product.product_name_en || '',
        brand: product.brands || '',
        category: product.categories || '',
        imageUrl: product.image_url || product.image_front_url || '',
        ingredients: product.ingredients_text || '',
        nutritionGrade: product.nutrition_grade_fr || '',
        allergens: product.allergens || '',
        packaging: product.packaging || '',
        servingSize: product.serving_size || '',
        expirationHint: this.getExpirationHint(product.categories),
      };
    }

    return { found: false };
  }

  async fetchFromUPCDatabase(barcode) {
    console.log('📊 ProductService: Trying UPC Database API');
    
    // Note: This is a placeholder - you'd need an actual API key
    // UPC Database API requires registration
    const API_KEY = 'your-upc-database-api-key';
    
    if (!API_KEY || API_KEY === 'your-upc-database-api-key') {
      return { found: false };
    }

    const response = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
      {
        headers: {
          'user_key': API_KEY,
          'key_type': 'basic',
        },
      }
    );

    const data = await response.json();
    
    if (data.code === 'OK' && data.items && data.items.length > 0) {
      const item = data.items[0];
      return {
        found: true,
        source: 'UPC Database',
        name: item.title || '',
        brand: item.brand || '',
        category: item.category || '',
        imageUrl: item.images && item.images.length > 0 ? item.images[0] : '',
        description: item.description || '',
        expirationHint: this.getExpirationHint(item.category),
      };
    }

    return { found: false };
  }

  async fetchFromBarcodeLookup(barcode) {
    console.log('🔍 ProductService: Trying Barcode Lookup API');
    
    // Another placeholder - Barcode Lookup API also requires registration
    const API_KEY = 'your-barcode-lookup-api-key';
    
    if (!API_KEY || API_KEY === 'your-barcode-lookup-api-key') {
      return { found: false };
    }

    const response = await fetch(
      `https://api.barcodelookup.com/v3/products?barcode=${barcode}&formatted=n&key=${API_KEY}`
    );

    const data = await response.json();
    
    if (data.products && data.products.length > 0) {
      const product = data.products[0];
      return {
        found: true,
        source: 'Barcode Lookup',
        name: product.product_name || product.title || '',
        brand: product.brand || '',
        category: product.category || '',
        imageUrl: product.images && product.images.length > 0 ? product.images[0] : '',
        description: product.description || '',
        expirationHint: this.getExpirationHint(product.category),
      };
    }

    return { found: false };
  }

  getExpirationHint(category) {
    if (!category) return null;
    
    const categoryLower = category.toLowerCase();
    
    // Provide suggested expiration periods based on category
    const hints = {
      'dairy': 7,           // 7 days
      'milk': 7,
      'yogurt': 14,
      'cheese': 30,
      'meat': 3,            // 3 days
      'fish': 2,            // 2 days
      'seafood': 2,
      'poultry': 3,
      'chicken': 3,
      'beef': 5,
      'bread': 5,
      'bakery': 3,
      'vegetables': 7,
      'fruits': 5,
      'fruit': 5,
      'frozen': 90,         // 3 months
      'canned': 365,        // 1 year
      'beverages': 30,
      'snacks': 60,
    };

    for (const [key, days] of Object.entries(hints)) {
      if (categoryLower.includes(key)) {
        return days;
      }
    }

    return null; // No hint available
  }

  getCachedProduct(barcode) {
    const cached = this.cache.get(barcode);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    return null;
  }

  cacheProduct(barcode, data) {
    this.cache.set(barcode, {
      data,
      timestamp: Date.now(),
    });
  }

  // Method to suggest expiration date based on product info
  suggestExpirationDate(productInfo) {
    const today = new Date();
    let suggestedDays = 30; // Default 30 days
    
    if (productInfo && productInfo.expirationHint) {
      suggestedDays = productInfo.expirationHint;
    }
    
    const expirationDate = new Date(today.getTime() + (suggestedDays * 24 * 60 * 60 * 1000));
    return expirationDate.toISOString().split('T')[0];
  }

  // Method to show product information in a nice format
  showProductInfo(productInfo) {
    if (!productInfo || !productInfo.found) {
      Alert.alert(
        'Product Not Found',
        'Product information not available. Please enter details manually.',
        [{ text: 'OK' }]
      );
      return;
    }

    const details = [
      productInfo.name && `Name: ${productInfo.name}`,
      productInfo.brand && `Brand: ${productInfo.brand}`,
      productInfo.category && `Category: ${productInfo.category}`,
      `Source: ${productInfo.source}`,
    ].filter(Boolean).join('\n');

    Alert.alert(
      'Product Found! 🎉',
      details,
      [{ text: 'OK' }]
    );
  }
}

// Export singleton instance
export const productService = new ProductService();

// Usage example for AddItemScreen:
/*
const fetchProductInfo = async (barcodeData) => {
  setLoading(true);
  try {
    const productInfo = await productService.fetchProductInfo(barcodeData);
    
    if (productInfo && productInfo.found) {
      setItemName(productInfo.name || '');
      
      // Auto-suggest expiration date
      const suggestedDate = productService.suggestExpirationDate(productInfo);
      setExpirationDate(suggestedDate);
      
      // Show product info
      productService.showProductInfo(productInfo);
    } else {
      Alert.alert(
        'Product Not Found',
        'Product information not found. Please enter details manually.',
        [{ text: 'OK' }]
      );
    }
  } catch (error) {
    console.log('Error fetching product info:', error);
    Alert.alert(
      'Info',
      'Barcode scanned successfully! Please enter product details manually.',
      [{ text: 'OK' }]
    );
  } finally {
    setLoading(false);
  }
};
*/