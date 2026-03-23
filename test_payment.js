import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testPayment() {
  console.log('Logging in as staging1@test.com...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'staging1@test.com',
    password: 'password',
  });

  if (authError) {
    console.error('Login Failed:', authError);
    return;
  }
  console.log('Logged in! User ID:', authData.user.id);
  
  console.log('Attempting to insert a pending payment directly into the database...');
  const { data, error: paymentError } = await supabase.from('payments').insert([{
    student_id: authData.user.id,
    month_for: 'March 2026',
    amount: 100,
    proof_url: 'dummy_image.jpg',
    status: 'pending'
  }]).select();

  if (paymentError) {
    console.error('=== DIRECT INSERT ERROR ===');
    console.error(paymentError);
  } else {
    console.log('SUCCESS! Payment inserted directly successfully.');
    console.log('Data:', data);
  }
}

testPayment();
