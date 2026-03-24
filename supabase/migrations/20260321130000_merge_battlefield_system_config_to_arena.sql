-- 舊分類 battlefield 已廢棄；程式與 RPC 僅讀取 category = arena 的觀點角鬥場參數。
-- 1) key 以 arena_ 開頭者視為誤標分類，合併至 arena（保留有效設定）。
-- 2) 其餘 battlefield 列無程式讀取，直接刪除。

UPDATE public.system_config
SET category = 'arena',
    updated_at = now()
WHERE category = 'battlefield'
  AND key LIKE 'arena\_%' ESCAPE '\';

DELETE FROM public.system_config
WHERE category = 'battlefield';
