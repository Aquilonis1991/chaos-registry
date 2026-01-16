
console.log("0. Script start (gen_topics.ts)");
import { createClient } from "@supabase/supabase-js";
console.log("1. Imports done");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log(`2. Env vars: u=${!!SUPABASE_URL}, k=${!!SUPABASE_KEY}`);

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
console.log("3. Client created");
