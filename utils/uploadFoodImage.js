import { supabase } from '../lib/supabase';

export const uploadFoodImage = async (imageUri, userId) => {
  if (!imageUri || !userId) {
    throw new Error('Image URI or User ID missing');
  }

  const bucket = 'pantry-item-images';
  
  try {
    // Extract file extension with better fallback handling
    const uriParts = imageUri.split('.');
    let fileExt = uriParts[uriParts.length - 1].split('?')[0] || 'jpg';
    
    // Normalize file extension
    fileExt = fileExt.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
      fileExt = 'jpg'; // Default fallback
    }
    
    const fileName = `${userId}_${Date.now()}.${fileExt}`;

    // Fetch the image with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(imageUri, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Failed to read local image file: ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();

    // Enhanced validation
    if (!blob.size) {
      throw new Error('Selected file is empty');
    }

    if (blob.size > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('Image file is too large (max 10MB)');
    }

    if (!blob.type.startsWith('image/')) {
      throw new Error('Selected file is not a valid image');
    }

    // Upload to Supabase
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, blob, {
        contentType: blob.type,
        upsert: false,
        cacheControl: '3600' // Cache for 1 hour
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      
      // Handle specific error types
      if (uploadError.message.includes('already exists')) {
        throw new Error('A file with this name already exists. Please try again.');
      } else if (uploadError.message.includes('quota')) {
        throw new Error('Storage quota exceeded. Please try again later.');
      } else if (uploadError.message.includes('size')) {
        throw new Error('File size exceeds allowed limit.');
      } else {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }
    }

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

    console.log('Image uploaded successfully:', fileName);
    return urlData.publicUrl;
    
  } catch (error) {
    console.error('uploadFoodImage error:', error);
    
    // Re-throw with more user-friendly messages
    if (error.name === 'AbortError') {
      throw new Error('Upload timed out. Please check your connection and try again.');
    }
    
    if (error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection and try again.');
    }
    
    // Pass through our custom error messages
    throw error;
  }
};

// Optional: Helper function to delete old images
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

    const { error } = await supabase.storage
      .from(bucket)
      .remove([fileName]);

    if (error) {
      console.error('Error deleting image:', error);
      throw error;
    }

    console.log('Image deleted successfully:', fileName);
  } catch (error) {
    console.error('deleteFoodImage error:', error);
    // Don't throw here - deletion failure shouldn't break the app
    // but log it for debugging
  }
};