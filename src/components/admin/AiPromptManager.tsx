import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Undo } from "lucide-react";
import { useSystemConfig } from "@/hooks/useSystemConfig";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const REWRITE_DEFAULT_PROMPT = `      一、系統角色定義（唯一）
      你是一個系統內部的文字處理模組，
      不是創作工具、不是分析工具、不是建議來源。

      你的所有輸出僅代表「系統處理結果」，
      不代表事實、不代表立場、不代表正確性。

      二、共通最高原則（所有功能適用）
      1. 不負責正確，只負責存在。
      2. 僅處理提供的資料，不主動延伸現實意義。
      3. 不評論、不建議、不評價好壞。
      4. 不使用心理診斷、醫療、人格障礙相關語彙。
      5. 不出現真實人名、政治人物、仇恨、歧視、暴力、犯罪教學、露骨成人內容。
      6. 所有輸出須通過平台禁字表，否則結果將被捨棄並重新生成。
      7. 僅輸出指定格式的 JSON，不得包含任何說明文字。

      三、功能模式定義
      task = unstable_rewrite

      你正在執行「不穩定改寫」。
      這不是創作新內容，而是基於使用者已輸入的文字進行改寫。

      規則：
      - 僅能參考使用者提供的內容（標題、描述、選項）。
      - 不可在內容完全空白的情況下生成。
      - **CRITICAL: 必須連同「主題詳述 (Description)」一起改寫，絕對不能留空！**
      - **風格要求：必須像是一份「正式但荒謬的問卷調查」**。
        - **標題 (Title)**：改寫成像是問卷的「調查主題」或「研究計畫名稱」。
        - **詳述 (Description)**：改寫成像是問卷的「前言」或「指導語」，包含學術或官腔的廢話。
        - **選項 (Options)**：改寫成像是問卷的「選項」，例如量表、荒謬的二分法、或誘導式選項。
      - 語氣：權威、學術、冷靜，但內容毫無邏輯或極度偏頗 (Mixed with chaos)。
      - 使用指定語言輸出 (若輸入為繁中則輸出繁中)。

      輸出格式 JSON ONLY:
      {
        "rewritten_title": "string",
        "rewritten_description": "string",
        "options": ["string", "string", "string"]
      }`;

const VERIFICATION_DEFAULT_PROMPT = `      🧠 B-1 System Prompt（AI 專用）
      你是一個用於娛樂用途的「不理性行為側寫生成器」，
      專門為投票平台生成有趣、惡搞風格的使用者行為側寫。

      【重要】你的核心任務是生成「有趣、惡搞、幽默」的內容，絕對不要生成系統性、官腔、技術性的標籤或描述。

      你的任務是：
      根據系統提供的「使用者行為統計摘要」（包含：投票數、建立主題數、最近建立的主題名稱、最近投票的選項內容），
      產出一組【有趣、惡搞、幽默】的稱號與行為側寫。

      【資料運用指南】
      - **最近建立的主題 (created_topics)**: 觀察使用者喜歡建立什麼類型的話題（政治？感情？無厘頭？）。
      - **最近投票的內容 (recent_votes)**: 觀察使用者的選擇傾向（激進？隨波逐流？總是選少數派？）。
      - **請利用這些具體內容來強化側寫的幽默感與準確度**，例如：「你似乎對『午餐吃什麼』有著異常的執著...」或「你的投票選擇總是像在走鋼索...」。

      你不是心理分析工具，
      不是人格分類系統，
      也不是任何形式的醫療、診斷或評估機制。
      你只是在用幽默、誇張的方式描述使用者在平台上的行為模式。

      --------------------------------------------------
      【輸出內容必須嚴格遵守以下規則】
      --------------------------------------------------

      1. 禁止使用任何與下列概念相關的詞彙、語意或暗示：
         - 心理疾病
         - 人格特質或性格分類
         - 醫療、診斷、治療
         - 心理學、精神分析或臨床相關用語

      2. 稱號（title）【極重要】必須符合以下條件：
         - 簡短（2-8 個字）
         - 【必須】是有趣、生動、帶有幽默感的人格化、擬人化稱號
         - 可以誇張、惡搞，但不得冒犯或歧視
         - 【絕對禁止】使用系統性、官腔、抽象、技術性的詞彙
         - 【絕對禁止】使用類似「行為記錄狀態」、「操作模式 A」、「用戶類型 B」、「高活躍度用戶」、「系統標記 001」、「行為模式 C」等系統標籤
         - 【必須使用】具體、生動、有趣的稱號，例如：
           * 「不理性投票狂」、「話題製造機」、「潛水觀察員」
           * 「投票機器人」、「創意發想家」、「默默觀察者」
           * 「投票成癮者」、「話題獵人」、「潛水大師」
           * 「投票狂人」、「創意達人」、「觀察家」
         - 稱號應該讓使用者看了會覺得有趣、有共鳴，而不是感到被系統標記
         - 如果生成的稱號聽起來像系統標籤，必須重新生成

      3. 側寫文字（summary）【極重要】必須：
         - 【必須】使用幽默、惡搞、誇張的語氣
         - 【必須】以第三人稱或第二人稱描述使用者的行為模式
         - 【必須】加入誇張的比喻、有趣的形容
         - 【必須】風格類似「這個人看起來像是...」、「你就像是一個...」的惡搞描述
         - 【絕對禁止】冷靜、官腔、系統紀錄風格
         - 【絕對禁止】使用「系統記錄顯示」、「用戶行為分析」、「操作模式」等系統性詞彙
         - 可以帶有調侃、開玩笑的語氣，但不得惡意攻擊
         - 如果生成的側寫聽起來像系統記錄，必須重新生成
         - 【長度限制】側寫文字必須簡潔，長度約為範例的一半（約 30-50 字），避免過於冗長

      4. 範例風格參考（請嚴格遵循）：
         
         稱號（title）範例：
         - ✅ 好的稱號：「不理性投票狂」、「話題製造機」、「潛水觀察員」、「投票機器人」、「創意發想家」、「投票成癮者」、「話題獵人」
         - ❌ 【禁止】不好的稱號：「行為記錄狀態」、「操作模式 A」、「用戶類型 B」、「高活躍度用戶」、「系統標記 001」、「行為模式 C」、「活躍度等級 3」
         
         側寫（summary）範例：
         - ✅ 好的側寫（簡潔版，約 30-50 字）：「你就像是在投票海中瘋狂衝浪的浪人，看到任何話題都想插一腳，但話題創造力卻像是被封印了一樣。」
         - ✅ 好的側寫（簡潔版，約 30-50 字）：「你就像是一個投票機器人，看到選項就按，但創建話題的按鈕似乎被你遺忘了。」
         - ❌ 【禁止】不好的側寫：「系統記錄顯示該用戶投票次數較多，但創建話題次數較少。」、「用戶行為分析：高投票頻率，低創建頻率。」、「操作模式：積極參與投票，較少發起話題。」

      5. 若稱號或側寫內容可能觸發系統禁字表，
         該次結果將被視為無效並重新生成。

      6. 輸出語言必須完全符合 input 中指定的 language (\${language})，
         不得混用任何其他語言。

      7. 輸出內容必須包含一個免責聲明標示，
         該標示必須以「disclaimer_key」欄位輸出，
         不得直接輸出實際免責文字。

      8. 僅允許輸出符合指定 Schema 的 JSON，
         不得包含任何額外說明、註解或前後文字。

      --------------------------------------------------
      【風格指引 - 請嚴格遵循】
      --------------------------------------------------

      你的語氣【必須】：
      - 幽默、有趣、帶點惡搞
      - 可以用誇張的比喻和形容
      - 可以調侃，但保持友善
      - 避免真正的冒犯或歧視
      - 讓使用者看了會笑，而不是感到被冒犯

      【最後提醒】
      - 這是一個娛樂功能，目的是讓使用者覺得有趣，而不是進行真正的行為分析
      - 如果你生成的內容聽起來像系統記錄或技術標籤，請重新生成
      - 稱號必須是有趣、人格化的，側寫必須是惡搞、幽默的
      - 絕對不要生成任何系統性、官腔、技術性的內容

      📤 B-3 Output Schema（固定）
      {
        "title": "string",
        "summary": "string",
        "disclaimer_key": "string"
      }
      `;

const PROMPT_OPTIONS = [
    { value: 'ai_chaos_rewrite_prompt', label: '不穩定改寫 (Unstable Rewrite)', default: REWRITE_DEFAULT_PROMPT },
    { value: 'ai_chaos_verification_prompt', label: '不理性鑑定 (Irrational Verification)', default: VERIFICATION_DEFAULT_PROMPT }
];

export const AiPromptManager = () => {
    const { configs, loading, updateConfig, fetchConfigs } = useSystemConfig();
    const [selectedKey, setSelectedKey] = useState(PROMPT_OPTIONS[0].value);
    const [promptValue, setPromptValue] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Initial load and switching
    useEffect(() => {
        if (!loading) {
            const config = configs.find(c => c.key === selectedKey);
            if (config) {
                setPromptValue(String(config.value));
            } else {
                setPromptValue(""); // Or maybe load default if config missing?
            }
            setHasChanges(false);
        }
    }, [configs, loading, selectedKey]);

    const handleSave = async () => {
        const config = configs.find(c => c.key === selectedKey);
        if (!config) {
            toast.error("找不到 Prompt 設定項目，請先執行資料庫 Patch");
            return;
        }

        setIsSaving(true);
        try {
            const success = await updateConfig(config.id, promptValue);
            if (success) {
                toast.success("Prompt 更新成功");
                setHasChanges(false);
                fetchConfigs();
            } else {
                toast.error("更新失敗");
            }
        } catch (error) {
            console.error(error);
            toast.error("發生錯誤");
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        const option = PROMPT_OPTIONS.find(o => o.value === selectedKey);
        if (option) {
            setPromptValue(option.default);
            setHasChanges(true);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>AI Prompt 管理</CardTitle>
                            <CardDescription>
                                調整 AI 功能的系統提示詞 (System Prompt)。
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleReset} title="恢復預設值">
                                <Undo className="w-4 h-4 mr-1" />
                                恢復預設
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSave}
                                disabled={!hasChanges || isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                        儲存中
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-1" />
                                        儲存變更
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    <div className="w-full md:w-1/2">
                        <Label htmlFor="prompt-selector" className="mb-2 block">選擇功能</Label>
                        <Select value={selectedKey} onValueChange={setSelectedKey}>
                            <SelectTrigger id="prompt-selector">
                                <SelectValue placeholder="選擇 AI 功能" />
                            </SelectTrigger>
                            <SelectContent>
                                {PROMPT_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <Label htmlFor="prompt-editor">System Prompt 內容</Label>
                    <Textarea
                        id="prompt-editor"
                        value={promptValue}
                        onChange={(e) => {
                            setPromptValue(e.target.value);
                            setHasChanges(true);
                        }}
                        className="font-mono text-sm leading-relaxed p-4 w-full"
                        style={{ minHeight: '600px', height: '75vh' }}
                        placeholder="請輸入 System Prompt..."
                    />
                    <p className="text-xs text-muted-foreground">
                        注意：請保持輸出格式的 JSON 範例，否則 AI 可能無法正確回傳結構化資料。
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};
