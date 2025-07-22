// utils/uploadFoodImage.js - IMPROVED VERSION
import { supabase } from '../lib/supabase';

export const uploadFoodImage = async (imageUri, userId) => {
  if (!imageUri || !userId) {
    throw new Error('Image URI or User ID missing');
  }

  const bucket = 'pantry-item-images';
 
  try {
    console.log('Starting upload process for:', imageUri);
   
    // Extract file extension with better fallback handling
    const uriParts = imageUri.split('.');
    let fileExt = uriParts[uriParts.length - 1].split('?')[0] || 'jpg';
   
    // Normalize file extension
    fileExt = fileExt.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
      fileExt = 'jpg'; // Default fallback
    }
   
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    console.log('Generated filename:', fileName);

    // Fetch the image with timeout and better error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
   
    let response;
    try {
      response = await fetch(imageUri, {
        signal: controller.signal
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Upload timed out. Please check your connection and try again.');
      }
      throw new Error(`Failed to fetch image: ${fetchError.message}`);
    }
   
    clearTimeout(timeoutId);
   
    if (!response.ok) {
      throw new Error(`Failed to read local image file: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    console.log('Created blob, size:', blob.size, 'type:', blob.type);

    // Enhanced validation
    if (!blob.size || blob.size === 0) {
      throw new Error('Selected file is empty or corrupted');
    }

    if (blob.size > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('Image file is too large (max 10MB). Please choose a smaller image.');
    }

    if (!blob.type.startsWith('image/')) {
      throw new Error('Selected file is not a valid image');
    }

    // Upload to Supabase with proper content type
    console.log('Starting Supabase upload...');
    const { data, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, blob, {
        contentType: blob.type,
        upsert: false, // Set to false to avoid overwriting
        cacheControl: '3600' // Cache for 1 hour
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
     
      // Handle specific error types
      if (uploadError.message.includes('already exists')) {
        // If file exists, try with a new timestamp
        const newFileName = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        console.log('File exists, trying with new name:', newFileName);
       
        const { data: retryData, error: retryError } = await supabase.storage
          .from(bucket)
          .upload(newFileName, blob, {
            contentType: blob.type,
            upsert: false,
            cacheControl: '3600'
          });
         
        if (retryError) {
          throw new Error(`Upload failed after retry: ${retryError.message}`);
        }
       
        // Use the new filename for URL generation
        fileName = newFileName;
      } else if (uploadError.message.includes('quota')) {
        throw new Error('Storage quota exceeded. Please try again later.');
      } else if (uploadError.message.includes('size')) {
        throw new Error('File size exceeds allowed limit.');
      } else {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
    }

    console.log('Upload successful, getting public URL...');

    // Get public URL
    const { data: urlData, error: urlError } = supabase
      .storage
      .from(bucket)
      .getPublicUrl(fileName);

    if (urlError) {
      console.error('Supabase URL error:', urlError);
      throw new Error(`Failed to get image URL: ${urlError.message}`);
    }

    if (!urlData?.publicUrl) {
      throw new Error('Failed to generate public URL for uploaded image');
    }

    console.log('Upload completed successfully. Public URL:', urlData.publicUrl);
    return urlData.publicUrl;
   
  } catch (error) {
    console.error('uploadFoodImage error:', error);
   
    // Re-throw with more user-friendly messages
    if (error.name === 'AbortError') {
      throw new Error('Upload timed out. Please check your connection and try again.');
    }
   
    if (error.message.includes('fetch') || error.message.includes('network')) {
      throw new Error('Network error. Please check your connection and try again.');
    }
   
    // Pass through our custom error messages
    throw error;
  }
};

// Helper function to delete old images
export const deleteFoodImage = async (imageUrl) => {
  if (!imageUrl || imageUrl.startsWith('file://')) {
    return; // Nothing to delete for local files
  }

  const bucket = 'pantry-item-images';
 
  try {
    // Extract filename from URL
    const urlParts = imageUrl.split('/');
    const fileName = urlParts[urlParts.length - 1].split('?')[0];
   
    if (!fileName) {
      throw new Error('Invalid image URL format');
    }

    console.log('Deleting old image:', fileName);

    const { error } = await supabase.storage
      .from(bucket)
      .remove([fileName]);

    if (error) {
      console.error('Error deleting image:', error);
      // Don't throw here - deletion failure shouldn't break the app
      return false;
    }

    console.log('Image deleted successfully:', fileName);
    return true;
  } catch (error) {
    console.error('deleteFoodImage error:', error);
    // Don't throw here - deletion failure shouldn't break the app
    return false;
  }
};

// Alternative upload method using FormData (for some edge cases)
export const uploadFoodImageFormData = async (imageUri, userId) => {
  if (!imageUri || !userId) {
    throw new Error('Image URI or User ID missing');
  }

  try {
    const fileName = `${userId}_${Date.now()}.jpg`;
   
    // Create FormData
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      type: 'image/jpeg',
      name: fileName,
    });

    // Note: This would require a custom endpoint
    // This is here as a reference for alternative approaches
    console.log('FormData upload method - requires custom endpoint');
    throw new Error('FormData method not implemented - use blob method instead');
   
  } catch (error) {
    console.error('FormData upload error:', error);
    throw error;
  }
};

// Utility to check if image URL is valid
export const isValidImageUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
 
  // Check if it's a local file URI
  if (url.startsWith('file://')) return true;
 
  // Check if it's a valid HTTP(S) URL
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
};

// Utility to compress image before upload (optional)
export const compressImage = async (imageUri, quality = 0.8) => {
  try {
    const manipulateModule = await import('expo-image-manipulator');
    const ImageManipulator = manipulateModule.manipulateAsync;
    const SaveFormat = manipulateModule.SaveFormat;
   
    const result = await ImageManipulator(
      imageUri,
      [{ resize: { width: 800 } }], // Resize to max width of 800px
      { compress: quality, format: SaveFormat.JPEG }
    );
   
    return result.uri;
  } catch (error) {
    console.warn('Image compression failed, using original:', error);
    return imageUri; // Return original if compression fails
  }
};