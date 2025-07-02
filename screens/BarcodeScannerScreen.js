import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  StatusBar,
  Dimensions,
  Vibration 
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';

const { width } = Dimensions.get('window');

export default function BarcodeScannerScreen({ navigation, route }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  const onScanComplete = route.params?.onScanComplete;

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getCameraPermissions();
  }, []);

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned) return;
    
    setScanned(true);
    Vibration.vibrate(100);
    
    if (onScanComplete) {
      onScanComplete(data);
    }
    
    navigation.goBack();
  };

  const toggleFlash = () => {
    setFlashOn(!flashOn);
  };

  const resetScanner = () => {
    setScanned(false);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.centerContainer}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.noPermissionText}>No access to camera</Text>
        <Text style={styles.permissionSubtext}>
          Camera access is required to scan barcodes
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <CameraView
        style={styles.scanner}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "pdf417", "code128", "code39", "code93", "codabar", "ean13", "ean8", "upc_e", "datamatrix", "aztec"],
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
        
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={toggleFlash}
        >
          <Text style={styles.headerButtonText}>
            {flashOn ? '🔦' : '💡'}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Scanning Frame */}
      <View style={styles.scanningArea}>
        <View style={styles.scanFrame}>
          {/* Corner borders */}
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        
        <Text style={styles.instructionText}>
          {scanned ? 'Barcode Scanned!' : 'Position barcode within the frame'}
        </Text>
      </View>
      
      {/* Footer */}
      <View style={styles.footer}>
        {scanned && (
          <TouchableOpacity 
            style={styles.button}
            onPress={resetScanner}
          >
            <Text style={styles.buttonText}>Scan Another</Text>
          </TouchableOpacity>
        )}
        
        <Text style={styles.footerText}>
          Make sure the barcode is well-lit and in focus
        </Text>
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
  headerButtonText: {
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
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
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
  instructionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 30,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 50,
    alignItems: 'center',
    zIndex: 1,
  },
  button: {
    backgroundColor: '#00C897',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 15,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
  },
  
  noPermissionText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  permissionSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
});