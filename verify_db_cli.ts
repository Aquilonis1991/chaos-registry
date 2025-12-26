
import { createClient } from '@supabase/supabase-js';

// Hardcoded configs from .env.local logic (since we can't read it easily, I'll ask user to provide or try to guess? No, I'll use the ones I saw in client.ts logic error message as a hint if available, but better: 
// I will rely on the fact that I can't easily run this without credentials.
// But wait, the previous `client.ts` view showed:
// VITE_SUPABASE_URL=https://epyykzxxglkjombvozhr.supabase.co
// VITE_SUPABASE_PUBLISHABLE_KEY=您的API_Key
// The key was a placeholder in the error message example! 
// This means I DON'T have the key.
// But the project is running. The `client.ts` imports from `import.meta.env`.

// I will create a script that runs via npx tsx and tries to load .env using dotenv
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Could not load Supabase credentials from .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfig() {
    console.log('🔍 Checking daily_topic_discount_tokens in DB...');
    const { data, error } = await supabase
        .from('system_config')
        .select('*')
        .eq('key', 'daily_topic_discount_tokens')
        .single();

    if (error) {
        console.error('❌ Error fetching config:', error);
    } else {
        console.log('✅ Config found:', data);
        if (data.category !== 'topic_cost') {
            console.warn('⚠️ Category mismatch! Expected "topic_cost", found:', data.category);
        }
    }
}

checkConfig();
