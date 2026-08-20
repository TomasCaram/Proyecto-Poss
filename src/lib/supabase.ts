import { createClient } from '@supabase/supabase-js';

console.log("URL =", import.meta.env.VITE_SUPABASE_URL);
console.log("KEY =", import.meta.env.VITE_SUPABASE_ANON_KEY);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);