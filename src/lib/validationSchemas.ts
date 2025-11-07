import { z } from 'zod';

export const topicSchema = z.object({
  title: z.string()
    .trim()
    .min(5, { message: "標題至少需要 5 個字元" })
    .max(200, { message: "標題不能超過 200 個字元" }),
  description: z.string()
    .trim()
    .max(150, { message: "主題詳述不能超過 150 個字元" })
    .optional(),
  options: z.array(z.string().trim().min(1, { message: "選項不能為空" }))
    .min(2, { message: "至少需要 2 個選項" })
    .max(6, { message: "最多只能 6 個選項" }),
  category: z.string().min(1, { message: "請選擇分類" }),
  tags: z.array(z.string()).max(5, { message: "最多只能選擇 5 個標籤" }),
  exposure_level: z.enum(['normal', 'medium', 'high']),
  duration_days: z.number().min(1).max(30)
});

export const voteSchema = z.object({
  topic_id: z.string().uuid({ message: "無效的主題 ID" }),
  option: z.string().min(1, { message: "請選擇一個選項" }),
  amount: z.number()
    .min(1, { message: "投票數量至少為 1" })
    .max(1000, { message: "單次投票最多 1000 票" })
});

export const profileUpdateSchema = z.object({
  nickname: z.string()
    .trim()
    .min(1, { message: "暱稱不能為空" })
    .max(50, { message: "暱稱不能超過 50 個字元" }),
  avatar: z.string().max(10, { message: "頭像不能超過 10 個字元" }),
  notifications: z.boolean().optional()
});

export const passwordSchema = z.string()
  .min(8, { message: "密碼至少需要 8 個字元" })
  .max(72, { message: "密碼最多 72 個字元" })
  .regex(/[A-Z]/, { message: "密碼需包含至少一個大寫字母" })
  .regex(/[a-z]/, { message: "密碼需包含至少一個小寫字母" })
  .regex(/[0-9]/, { message: "密碼需包含至少一個數字" });

export const emailSchema = z.string()
  .trim()
  .email({ message: "無效的電子郵件地址" })
  .max(255, { message: "電子郵件不能超過 255 個字元" });

// 註冊表單驗證
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "兩次輸入的密碼不一致",
  path: ["confirmPassword"],
});

// 登入表單驗證
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "請輸入密碼" })
});

export type TopicFormData = z.infer<typeof topicSchema>;
export type VoteFormData = z.infer<typeof voteSchema>;
export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;
