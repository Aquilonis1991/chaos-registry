import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Coins, X, Plus, Loader2, Gift } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getTagColor } from "@/lib/tagColors";
import { useProfile } from "@/hooks/useProfile";
import { useTopicOperations } from "@/hooks/useTopicOperations";
import { topicSchema } from "@/lib/validationSchemas";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import { validateTopicContent, getBannedWordErrorMessage } from "@/lib/bannedWords";
import { useAuth } from "@/hooks/useAuth";
import { useUserStats } from "@/hooks/useUserStats";

const CreateTopicPage = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useProfile();
  const { user } = useAuth();
  const { createTopic, checkFreeCreateQualification } = useTopicOperations();
  const { getConfig, loading: configLoading } = useSystemConfigCache();
  const { refreshStats } = useUserStats(user?.id);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [category, setCategory] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [exposure, setExposure] = useState("normal");
  const [duration, setDuration] = useState([7]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasFreeCreateQualification, setHasFreeCreateQualification] = useState(false);

  // Get config values
  const descMaxLength = getConfig('description_max_length', 150);
  const exposureCostsConfig = getConfig('exposure_costs', { normal: 30, medium: 90, high: 180 });
  const durationCostsConfig = getConfig('duration_costs', {
    "1": 0, "2": 0, "3": 0, "4": 1, "5": 2, "6": 3, "7": 4, "8": 6, "9": 8, "10": 10,
    "11": 12, "12": 14, "13": 16, "14": 18, "15": 21, "16": 24, "17": 27, "18": 30,
    "19": 30, "20": 30, "21": 30, "22": 30, "23": 30, "24": 30, "25": 30, "26": 30,
    "27": 30, "28": 30, "29": 30, "30": 30
  });
  const durationMaxDays = getConfig('duration_max_days', 30);

  const allAvailableTags = [
    // 生活類
    "美食", "早餐", "午餐", "晚餐", "宵夜", "飲料", "咖啡", "茶", "酒",
    "穿搭", "時尚", "美妝", "香水", "髮型", "購物",
    // 娛樂類
    "電影", "動漫", "電視劇", "綜藝", "音樂", "演唱會", "遊戲", "電競",
    "直播", "YouTuber", "網紅", "迷因", "梗圖", "爆紅",
    // 職場生活
    "職場", "工作", "薪水", "面試", "加班", "通勤", "同事", "老闆",
    "創業", "投資", "理財", "股票", "房價", "保險",
    // 情感生活
    "戀愛", "感情", "單身", "結婚", "分手", "曖昧", "暗戀", "告白",
    "家庭", "親情", "友情", "人際關係",
    // 學習成長
    "學習", "考試", "讀書", "校園", "大學", "研究所", "留學", "語言",
    "技能", "證照", "進修", "成長",
    // 興趣愛好
    "運動", "健身", "跑步", "游泳", "球類", "旅遊", "攝影", "畫畫",
    "寫作", "閱讀", "收藏", "手工", "園藝", "寵物",
    // 科技數位
    "科技", "AI", "手機", "電腦", "APP", "軟體", "網路", "社交媒體",
    "3C", "電競", "程式", "設計",
    // 社會話題
    "政治", "社會", "新聞", "時事", "環保", "教育", "醫療", "法律",
    "文化", "歷史", "傳統", "節日",
    // 心理情感
    "心情", "壓力", "焦慮", "開心", "難過", "憤怒", "驚訝", "崩潰",
    "療癒", "放鬆", "冥想", "正念",
    // 特殊標籤
    "反串", "黑梗", "陰謀", "玄學", "星座", "運氣", "占卜", "迷信",
    "都市傳說", "靈異", "超自然", "外星人", "時空旅行", "平行宇宙",
    "閒聊", "發言王", "熱門", "爭議", "討論", "投票", "選擇困難"
  ];

  // 限制推薦標籤最多同時存在30個
  const MAX_RECOMMENDED_TAGS = 30;
  const availableTags = allAvailableTags.slice(0, MAX_RECOMMENDED_TAGS);

  const getDurationCost = (days: number): number => {
    return durationCostsConfig[days.toString()] || 0;
  };

  const durationCost = getDurationCost(duration[0]);
  const exposureCost = exposureCostsConfig[exposure as keyof typeof exposureCostsConfig] || 30;
  const totalCost = hasFreeCreateQualification ? 0 : exposureCost + durationCost;

  // Check free create qualification
  useEffect(() => {
    if (profile) {
      checkFreeCreateQualification().then(setHasFreeCreateQualification);
    }
  }, [profile, checkFreeCreateQualification]);

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      }
      if (prev.length >= 5) {
        toast.error("最多只能選擇 5 個標籤");
        return prev;
      }
      return [...prev, tag];
    });
  };

  const addCustomTag = () => {
    const trimmedTag = customTag.trim();
    if (!trimmedTag) return;
    
    if (selectedTags.includes(trimmedTag)) {
      toast.error("標籤已存在");
      return;
    }
    
    if (selectedTags.length >= 5) {
      toast.error("最多只能選擇 5 個標籤");
      return;
    }
    
    if (trimmedTag.length > 10) {
      toast.error("自定義標籤不能超過 10 個字元");
      return;
    }
    
    setSelectedTags(prev => [...prev, trimmedTag]);
    setCustomTag("");
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // 檢查選項是否有重複
    const trimmedOptions = options.map(opt => opt.trim()).filter(opt => opt !== '');
    const uniqueOptions = new Set(trimmedOptions);
    
    if (trimmedOptions.length !== uniqueOptions.size) {
      toast.error("選項不可重複！", {
        description: "請確保每個選項都是唯一的"
      });
      return;
    }

    // Validate with Zod schema
    try {
      topicSchema.parse({
        title,
        description,
        options,
        category,
        tags: selectedTags,
        exposure_level: exposure,
        duration_days: duration[0]
      });
    } catch (error: any) {
      const firstError = error.errors?.[0];
      toast.error(firstError?.message || "請檢查輸入資料");
      return;
    }

    // 檢查禁字
    const bannedCheck = await validateTopicContent(
      title,
      description || undefined,
      trimmedOptions,
      selectedTags,
      category
    );

    if (bannedCheck.found) {
      if (bannedCheck.action === 'block') {
        toast.error(getBannedWordErrorMessage(bannedCheck), {
          description: `發現禁字：${bannedCheck.keyword}（級別：${bannedCheck.level}）`
        });
        return;
      } else if (bannedCheck.action === 'review') {
        toast.warning('內容需要人工審核，提交後將進入審核流程', {
          description: `發現敏感字詞：${bannedCheck.keyword}`
        });
        // 繼續提交，但標記為需要審核
      }
    }

    if (!profile) {
      toast.error("請先登入");
      return;
    }

    if (!hasFreeCreateQualification && profile.tokens < totalCost) {
      toast.error("代幣不足！");
      return;
    }

    setIsSubmitting(true);
    
    try {
      await createTopic({
        title,
        description,
        options,
        category,
        tags: selectedTags,
        exposure_level: exposure,
        duration_days: duration[0]
      });

      toast.success("主題已建立！", {
        description: `消耗 ${totalCost} 個代幣`
      });
      
      // 刷新任務統計
      refreshStats();
      
      setTimeout(() => navigate("/home"), 1500);
    } catch (error) {
      // Error is handled in useTopicOperations
    } finally {
      setIsSubmitting(false);
    }
  };

  const userTokens = profile?.tokens || 0;

  if (profileLoading || configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-primary shadow-lg">
        <div className="max-w-screen-xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-primary-foreground hover:bg-primary-foreground/20"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
            
            <div className="flex-1">
              <h1 className="text-lg font-bold text-primary-foreground">發起主題</h1>
            </div>
            
            <div className="flex items-center gap-2 bg-primary-foreground/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <Coins className="w-4 h-4 text-accent" />
              <span className="font-bold text-primary-foreground text-sm">{userTokens}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title" className="text-base font-semibold">主題標題</Label>
          <Input
            id="title"
            placeholder="輸入吸引人的標題..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-12 text-base"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-base font-semibold">
            主題詳述 
            <span className="text-sm text-muted-foreground ml-2 font-normal">
              (選填，最多 {descMaxLength} 字)
            </span>
          </Label>
          <Textarea
            id="description"
            placeholder="詳細描述您的主題內容..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[120px] text-base resize-none"
            maxLength={descMaxLength}
          />
          <div className="text-xs text-muted-foreground text-right">
            {description.length} / {descMaxLength}
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">投票選項 (2-6個)</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={addOption}
              disabled={options.length >= 6}
            >
              <Plus className="w-4 h-4 mr-1" />
              新增
            </Button>
          </div>

          {options.map((option, index) => {
            // 檢查當前選項是否與其他選項重複
            const trimmedOption = option.trim();
            const isDuplicate = trimmedOption !== '' && 
              options.filter((opt, i) => i !== index && opt.trim() === trimmedOption).length > 0;
            
            return (
              <div key={index} className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder={`選項 ${index + 1}`}
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    className={isDuplicate ? "border-red-500" : ""}
                  />
                  {isDuplicate && (
                    <p className="text-xs text-red-500 mt-1">此選項與其他選項重複</p>
                  )}
                </div>
                {options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="category" className="text-base font-semibold">話題分類</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category" className="h-12">
              <SelectValue placeholder="選擇分類" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="food">🍔 美食</SelectItem>
              <SelectItem value="life">🌟 生活</SelectItem>
              <SelectItem value="tech">💻 科技</SelectItem>
              <SelectItem value="sports">⚽ 運動</SelectItem>
              <SelectItem value="entertainment">🎬 娛樂</SelectItem>
              <SelectItem value="other">🔮 其他</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tags */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">
            話題標籤 {selectedTags.length > 0 && (
              <span className="text-sm text-muted-foreground ml-2">
                已選 {selectedTags.length} 個
              </span>
            )}
          </Label>
          
          {/* Custom Tag Input */}
          <div className="flex gap-2">
            <Input
              placeholder="自定義標籤（最多10字）"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              maxLength={10}
              className="flex-1"
              onKeyPress={(e) => e.key === 'Enter' && addCustomTag()}
            />
            <Button 
              type="button"
              variant="outline" 
              onClick={addCustomTag}
              disabled={!customTag.trim()}
            >
              添加
            </Button>
          </div>

          {/* Selected Tags */}
          {selectedTags.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">已選擇的標籤：</div>
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <div
                    key={tag}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2",
                      getTagColor(tag),
                      "ring-2 ring-offset-2 ring-primary"
                    )}
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="hover:bg-black/10 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available Tags */}
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">推薦標籤：</div>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {availableTags
                .filter(tag => !selectedTags.includes(tag))
                .map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium transition-all border-0",
                    "hover:scale-105 active:scale-95",
                    `${getTagColor(tag)} opacity-60 hover:opacity-100`
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Exposure */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">曝光方案</Label>
          <RadioGroup value={exposure} onValueChange={setExposure}>
            <Card className="cursor-pointer hover:shadow-card transition-all">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="normal" id="normal" />
                  <Label htmlFor="normal" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">普通曝光</div>
                        <div className="text-sm text-muted-foreground">標準推薦</div>
                      </div>
                      <div className="flex items-center gap-1 text-primary font-bold">
                        <Coins className="w-4 h-4" />
                        30
                      </div>
                    </div>
                  </Label>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-card transition-all">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="medium" id="medium" />
                  <Label htmlFor="medium" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">中等曝光</div>
                        <div className="text-sm text-muted-foreground">優先推薦</div>
                      </div>
                      <div className="flex items-center gap-1 text-primary font-bold">
                        <Coins className="w-4 h-4" />
                        90
                      </div>
                    </div>
                  </Label>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-card transition-all">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="high" id="high" />
                  <Label htmlFor="high" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">高度曝光</div>
                        <div className="text-sm text-muted-foreground">置頂推薦</div>
                      </div>
                      <div className="flex items-center gap-1 text-primary font-bold">
                        <Coins className="w-4 h-4" />
                        180
                      </div>
                    </div>
                  </Label>
                </div>
              </CardContent>
            </Card>
          </RadioGroup>
        </div>

        {/* Duration */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">投票天數: {duration[0]} 天</Label>
          <Slider
            value={duration}
            onValueChange={setDuration}
            min={1}
            max={durationMaxDays}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>1 天</span>
            <span>{durationMaxDays} 天</span>
          </div>
        </div>

        {/* Cost Summary */}
        <Card className={cn(
          "border-2 transition-all",
          hasFreeCreateQualification 
            ? "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30" 
            : "bg-gradient-accent"
        )}>
          <CardContent className="p-4 space-y-3">
            {hasFreeCreateQualification ? (
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <Gift className="w-6 h-6" />
                  <span className="text-lg font-bold">免費發起資格</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  您擁有免費發起主題的資格，本次建立不消耗代幣
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2 text-accent-foreground text-sm">
                  <div className="flex justify-between opacity-90">
                    <span>曝光方案</span>
                    <span className="font-semibold">{exposureCost} 代幣</span>
                  </div>
                  <div className="flex justify-between opacity-90">
                    <span>投票天數 ({duration[0]} 天)</span>
                    <span className="font-semibold">+{durationCost} 代幣</span>
                  </div>
                  <div className="border-t border-accent-foreground/20 pt-2"></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-accent-foreground">
                    <div className="text-sm opacity-90">總消耗代幣</div>
                    <div className="text-2xl font-bold flex items-center gap-2">
                      <Coins className="w-6 h-6" />
                      {totalCost}
                    </div>
                  </div>
                  <div className="text-right text-accent-foreground">
                    <div className="text-sm opacity-90">剩餘代幣</div>
                    <div className="text-xl font-bold">{userTokens - totalCost}</div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Button
          variant="vote"
          size="lg"
          className="w-full h-14 text-lg"
          onClick={handleSubmit}
          disabled={isSubmitting || (!hasFreeCreateQualification && userTokens < totalCost)}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              建立中...
            </>
          ) : hasFreeCreateQualification ? (
            <>
              <Gift className="w-5 h-5 mr-2" />
              免費建立主題
            </>
          ) : (
            '送出主題'
          )}
        </Button>
      </div>
    </div>
  );
};

export default CreateTopicPage;
