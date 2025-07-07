// supabase.js
import { createClient } from '@supabase/supabase-js';

// Replace these with your Supabase project URL and anon key
const SUPABASE_URL = 'https://qnmjkwhmjwkdlenkmrit.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFubWprd2htandrZGxlbmttcml0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyNzA5MjEsImV4cCI6MjA2Njg0NjkyMX0.1oVKRlLp5n2MzYKXy1NxAVp2oGuS54z-qfMhkSu1X9o';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
