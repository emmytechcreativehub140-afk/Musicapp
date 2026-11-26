const SUPABASE_URL = 'https://bfthpzwuqqtjfbuphzgz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EF60rskIaWXj1HHfFys9MA_FfVJeQt_';

const db = SUPABASE_URL.startsWith('http')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;