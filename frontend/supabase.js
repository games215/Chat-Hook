import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Replace with your actual Supabase URL and Anon Key
const supabaseUrl = 'https://zjipgoxbvgiwmqbxljnd.supabase.co';
const supabaseAnonKey = 'sb_publishable_TiwnaLJjIfiXoFiBuRSkpg_hu-zfpzb';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);