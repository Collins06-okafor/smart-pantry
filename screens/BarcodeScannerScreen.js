import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const BarcodeScannerScreen = ({ route }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentBarcode, setCurrentBarcode] = useState('');
  const [hasScanned, setHasScanned] = useState(false); // New state to prevent multiple scans
  const navigation = useNavigation();

  useEffect(() => {
    if (!permission?.granted && permission?.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const fetchProductFromOpenFoodFacts = async (barcode) => {
    try {
      setLoading(true);
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await response.json();

      if (data.status === 1 && data.product) {
        const product = data.product;

        // Extract and format product information
        const productInfo = {
          name: product.product_name || product.product_name_en || 'Unknown Product',
          brand: product.brands || '',
          image: product.image_url || product.image_front_url || null,
          quantity: product.quantity || '',
          categories: product.categories || '',
          ingredients: product.ingredients_text || product.ingredients_text_en || '',
          nutritionGrade: product.nutrition_grade_fr || product.nutriscore_grade || '',
          allergens: product.allergens || '',
          packaging: product.packaging || '',
          stores: product.stores || '',
          countries: product.countries || '',
          barcode: barcode,
          // Nutritional information
          energy: product.nutriments?.energy_100g || '',
          fat: product.nutriments?.fat_100g || '',
          saturatedFat: product.nutriments?.saturated_fat_100g || '',
          carbs: product.nutriments?.carbohydrates_100g || '',
          sugars: product.nutriments?.sugars_100g || '',
          fiber: product.nutriments?.fiber_100g || '',
          proteins: product.nutriments?.proteins_100g || '',
          salt: product.nutriments?.salt_100g || '',
          sodium: product.nutriments?.sodium_100g || '',
        };

        setProductData(productInfo);
        setShowProductModal(true);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleBarCodeScanned = async ({ data }) => {
    console.log('Scanned data:', data); // Debugging line
    if (scanned || hasScanned) return; // Prevent multiple scans

    setScanned(true);
    setHasScanned(true); // Mark that a scan has occurred
    setCurrentBarcode(data);

    // Try to fetch product from Open Food Facts
    const productFound = await fetchProductFromOpenFoodFacts(data);

    if (!productFound) {
      // If product not found, show fallback alert
      Alert.alert(
        'Product Not Found',
        `Barcode: ${data}\n\nThis product was not found in the Open Food Facts database. You can still add it manually.`,
        [
          {
            text: 'Cancel',
            onPress: () => {
              setScanned(false);
              setHasScanned(false); // Allow rescanning after cancel
            },
            style: 'cancel',
          },
          {
            text: 'Add Manually',
            onPress: () => {
              navigation.navigate('AddItemScreen', {
                scannedBarcode: data,
                fromScanner: true // Indicate that navigation came from scanner
              });
            },
          },
        ]
      );
    }
  };

  const handleUseProduct = () => {
    setShowProductModal(false);

    // Navigate to AddItemScreen with product data
    navigation.navigate('AddItemScreen', {
      scannedBarcode: currentBarcode,
      productData: productData,
      fromScanner: true // Indicate that navigation came from scanner
    });
  };

  const handleAddManually = () => {
    setShowProductModal(false);

    // Navigate to AddItemScreen with just the barcode
    navigation.navigate('AddItemScreen', {
      scannedBarcode: currentBarcode,
      fromScanner: true // Indicate that navigation came from scanner
    });
  };

  const formatNutritionValue = (value, unit = 'g') => {
    if (!value || value === '') return 'N/A';
    return `${value}${unit}`;
  };

  const resetScanner = () => {
    setScanned(false);
    setHasScanned(false); // Reset hasScanned to allow new scans
    setCurrentBarcode('');
  };

  const ProductModal = () => (
    <Modal
      visible={showProductModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowProductModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Product Found!</Text>
            <TouchableOpacity onPress={() => setShowProductModal(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {productData && (
              <>
                {/* Product Image */}
                {productData.image && (
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: productData.image }}
                      style={styles.productImage}
                      resizeMode="contain"
                    />
                  </View>
                )}

                {/* Basic Product Info */}
                <View style={styles.infoSection}>
                  <Text style={styles.productName}>{productData.name}</Text>
                  {productData.brand && (
                    <Text style={styles.productBrand}>{productData.brand}</Text>
                  )}
                  <View style={styles.barcodeContainer}>
                    <Ionicons name="barcode" size={16} color="#666" />
                    <Text style={styles.barcodeText}>{productData.barcode}</Text>
                  </View>
                </View>

                {/* Quick Info Cards */}
                <View style={styles.quickInfoGrid}>
                  {productData.quantity && (
                    <View style={styles.quickInfoCard}>
                      <Ionicons name="cube" size={20} color="#00C897" />
                      <Text style={styles.quickInfoLabel}>Quantity</Text>
                      <Text style={styles.quickInfoValue}>{productData.quantity}</Text>
                    </View>
                  )}

                  {productData.nutritionGrade && (
                    <View style={styles.quickInfoCard}>
                      <Ionicons name="nutrition" size={20} color="#00C897" />
                      <Text style={styles.quickInfoLabel}>Nutri-Score</Text>
                      <Text style={[styles.quickInfoValue, styles.nutritionGrade]}>
                        {productData.nutritionGrade.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Detailed Information */}
                {productData.categories && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Categories</Text>
                    <Text style={styles.sectionContent}>{productData.categories}</Text>
                  </View>
                )}

                {productData.ingredients && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Ingredients</Text>
                    <Text style={styles.sectionContent}>{productData.ingredients}</Text>
                  </View>
                )}

                {productData.allergens && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Allergens</Text>
                    <Text style={styles.sectionContent}>{productData.allergens}</Text>
                  </View>
                )}

                {/* Nutritional Information */}
                {(productData.energy || productData.fat || productData.carbs || productData.proteins) && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Nutritional Information (per 100g)</Text>
                    <View style={styles.nutritionGrid}>
                      {productData.energy && (
                        <View style={styles.nutritionItem}>
                          <Text style={styles.nutritionLabel}>Energy</Text>
                          <Text style={styles.nutritionValue}>{formatNutritionValue(productData.energy, 'kJ')}</Text>
                        </View>
                      )}
                      {productData.fat && (
                        <View style={styles.nutritionItem}>
                          <Text style={styles.nutritionLabel}>Fat</Text>
                          <Text style={styles.nutritionValue}>{formatNutritionValue(productData.fat)}</Text>
                        </View>
                      )}
                      {productData.carbs && (
                        <View style={styles.nutritionItem}>
                          <Text style={styles.nutritionLabel}>Carbs</Text>
                          <Text style={styles.nutritionValue}>{formatNutritionValue(productData.carbs)}</Text>
                        </View>
                      )}
                      {productData.proteins && (
                        <View style={styles.nutritionItem}>
                          <Text style={styles.nutritionLabel}>Proteins</Text>
                          <Text style={styles.nutritionValue}>{formatNutritionValue(productData.proteins)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={handleAddManually}
            >
              <Text style={styles.secondaryButtonText}>Add Manually</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton]}
              onPress={handleUseProduct}
            >
              <Text style={styles.primaryButtonText}>Use This Product</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Loading state while checking permissions
  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Loading camera...</Text>
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          Camera access is required to scan barcodes
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: [
            'qr',
            'pdf417',
            'aztec',
            'ean13',
            'ean8',
            'upc_e',
            'code39',
            'code93',
            'code128',
            'code39mod43',
            'codabar',
            'datamatrix',
            'itf14',
            'interleaved2of5',
            'upc_a',
          ],
        }}
      />

      {/* Overlay with scanning frame */}
      <View style={styles.overlay}>
        <View style={styles.scanFrame}>
          <View style={styles.corner} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>

        <Text style={styles.instruction}>
          Position the barcode within the frame
        </Text>
      </View>

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00C897" />
          <Text style={styles.loadingText}>Fetching product details...</Text>
        </View>
      )}

      {/* Scan again button */}
      {hasScanned && !loading && ( // Use hasScanned to show the button after any scan attempt
        <View style={styles.scanAgainContainer}>
          <TouchableOpacity
            style={styles.scanAgainButton}
            onPress={resetScanner} // Use the new resetScanner function
          >
            <Text style={styles.scanAgainText}>Tap to Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Product Modal */}
      <ProductModal />
    </View>
  );
};

export default BarcodeScannerScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 250,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#00C897',
    borderWidth: 3,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    top: -2,
    left: -2,
  },
  topRight: {
    top: -2,
    right: -2,
    left: 'auto',
    transform: [{ rotate: '90deg' }],
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    top: 'auto',
    transform: [{ rotate: '-90deg' }],
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    top: 'auto',
    left: 'auto',
    transform: [{ rotate: '180deg' }],
  },
  instruction: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 30,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  scanAgainContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  scanAgainButton: {
    backgroundColor: '#00C897',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  scanAgainText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: width * 0.9,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  modalBody: {
    padding: 20,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  productImage: {
    width: 150,
    height: 150,
    borderRadius: 8,
  },
  infoSection: {
    marginBottom: 20,
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  productBrand: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  barcodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barcodeText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 5,
  },
  quickInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  quickInfoCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  quickInfoLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  quickInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  nutritionGrade: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00C897',
  },
  detailSection: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    width: '48%',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  nutritionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#F5F5F5',
    marginRight: 10,
  },
  primaryButton: {
    backgroundColor: '#00C897',
    marginLeft: 10,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
