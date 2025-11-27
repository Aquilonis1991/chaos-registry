interface LegalContentRendererProps {
  content: string;
}

export const LegalContentRenderer = ({ content }: LegalContentRendererProps) => {
  if (!content || !content.trim()) {
    return (
      <div className="text-muted-foreground text-sm">
        目前尚未設定內容，請聯絡管理員更新。
      </div>
    );
  }

  return (
    <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-foreground">
      {content}
    </div>
  );
};

export default LegalContentRenderer;

