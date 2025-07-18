import React, { useState, useEffect, useRef } from 'react';
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
  Dimensions,
  Platform,
  Linking
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

const BarcodeScannerScreen = ({ route }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productData, setProductData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentBarcode, setCurrentBarcode] = useState('');
  const [hasScanned, setHasScanned] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanCooldown, setScanCooldown] = useState(false); // New state for cooldown
  const scanTimeoutRef = useRef(null); // Ref for cooldown timeout
  const cameraRef = useRef(null);
  const navigation = useNavigation();

  // Request camera permission on mount
  useEffect(() => {
    const getPermission = async () => {
      if (!permission?.granted) {
        const { status } = await requestPermission();
        if (status !== 'granted') {
          Alert.alert(
            'Permission Required',
            'Camera access is required to scan barcodes',
            [
              {
                text: 'Open Settings',
                onPress: () => Linking.openSettings()
              },
              {
                text: 'Cancel',
                style: 'cancel'
              }
            ]
          );
        }
      }
    };
    getPermission();
  }, []);

  // Reset scanner when coming back to this screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      resetScanner();
    });
    return unsubscribe;
  }, [navigation]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) { // Use scanTimeoutRef for cleanup
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null; // Ensure ref is cleared
      }
    };
  }, []); // Empty dependency array for unmount cleanup

  const fetchProductFromOpenFoodFacts = async (barcode) => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
        { timeout: 10000 } // 10 second timeout
      );
      
      if (!response.ok) throw new Error('Network response was not ok');
      
      const data = await response.json();

      if (data.status === 1 && data.product) {
        const product = data.product;
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
      }
      return false;
    } catch (error) {
      console.error('Error fetching product:', error);
      Alert.alert('Error', 'Failed to fetch product information. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleBarCodeScanned = async ({ type, data }) => {
    if (!data || data.length < 6 || scanCooldown || scanned || hasScanned) {
        return;
    }

    setScanCooldown(true);
    scanTimeoutRef.current = setTimeout(() => {
        setScanCooldown(false);
    }, 3000);

    setScanned(true);
    setHasScanned(true);
    setCurrentBarcode(data);

    const productFound = await fetchProductFromOpenFoodFacts(data);

    if (!productFound) {
        // Optionally, you can set a state to show a message in the UI
        // setErrorMessage(`Product not found for barcode: ${data}.`);
        navigation.navigate('AddItem', {
            scannedBarcode: data,
            fromScanner: true
        });
    }
};


  const handleUseProduct = () => {
    setShowProductModal(false);
    navigation.navigate('AddItem', {
      scannedBarcode: currentBarcode,
      productData: productData,
      fromScanner: true
    });
  };

  const handleAddManually = () => {
    setShowProductModal(false);
    navigation.navigate('AddItem', {
      scannedBarcode: currentBarcode,
      fromScanner: true
    });
  };

  const toggleTorch = () => {
    setTorchEnabled(!torchEnabled);
  };

  const resetScanner = () => {
    setScanned(false);
    setHasScanned(false);
    setCurrentBarcode('');
    setProductData(null);
    setShowProductModal(false);
    // Clear the cooldown timeout if it's active
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null; // Reset the ref
    }
    setScanCooldown(false); // Ensure cooldown is off
  };

  const formatNutritionValue = (value, unit = 'g') => {
    if (!value || value === '') return 'N/A';
    return `${value}${unit}`;
  };

  const handleCameraReady = () => {
    setCameraReady(true);
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00C897" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          We need access to your camera to scan barcodes
        </Text>
        <TouchableOpacity 
          style={styles.permissionButton} 
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned || scanCooldown ? undefined : handleBarCodeScanned} // Disable scanning during cooldown
        barcodeScannerSettings={{
          barcodeTypes: [
            'ean13', 'ean8', 'upc_a', 'upc_e', 
            'code39', 'code93', 'code128',
            'codabar', 'itf14', 'datamatrix',
            'qr', 'pdf417', 'aztec'
          ],
        }}
        enableTorch={torchEnabled}
        autoFocus="on"
        focusDepth={0.5}
        onCameraReady={handleCameraReady}
      />

      {/* Scanner overlay */}
      <View style={styles.overlay}>
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        
        <Text style={styles.instruction}>
          Align the barcode within the frame
        </Text>
      </View>

      {/* Torch button */}
      <TouchableOpacity 
        style={styles.torchButton}
        onPress={toggleTorch}
      >
        <Ionicons 
          name={torchEnabled ? "flashlight" : "flashlight-outline"} 
          size={28} 
          color="#FFF" 
        />
      </TouchableOpacity>

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00C897" />
          <Text style={styles.loadingText}>Looking up product...</Text>
        </View>
      )}

      {/* Scan again button */}
      {hasScanned && !loading && (
        <TouchableOpacity
          style={styles.scanAgainButton}
          onPress={resetScanner}
        >
          <Text style={styles.scanAgainText}>Scan Another Item</Text>
        </TouchableOpacity>
      )}

      {/* Product modal */}
      <Modal
        visible={showProductModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowProductModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Product Found</Text>
              <TouchableOpacity onPress={() => setShowProductModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {productData && (
                <>
                  {productData.image && (
                    <View style={styles.imageContainer}>
                      <Image
                        source={{ uri: productData.image }}
                        style={styles.productImage}
                        resizeMode="contain"
                      />
                    </View>
                  )}

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

                  {/* Nutrition information and other details would go here */}
                </>
              )}
            </ScrollView>

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF',
  },
  permissionText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  permissionButton: {
    backgroundColor: '#00C897',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  scanFrame: {
    width: width * 0.7,
    height: width * 0.7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 16,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#00C897',
  },
  topLeft: {
    top: -1,
    left: -1,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: -1,
    right: -1,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderTopWidth: 0,
    borderRightWidth: 0,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderBottomRightRadius: 16,
  },
  instruction: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 30,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 8,
  },
  torchButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 30,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 12,
    borderRadius: 30,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 15,
    fontSize: 16,
  },
  scanAgainButton: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
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
    color: '#FFF',
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
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: width * 0.9,
    maxHeight: height * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
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
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
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
    color: '#FFF',
  },
});

export default BarcodeScannerScreen;