import "dotenv/config";
import { z } from "zod";

const envSchema = z
  .object({
    CHAOS_API_EMAIL: z.string().email(),
    CHAOS_API_PASSWORD: z.string().min(1),
    OPENAI_API_KEY: z.string().min(1),
    GOOGLE_API_KEY: z.string().optional(),
    AI_PROVIDER: z.enum(["openai", "google"]).default("openai"),
    GEMINI_TEXT_MODEL: z.string().min(1).default("gemini-1.5-flash"),
    GEMINI_EMBED_MODEL: z.string().min(1).default("text-embedding-004"),
    CHROMA_URL: z.string().url().default("http://localhost:8000"),
    CHROMA_COLLECTION_NAME: z.string().min(1).default("agent_private_memory"),
    MIN_VOTES_TO_COMMENT: z.coerce.number().int().positive().default(3),
    DAILY_VOTE_LIMIT: z.coerce.number().int().positive().default(1),
    COMMENT_TOKEN_COST: z.coerce.number().int().nonnegative().default(5),
    DATA_PROTECTION_TOKEN_COST: z.coerce.number().int().nonnegative().default(30),
    CHAOS_COMMENT_MAX_CHARS: z.coerce.number().int().positive().default(120),
    CHAOS_COMMENT_MIN_CHARS: z.coerce.number().int().nonnegative().default(5),
    MEME_POST_TOKEN_COST: z.coerce.number().int().nonnegative().default(0),
    DALLE_IMAGE_SIZE: z.enum(["1024x1024", "1792x1024", "1024x1792"]).default("1024x1024"),
    AGENT_DATA_DIR: z.string().min(1).default("./data"),
    /** 對應主站 system_config arena_shield_price */
    ARENA_SHIELD_PRICE: z.coerce.number().int().nonnegative().default(100),
    /** 對應主站 arena_comment_max_length（預設 100） */
    ARENA_MAX_COMMENT_CHARS: z.coerce.number().int().positive().default(100),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_ANON_KEY: z.string().optional(),
    CHAOS_API_BASE_URL: z.string().url().optional()
  })
  .superRefine((data, ctx) => {
    const hasSupabase = Boolean(data.SUPABASE_URL && data.SUPABASE_ANON_KEY);
    if (!hasSupabase && !data.CHAOS_API_BASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "請設定 SUPABASE_URL + SUPABASE_ANON_KEY（對接真實 ChaosRegistry），或改設 CHAOS_API_BASE_URL（舊假 REST 模式）"
      });
    }
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const config = parsed.data;

export function useSupabaseBackend(): boolean {
  return Boolean(config.SUPABASE_URL && config.SUPABASE_ANON_KEY);
}
