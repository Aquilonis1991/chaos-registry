
console.log("0. Script start");
import { createClient } from "@supabase/supabase-js";
console.log("1. Imports done");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log(`2. Env vars: URL=${!!SUPABASE_URL}, KEY=${!!SUPABASE_KEY}`);

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
console.log("3. Client created");

const TEST_EMAIL = "google_reviewer@test.com";
const TEST_PASSWORD = "Reviewer123!";
const EXPOSURE_LEVELS = ["normal", "medium", "high"];
const EXPOSURE_COSTS: Record<string, number> = { normal: 30, medium: 90, high: 180 };
const DURATION_DAYS = 7;
const DURATION_COST = 4;

async function main() {
    console.log("4. Main started");

    console.log(`5. Signing in as ${TEST_EMAIL}`);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });

    if (authError) {
        console.error("❌ Login failed:", authError.message);
        return;
    }
    console.log("6. Login success");

    const user = authData.user;
    if (!user) {
        console.error("❌ No user");
        return;
    }

    console.log("7. Getting profile for user:", user.id);
    let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tokens')
        .eq('id', user.id)
        .single();

    if (profileError) {
        console.error("❌ Profile error:", profileError.message);
        return;
    }
    console.log(`8. Tokens: ${profile.tokens}`);

    if (profile.tokens < 5000) {
        console.log("9. Topping up tokens...");
        await supabase.rpc('add_tokens', { p_amount: 5000, p_user_id: user.id }).catch(() => { });
        // Ignore error, try proceed
    }

    console.log("10. Starting loop");
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
        }
    }
    console.log("11. Done");
}

console.log("Executing main...");
main().catch(e => console.error("Main error:", e));
