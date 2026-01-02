import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoadingBubble } from "@/components/ui/LoadingBubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Coins, X, Plus, Loader2, Gift } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getTagColor } from "@/lib/tagColors";
import { useProfile } from "@/hooks/useProfile";
import { useTopicOperations } from "@/hooks/useTopicOperations";
import { topicSchema } from "@/lib/validationSchemas";
import { useSystemConfigCache } from "@/hooks/useSystemConfigCache";
import { checkBannedWords, validateTopicContent, getBannedWordErrorMessage } from "@/lib/bannedWords";
import { useAuth } from "@/hooks/useAuth";
import { useUserStats } from "@/hooks/useUserStats";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUIText } from "@/hooks/useUIText";

const CreateTopicPage = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useProfile();
  const { user } = useAuth();
  const { createTopic, checkFreeCreateQualification, checkDailyDiscountEligibility } = useTopicOperations();
  const { getConfig, loading: configLoading } = useSystemConfigCache();
  const { refreshStats } = useUserStats(user?.id);
  const { language } = useLanguage();
  const { getText } = useUIText(language);
  const topicBannedLevels = getConfig('topic_banned_check_levels', ['A', 'B', 'C', 'D', 'E']);
  const topicDescriptionBannedLevels = getConfig('topic_description_banned_levels', ['A', 'B', 'C', 'D', 'E']);
  /* Config Limits */
  const titleMaxLength = getConfig('title_max_length', 200);
  const titleMinLength = getConfig('title_min_length', 5);
  const descMaxLength = getConfig('description_max_length', 150);
  const optionMaxCount = getConfig('option_max_count', 6);
  const optionMinCount = getConfig('option_min_count', 2);
  const tagsMaxCount = getConfig('tags_max_count', 5);

  /* Pricing Configs */
  const exposureCosts = getConfig('exposure_costs', { normal: 30, medium: 90, high: 180 });
  const durationCosts = getConfig('duration_costs', {
    "1": 0, "2": 0, "3": 0, "4": 1, "5": 2, "6": 3, "7": 4,
    "8": 6, "9": 8, "10": 10, "11": 12, "12": 14, "13": 16,
    "14": 18, "15": 21, "16": 24, "17": 27, "18": 30
  });
  const durationMaxDays = getConfig('duration_max_days', 30);
  const durationMinDays = getConfig('duration_min_days', 1);
  const dailyDiscountAmount = getConfig('daily_topic_discount_tokens', 0);
  const baseCost = getConfig('create_topic_base_cost', 0);

  console.log('[CreateTopic] Configs:', {
    dailyDiscountAmount,
    baseCost,
    allConfigsLoaded: !configLoading
  });

  const headerTitle = getText('topic.create.headerTitle', '發起主題');
  const titleFieldLabel = getText('topic.title.label', '主題標題');
  const descriptionFieldLabel = getText('topic.description.fieldLabel', '主題詳述');
  const descriptionOptionalHintTemplate = getText('topic.description.optionalHint', '(選填，最多 {{count}} 字)');
  const maskDialogTitle = getText('topic.description.maskTitle', '詳述含敏感字詞');
  const maskDialogMessageTemplate = getText('topic.description.maskMessage', '系統將把「{{keyword}}」替換成星號，是否套用？');
  const maskDialogConfirmText = getText('topic.description.maskConfirm', '替換為星號');
  const maskDialogCancelText = getText('common.button.cancel', '取消');
  const reviewDialogTitle = getText('topic.description.reviewTitle', '詳述含敏感字詞');
  const reviewDialogMessageTemplate = getText('topic.description.reviewMessage', '詳述包含敏感字詞「{{keyword}}」，可能會被管理員下架或修改，仍要送出嗎？');
  const reviewDialogConfirmText = getText('topic.description.reviewConfirm', '仍要送出');
  const reviewDialogCancelText = getText('common.button.cancel', '取消');

  const maskKeywordInText = (text: string, keyword: string) => {
    if (!keyword) return text;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    return text.replace(regex, (match) => '*'.repeat(match.length));
  };

  const handleMaskConfirm = () => {
    if (!maskDialogInfo) {
      setMaskDialogOpen(false);
      return;
    }

    setDescription(maskDialogInfo.maskedDescription);
    setMaskDialogOpen(false);
    setMaskDialogInfo(null);
    toast.info(getText('topic.description.maskApplied', '敏感字已替換為星號，請確認後重新送出'));
  };

  const handleMaskCancel = () => {
    setMaskDialogOpen(false);
    setMaskDialogInfo(null);
  };

  const submitTopic = async (optionsForSubmit: string[], tagsForSubmit: string[]) => {
    if (!profile) {
      toast.error(getText('topic.login.error', '請先登入'));
      return;
    }

    if (!hasFreeCreateQualification && profile.tokens < totalCost) {
      toast.error(getText('topic.token.error', '代幣不足！'));
      return;
    }

    setIsSubmitting(true);
    try {
      await createTopic({
        title: title.trim(),
        description,
        options: optionsForSubmit,
        category,
        tags: tagsForSubmit,
        exposure_level: exposure,
        duration_days: duration[0],
      });

      toast.success(getText('topic.success', '主題建立成功！'));
      refreshStats();
      navigate('/home');
    } catch (error) {
      console.error('Create topic error:', error);
      toast.error(getText('topic.error', '建立主題失敗，請稍後再試'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewConfirm = async () => {
    const submission = pendingSubmission;
    setReviewDialogOpen(false);
    setReviewDialogInfo(null);

    if (!submission) return;

    await submitTopic(submission.options, submission.tags);
    setPendingSubmission(null);
  };

  const handleReviewCancel = () => {
    setReviewDialogOpen(false);
    setReviewDialogInfo(null);
    setPendingSubmission(null);
  };
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const category = "other";
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [exposure, setExposure] = useState("normal");
  const [duration, setDuration] = useState([7]);
  const tokenLabel = getText('topic.costSummary.token', '代幣');
  const formatTokenAmount = (value: number, options: { withPlus?: boolean } = {}) => {
    const templateKey = options.withPlus ? 'topic.costSummary.plusValueWithUnit' : 'topic.costSummary.valueWithUnit';
    const template = getText(
      templateKey,
      options.withPlus ? '+{{value}} {{unit}}' : '{{value}} {{unit}}'
    );
    return template.replace('{{value}}', value.toLocaleString()).replace('{{unit}}', tokenLabel);
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasFreeCreateQualification, setHasFreeCreateQualification] = useState(false);
  const [maskDialogOpen, setMaskDialogOpen] = useState(false);
  const [maskDialogInfo, setMaskDialogInfo] = useState<{ keyword: string; maskedDescription: string } | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewDialogInfo, setReviewDialogInfo] = useState<{ keyword: string } | null>(null);
  const [pendingSubmission, setPendingSubmission] = useState<{ options: string[]; tags: string[] } | null>(null);
  const [isDailyDiscountEligible, setIsDailyDiscountEligible] = useState(false);

  // Config values are now retrieved at the top of the component

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

  /* Cost Logic */
  const durationCost = (durationCosts as any)[duration[0].toString()] ?? 0;

  const normalExposureCost = (exposureCosts as any).normal ?? 30;
  const mediumExposureCost = (exposureCosts as any).medium ?? 90;
  const highExposureCost = (exposureCosts as any).high ?? 180;

  const exposureCost = (exposureCosts as any)[exposure] ?? 30;

  const dailyDiscount = (dailyDiscountAmount > 0 && isDailyDiscountEligible) ? dailyDiscountAmount : 0;

  const totalCost = hasFreeCreateQualification
    ? 0
    : Math.max(0, exposureCost + durationCost + Number(baseCost) - dailyDiscount);

  // Check free create qualification
  useEffect(() => {
    if (profile) {
      checkFreeCreateQualification().then(setHasFreeCreateQualification);
      checkDailyDiscountEligibility().then(setIsDailyDiscountEligible);
    }
  }, [profile, checkFreeCreateQualification, checkDailyDiscountEligibility]);

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
        toast.error(getText('topic.tag.limit', '最多只能選擇 5 個標籤'));
        return prev;
      }
      return [...prev, tag];
    });
  };

  const addCustomTag = async () => {
    const trimmedTag = customTag.trim();
    if (!trimmedTag) return;

    if (selectedTags.includes(trimmedTag)) {
      toast.error(getText('topic.tag.duplicate', '標籤已存在'));
      return;
    }

    if (selectedTags.length >= 5) {
      toast.error(getText('topic.tag.limit', '最多只能選擇 5 個標籤'));
      return;
    }

    if (trimmedTag.length > 10) {
      toast.error(getText('topic.tag.lengthLimit', '自定義標籤不能超過 10 個字元'));
      return;
    }

    try {
      const tagCheck = await checkBannedWords(trimmedTag, topicBannedLevels);
      if (tagCheck.found && topicBannedLevels.includes(tagCheck.level || '')) {
        toast.error(tagCheck.errorMessage || getText('topic.tag.banned', '標籤包含禁字，請重新輸入'), {
          description: getText('topic.tag.bannedDesc', '敏感字詞：{{keyword}}').replace('{{keyword}}', tagCheck.keyword || '')
        });
        return;
      }
    } catch (error) {
      console.error('Error validating custom tag:', error);
      toast.error(getText('topic.tag.bannedError', '檢查禁字時發生錯誤，請稍後再試'));
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
      toast.error(getText('topic.option.duplicate', '選項不可重複！'), {
        description: getText('topic.option.duplicateDesc', '請確保每個選項都是唯一的')
      });
      return;
    }

    const sanitizedTags = selectedTags.map(tag => tag.trim());

    // Validate with Zod schema
    try {
      topicSchema.parse({
        title,
        description,
        options: trimmedOptions,
        category,
        tags: sanitizedTags,
        exposure_level: exposure,
        duration_days: duration[0]
      });
    } catch (error: any) {
      const firstError = error.errors?.[0];
      toast.error(firstError?.message || getText('topic.validation.error', '請檢查輸入資料'));
      return;
    }

    // 檢查禁字
    const bannedCheck = await validateTopicContent(
      title,
      null,
      trimmedOptions,
      sanitizedTags,
      category,
      topicBannedLevels
    );

    if (bannedCheck.found) {
      toast.error(getBannedWordErrorMessage(bannedCheck), {
        description: getText('topic.banned.description', '發現禁字：{{keyword}}（級別：{{level}}）')
          .replace('{{keyword}}', bannedCheck.keyword || '')
          .replace('{{level}}', bannedCheck.level || '')
      });
      return;
    }

    const descriptionCheck = description.trim()
      ? await checkBannedWords(description, topicDescriptionBannedLevels)
      : { found: false };

    if (descriptionCheck.found) {
      if (descriptionCheck.action === 'block') {
        toast.error(getText('topic.description.blocked', '詳述包含禁止使用的字詞，請修改後重試'), {
          description: getText('topic.description.blockedDesc', '敏感字詞：{{keyword}}').replace('{{keyword}}', descriptionCheck.keyword || '')
        });
        return;
      }

      if (descriptionCheck.action === 'mask') {
        const masked = maskKeywordInText(description, descriptionCheck.keyword || '');
        setMaskDialogInfo({ keyword: descriptionCheck.keyword || '', maskedDescription: masked });
        setMaskDialogOpen(true);
        return;
      }

      if (descriptionCheck.action === 'review') {
        setReviewDialogInfo({ keyword: descriptionCheck.keyword || '' });
        setPendingSubmission({ options: trimmedOptions, tags: sanitizedTags });
        setReviewDialogOpen(true);
        return;
      }
    }

    await submitTopic(trimmedOptions, sanitizedTags);
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
    <>
      <AlertDialog open={maskDialogOpen} onOpenChange={(open) => { if (!open) handleMaskCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{maskDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {maskDialogMessageTemplate.replace('{{keyword}}', maskDialogInfo?.keyword || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleMaskCancel}>{maskDialogCancelText}</AlertDialogCancel>
            <AlertDialogAction onClick={handleMaskConfirm}>{maskDialogConfirmText}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reviewDialogOpen} onOpenChange={(open) => { if (!open) handleReviewCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{reviewDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {reviewDialogMessageTemplate.replace('{{keyword}}', reviewDialogInfo?.keyword || '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleReviewCancel}>{reviewDialogCancelText}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReviewConfirm}>{reviewDialogConfirmText}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="min-h-screen bg-background pb-20">
        <LoadingBubble
          isLoading={isSubmitting}
          textKey="loading.create_topic"
          defaultText="正在建立主題..."
        />
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
                <h1 className="text-lg font-bold text-primary-foreground">{headerTitle}</h1>
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
            <Label htmlFor="title" className="text-base font-semibold">{titleFieldLabel}</Label>
            <Input
              id="title"
              placeholder={getText('topic.title.placeholder', '輸入吸引人的標題...')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 text-base"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-base font-semibold">
              {descriptionFieldLabel}
              <span className="text-sm text-muted-foreground ml-2 font-normal">
                {descriptionOptionalHintTemplate.replace('{{count}}', descMaxLength.toString())}
              </span>
            </Label>
            <Textarea
              id="description"
              placeholder={getText('topic.description.placeholder', '詳細描述您的主題內容...')}
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
              <Label className="text-base font-semibold">{getText('topic.options.label', '投票選項 (2-6個)')}</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={addOption}
                disabled={options.length >= 6}
              >
                <Plus className="w-4 h-4 mr-1" />
                {getText('topic.options.add', '新增')}
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
                      placeholder={`${getText('topic.options.optionPlaceholder', '選項')} ${index + 1}`}
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className={isDuplicate ? "border-red-500" : ""}
                    />
                    {isDuplicate && (
                      <p className="text-xs text-red-500 mt-1">{getText('topic.options.duplicateOption', '此選項與其他選項重複')}</p>
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

          {/* Tags */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">
              {getText('topic.tags.label', '話題標籤')} {selectedTags.length > 0 && (
                <span className="text-sm text-muted-foreground ml-2">
                  {getText('topic.tags.selectedCount', '已選 {{count}} 個').replace('{{count}}', selectedTags.length.toString())}
                </span>
              )}
            </Label>

            {/* Custom Tag Input */}
            <div className="flex gap-2">
              <Input
                placeholder={getText('topic.tag.customTagPlaceholder', '自定義標籤（最多10字）')}
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
                {getText('topic.tag.add', '添加')}
              </Button>
            </div>

            {/* Selected Tags */}
            {selectedTags.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">{getText('topic.tag.selectedTags', '已選擇的標籤：')}</div>
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
              <div className="text-sm text-muted-foreground">{getText('topic.tag.recommendedTags', '推薦標籤：')}</div>
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
            <Label className="text-base font-semibold">{getText('topic.exposure.label', '曝光方案')}</Label>
            <RadioGroup value={exposure} onValueChange={setExposure}>
              <Card className="cursor-pointer hover:shadow-card transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="normal" id="normal" />
                    <Label htmlFor="normal" className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{getText('topic.exposure.normal', '普通曝光')}</div>
                          <div className="text-sm text-muted-foreground">{getText('topic.exposure.normalDesc', '標準推薦')}</div>
                        </div>
                        <div className="flex items-center gap-1 text-primary font-bold">
                          <Coins className="w-4 h-4" />
                          <span>{formatTokenAmount(normalExposureCost)}</span>
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
                          <div className="font-semibold">{getText('topic.exposure.medium', '中等曝光')}</div>
                          <div className="text-sm text-muted-foreground">{getText('topic.exposure.mediumDesc', '優先推薦')}</div>
                        </div>
                        <div className="flex items-center gap-1 text-primary font-bold">
                          <Coins className="w-4 h-4" />
                          <span>{formatTokenAmount(mediumExposureCost)}</span>
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
                          <div className="font-semibold">{getText('topic.exposure.high', '高度曝光')}</div>
                          <div className="text-sm text-muted-foreground">{getText('topic.exposure.highDesc', '置頂推薦')}</div>
                        </div>
                        <div className="flex items-center gap-1 text-primary font-bold">
                          <Coins className="w-4 h-4" />
                          <span>{formatTokenAmount(highExposureCost)}</span>
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
            <Label className="text-base font-semibold">{getText('topic.duration.label', '投票天數')}: {duration[0]} {getText('topic.duration.days', '天')}</Label>
            <Slider
              value={duration}
              onValueChange={setDuration}
              min={1}
              max={durationMaxDays}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{getText('topic.duration.min', '1 天')}</span>
              <span>{getText('topic.duration.max', '{{maxDays}} 天').replace('{{maxDays}}', durationMaxDays.toString())}</span>
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
                    <span className="text-lg font-bold">{getText('topic.freeCreate.title', '免費發起資格')}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {getText('topic.freeCreate.description', '您擁有免費發起主題的資格，本次建立不消耗代幣')}
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2 text-accent-foreground text-sm">
                    <div className="flex justify-between opacity-90">
                      <span>{getText('topic.costSummary.exposure', '曝光方案')}</span>
                      <span className="font-semibold">{formatTokenAmount(exposureCost)}</span>
                    </div>
                    <div className="flex justify-between opacity-90">
                      <span>{getText('topic.costSummary.duration', '投票天數 ({{days}} 天)').replace('{{days}}', duration[0].toString())}</span>
                      <span className="font-semibold">{formatTokenAmount(durationCost, { withPlus: true })}</span>
                    </div>
                    <div className="border-t border-accent-foreground/20 pt-2"></div>
                    {dailyDiscountAmount > 0 && (
                      <div className={cn("flex justify-between", isDailyDiscountEligible ? "text-accent-foreground font-bold" : "text-muted-foreground opacity-90")}>
                        <span>
                          {getText('topic.costSummary.dailyDiscount', '每日首發優惠')}
                          {!isDailyDiscountEligible && <span className="text-xs ml-1">(已使用)</span>}
                        </span>
                        <span className={cn("font-semibold", !isDailyDiscountEligible && "line-through")}>
                          -{dailyDiscountAmount} {tokenLabel}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-accent-foreground">
                      <div className="text-sm opacity-90">{getText('topic.costSummary.totalCost', '總消耗代幣')}</div>
                      <div className="text-2xl font-bold flex items-center gap-2">
                        <Coins className="w-6 h-6" />
                        {totalCost}
                      </div>
                    </div>
                    <div className="text-right text-accent-foreground">
                      <div className="text-sm opacity-90">{getText('topic.costSummary.remainingTokens', '剩餘代幣')}</div>
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
                {getText('topic.submit.submitting', '建立中...')}
              </>
            ) : hasFreeCreateQualification ? (
              <>
                <Gift className="w-5 h-5 mr-2" />
                {getText('topic.submit.freeCreate', '免費建立主題')}
              </>
            ) : (
              getText('topic.submit.submit', '送出主題')
            )}
          </Button>
        </div>
      </div>
    </>
  );
};

export default CreateTopicPage;
