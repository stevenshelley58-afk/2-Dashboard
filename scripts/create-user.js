const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');

// Load env from apps/web-svelte/.env
const envPath = path.resolve(__dirname, '../apps/web-svelte/.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file from:', envPath);
  console.error('Make sure apps/web-svelte/.env exists.');
  process.exit(1);
}

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Creating a new user in Supabase...');
console.log('URL:', supabaseUrl);

rl.question('Enter email: ', (email) => {
  rl.question('Enter password: ', async (password) => {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (error) {
        console.error('Error creating user:', error.message);
      } else {
        console.log('User created successfully!');
        console.log('ID:', data.user.id);
        console.log('Email:', data.user.email);
        console.log('You can now log in with these credentials.');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      rl.close();
    }
  });
});

