
const SUPABASE_URL = 'https://sbuznhhojbpyhvfhfkll.supabase.co';

const SUPABASE_ANON_KEY = 'sb_publishable_wD2-EB1LJW85trTpUjvhLw_1mNc_aj9';

const foodFusionSupabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
