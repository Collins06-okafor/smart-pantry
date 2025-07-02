import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  StatusBar,
  Dimensions,
  Vibration,
  Animated
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';

const { width, height } = Dimensions.get('window');

export default function BarcodeScannerScreen({ navigation, route }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [scanLineAnimation] = useState(new Animated.Value(0));
  const [isProcessing, setIsProcessing] = useState(false);

  const onScanComplete = route.params?.onScanComplete;

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getCameraPermissions();
    startScanLineAnimation();
  }, []);

  const startScanLineAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned || isProcessing) return;
    
    setScanned(true);
    setIsProcessing(true);
    Vibration.vibrate([100, 50, 100]);
    
    try {
      // Validate barcode format
      if (!isValidBarcode(data)) {
        Alert.alert(
          'Invalid Barcode',
          'The scanned code doesn\'t appear to be a valid product barcode.',
          [{ text: 'Try Again', onPress: resetScanner }]
        );
        return;
      }

      if (onScanComplete) {
        await onScanComplete(data);
      }
      
      // Delay before going back to allow user to see success state
      setTimeout(() => {
        navigation.goBack();
      }, 1000);
      
    } catch (error) {
      console.error('Error processing barcode:', error);
      Alert.alert(
        'Processing Error',
        'Failed to process the barcode. Please try again.',
        [{ text: 'Try Again', onPress: resetScanner }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const isValidBarcode = (data) => {
    // Basic validation for common barcode formats
    const patterns = [
      /^\d{12,14}$/, // EAN-13, EAN-8, UPC-A, UPC-E
      /^[0-9A-Z\-\.\ \$\/\+\%]+$/, // Code 39, Code 128
    ];
    
    return patterns.some(pattern => pattern.test(data)) && data.length >= 8;
  };

  const toggleFlash = () => {
    setFlashOn(!flashOn);
  };

  const resetScanner = () => {
    setScanned(false);
    setIsProcessing(false);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.noPermissionText}>Camera Access Required</Text>
        <Text style={styles.permissionSubtext}>
          Please enable camera access in your device settings to scan barcodes.
        </Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scanLineTranslateY = scanLineAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width * 0.4 - 2],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      <CameraView
        style={styles.scanner}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: [
            "qr", "pdf417", "code128", "code39", "code93", 
            "codabar", "ean13", "ean8", "upc_e", "upc_a",
            "datamatrix", "aztec", "itf14"
          ],
        }}
        enableTorch={flashOn}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.headerButtonText}>✕</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Scan Barcode</Text>
        
        <TouchableOpacity 
          style={[styles.headerButton, flashOn && styles.flashActive]}
          onPress={toggleFlash}
        >
          <Text style={styles.headerButtonText}>
            {flashOn ? '🔦' : '💡'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Scanning Area */}
      <View style={styles.scanningArea}>
        <View style={styles.scanFrame}>
          {/* Corner borders */}
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          
          {/* Animated scan line */}
          {!scanned && (
            <Animated.View 
              style={[
                styles.scanLine,
                { transform: [{ translateY: scanLineTranslateY }] }
              ]} 
            />
          )}
          
          {/* Success indicator */}
          {scanned && (
            <View style={styles.successIndicator}>
              <Text style={styles.successText}>✓</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.instructionText}>
          {isProcessing ? 'Processing...' : 
           scanned ? 'Barcode Scanned Successfully!' : 
           'Position barcode within the frame'}
        </Text>
        
        {scanned && !isProcessing && (
          <TouchableOpacity 
            style={styles.scanAgainButton}
            onPress={resetScanner}
          >
            <Text style={styles.scanAgainText}>Scan Another</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Tips for better scanning:</Text>
          <Text style={styles.tipsText}>• Hold device steady</Text>
          <Text style={styles.tipsText}>• Ensure good lighting</Text>
          <Text style={styles.tipsText}>• Keep barcode in focus</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  scanner: {
    ...StyleSheet.absoluteFillObject,
  },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 1,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  
  scanningArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  scanFrame: {
    width: width * 0.8,
    height: width * 0.4,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 25,
    height: 25,
    borderColor: '#00C897',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#00C897',
    shadowColor: '#00C897',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
  successIndicator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00C897',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: 'bold',
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 30,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  scanAgainButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 15,
  },
  scanAgainText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
    zIndex: 1,
  },
  tipsContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  tipsTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tipsText: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 2,
  },
  
  button: {
    backgroundColor: '#00C897',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  permissionText: {
    fontSize: 16,
    color: '#666',
  },
  noPermissionText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  permissionSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
});