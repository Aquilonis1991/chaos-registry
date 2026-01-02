
/**
 * 將 JSON 資料轉換為 CSV 格式並下載
 * @param filename 下載的檔案名稱 (不含 .csv)
 * @param headers CSV 標頭定義 (key: JSON 欄位名, label: CSV 顯示標題)
 * @param data 資料陣列
 */
export const downloadCSV = <T extends Record<string, any>>(
    filename: string,
    headers: { key: keyof T; label: string }[],
    data: T[]
) => {
    // 1. 產生 CSV 標頭行
    const headerRow = headers.map(h => `"${h.label}"`).join(",");

    // 2. 產生資料行
    const rows = data.map(row => {
        return headers.map(header => {
            const value = row[header.key];
            // 處理 null/undefined
            if (value === null || value === undefined) return '""';

            // 轉為字串並處理內含的雙引號 (Excel 格式: " -> "")
            const stringValue = String(value).replace(/"/g, '""');

            // 包裹雙引號
            return `"${stringValue}"`;
        }).join(",");
    });

    // 3. 組合完整內容 (加上 BOM 讓 Excel 正確識別 UTF-8)
    const csvContent = "\uFEFF" + [headerRow, ...rows].join("\n");

    // 4. 建立 Blob 並下載
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
