import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const ts = Date.now();
  console.log('Signing up user...');
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: `debug_${ts}@example.com`,
    password: 'password123',
  });

  if (authError) {
    console.error('Auth Error:', authError);
    return;
  }
  console.log('User signed up. ID:', authData.user.id);
  
  console.log('Inserting profile...');
  const { error: profileError } = await supabase.from('profiles').insert([{
    id: authData.user.id,
    full_name: 'Debug Test',
    email: `debug_${ts}@example.com`,
    phone_number: '5551234',
    age: parseInt('22', 10),
    role: 'student'
  }]);

  if (profileError) {
    console.error('=== PROFILE ERROR ===');
    console.error(profileError);
  } else {
    console.log('SUCCESS! Profile inserted.');
  }
}

test();
