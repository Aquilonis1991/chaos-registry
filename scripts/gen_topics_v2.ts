
console.log("0. Script start (gen_topics_v2.ts)");
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local from the current working directory
const result = dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
console.log("1. Dotenv loaded:", result.error ? "Error: " + result.error.message : "Success");

import { createClient } from "@supabase/supabase-js";
console.log("2. Imports done");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log(`3. Env vars: URL=${!!SUPABASE_URL}, KEY=${!!SUPABASE_KEY}`);
if (SUPABASE_URL) console.log(`   URL: ${SUPABASE_URL}`);

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing env vars in .env.local");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
console.log("4. Client created");

const TEST_EMAIL = "google_reviewer@test.com";
const TEST_PASSWORD = "Reviewer123!";
const EXPOSURE_LEVELS = ["normal", "medium", "high"];
const EXPOSURE_COSTS: Record<string, number> = { normal: 30, medium: 90, high: 180 };
const DURATION_DAYS = 7;
const DURATION_COST = 4;

async function main() {
    console.log("5. Main started");

    console.log(`6. Signing in as ${TEST_EMAIL}`);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });

    if (authError) {
        console.error("❌ Login failed:", authError.message);
        // Try signup
        return;
    }
    console.log("7. Login success");

    const user = authData.user;
    if (!user) {
        console.error("❌ No user");
        return;
    }

    // Top up tokens if needed
    let { data: profile } = await supabase.from('profiles').select('tokens').eq('id', user.id).single();
    if (profile && profile.tokens < 5000) {
        console.log("8. Topping up tokens...");
        // Using public key this might fail if no RLS allowance, but worth a shot or relying on existing tokens
        await supabase.rpc('add_tokens', { p_amount: 5000, p_user_id: user.id }).catch(() => { });
    }

    console.log("9. Starting loop");
    for (let i = 0; i < 30; i++) {
        let exposureLevel = "normal";
        if (i >= 10 && i < 20) exposureLevel = "medium";
        if (i >= 20) exposureLevel = "high";

        const title = `[Auto] Topic ${i + 1} - ${exposureLevel}`;
        const description = `Auto-generated topic ${i + 1} (${exposureLevel})`;

        console.log(`   Topic ${i + 1}: ${title}`);

        const options = [
            { id: crypto.randomUUID(), text: "Yes", votes: 0 },
            { id: crypto.randomUUID(), text: "No", votes: 0 }
        ];

        const { data: topic, error: topicError } = await supabase
            .from('topics')
            .insert({
                creator_id: user.id,
                title: title,
                description: description,
                options: options,
                tags: ["Test", exposureLevel],
                category: "other",
                exposure_level: exposureLevel,
                duration_days: DURATION_DAYS,
                end_at: new Date(Date.now() + DURATION_DAYS * 86400000).toISOString(),
                status: 'active',
                votes: {}
            })
            .select()
            .single();

        if (topicError) {
            console.error(`      ❌ Error: ${topicError.message}`);
        } else {
            console.log(`      ✅ Created: ${topic.id}`);

            // Deduct cost and log transaction (simplified for script)
            const exposureCost = EXPOSURE_COSTS[exposureLevel];
            const totalCost = exposureCost + DURATION_COST;

            // Note: In real app these are secured, with public key we can only do what RLS allows.
            // Topics insert allowed? Yes for auth users.
            // Profile update? Usually protected.
            // RPC log? Maybe.
        }
    }
    console.log("10. Done");
}

console.log("Executing main...");
main().catch(e => console.error("Main error:", e));
