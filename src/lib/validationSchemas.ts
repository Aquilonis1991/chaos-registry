import { z } from 'zod';

export const createTopicSchema = (limits: {
  titleMin?: number;
  titleMax?: number;
  descriptionMax?: number;
  optionMin?: number;
  optionMax?: number;
  optionItemMax?: number;
  tagsMax?: number;
} = {}) => {
  const {
    titleMin = 5,
    titleMax = 80,
    descriptionMax = 500,
    optionMin = 2,
    optionMax = 6,
    optionItemMax = 50,
    tagsMax = 5
  } = limits;

  return z.object({
    title: z.string()
      .trim()
      .min(titleMin, { message: `標題至少需要 ${titleMin} 個字元` })
      .max(titleMax, { message: `標題不能超過 ${titleMax} 個字元` }),
    description: z.string()
      .trim()
      .max(descriptionMax, { message: `主題詳述不能超過 ${descriptionMax} 個字元` })
      .optional(),
    options: z.array(
      z.string()
        .trim()
        .min(1, { message: "選項不能為空" })
        .max(optionItemMax, { message: `單一選項不能超過 ${optionItemMax} 個字元` })
    )
      .min(optionMin, { message: `至少需要 ${optionMin} 個選項` })
      .max(optionMax, { message: `最多只能 ${optionMax} 個選項` }),
    category: z.string().min(1, { message: "請選擇分類" }),
    tags: z.array(z.string()).max(tagsMax, { message: `最多只能選擇 ${tagsMax} 個標籤` }),
    exposure_level: z.enum(['normal', 'medium', 'high']),
    duration_days: z.number().min(1).max(30)
  });
};

// Deprecated: use createTopicSchema instead for dynamic limits
export const topicSchema = createTopicSchema();

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
