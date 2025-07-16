import { supabase } from '../lib/supabase';

export const uploadFoodImage = async (imageUri, userId) => {
  if (!imageUri || !userId) {
    throw new Error('Image URI or User ID missing');
  }

  const bucket = 'pantry-item-images';
  
  try {
    const uriParts = imageUri.split('.');
    const fileExt = uriParts[uriParts.length - 1].split('?')[0] || 'jpg';
    
    const fileName = `${userId}_${Date.now()}.${fileExt}`;

    const response = await fetch(imageUri);
    if (!response.ok) {
      throw new Error('Failed to read local image file');
    }

    const blob = await response.blob();

    if (!blob.size || !blob.type.startsWith('image/')) {
      throw new Error('Selected file is not a valid image');
    }

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, blob, {
        contentType: blob.type,
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: urlData, error: urlError } = supabase
      .storage
      .from(bucket)
      .getPublicUrl(fileName);

    if (urlError) throw urlError;

    return urlData.publicUrl;
  } catch (error) {
    console.error('uploadFoodImage error:', error);
    throw error;
  }
};
