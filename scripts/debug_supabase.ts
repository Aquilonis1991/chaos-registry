
console.log("Before import");
import { createClient } from "@supabase/supabase-js";
console.log("After import");

const url = process.env.VITE_SUPABASE_URL;
console.log("URL:", url);

if (!url) {
    console.error("No URL");
} else {
    console.log("URL found");
}
