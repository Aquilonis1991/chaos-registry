#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
將 VoteChaos_BannedWords_V5.csv 轉換為 SQL INSERT 語句
執行方式：python 轉換CSV為SQL腳本.py
"""

import csv
import json

def convert_csv_to_sql(csv_file_path, sql_output_path):
    """將 CSV 轉換為 SQL INSERT 語句"""
    
    sql_statements = []
    sql_statements.append("-- 禁字表數據導入")
    sql_statements.append("-- 從 VoteChaos_BannedWords_V5.csv 轉換")
    sql_statements.append("")
    sql_statements.append("INSERT INTO public.banned_words (level, category, keyword, action)")
    sql_statements.append("VALUES")
    
    values = []
    
    try:
        with open(csv_file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                level = row.get('level', '').strip()
                category = row.get('category', '').strip()
                keyword = row.get('keyword', '').strip()
                action = row.get('action', 'block').strip()
                
                if level and keyword and action:
                    # 轉義單引號
                    category_escaped = category.replace("'", "''")
                    keyword_escaped = keyword.replace("'", "''")
                    values.append(f"  ('{level}', '{category_escaped}', '{keyword_escaped}', '{action}')")
    
    except UnicodeDecodeError:
        # 嘗試使用 Big5 編碼（繁體中文常見）
        try:
            with open(csv_file_path, 'r', encoding='big5') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    level = row.get('level', '').strip()
                    category = row.get('category', '').strip()
                    keyword = row.get('keyword', '').strip()
                    action = row.get('action', 'block').strip()
                    
                    if level and keyword and action:
                        category_escaped = category.replace("'", "''")
                        keyword_escaped = keyword.replace("'", "''")
                        values.append(f"  ('{level}', '{category_escaped}', '{keyword_escaped}', '{action}')")
        except:
            print("無法讀取 CSV 文件，請檢查編碼")
            return
    
    if not values:
        print("沒有找到有效的數據")
        return
    
    # 組合 SQL 語句
    for i, value in enumerate(values):
        if i == len(values) - 1:
            sql_statements.append(value + ";")
        else:
            sql_statements.append(value + ",")
    
    sql_statements.append("")
    sql_statements.append("-- 如果有重複，更新現有記錄")
    sql_statements.append("ON CONFLICT (keyword, level) DO UPDATE")
    sql_statements.append("SET")
    sql_statements.append("  category = EXCLUDED.category,")
    sql_statements.append("  action = EXCLUDED.action,")
    sql_statements.append("  is_active = true,")
    sql_statements.append("  updated_at = now();")
    
    # 寫入文件
    with open(sql_output_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_statements))
    
    print(f"✅ 轉換完成！")
    print(f"📁 SQL 文件已生成：{sql_output_path}")
    print(f"📊 共 {len(values)} 條記錄")

def convert_csv_to_json(csv_file_path, json_output_path):
    """將 CSV 轉換為 JSON 格式（用於 import_banned_words_from_csv 函數）"""
    
    data = []
    
    try:
        with open(csv_file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                level = row.get('level', '').strip()
                category = row.get('category', '').strip()
                keyword = row.get('keyword', '').strip()
                action = row.get('action', 'block').strip()
                
                if level and keyword and action:
                    data.append({
                        'level': level,
                        'category': category,
                        'keyword': keyword,
                        'action': action
                    })
    except UnicodeDecodeError:
        try:
            with open(csv_file_path, 'r', encoding='big5') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    level = row.get('level', '').strip()
                    category = row.get('category', '').strip()
                    keyword = row.get('keyword', '').strip()
                    action = row.get('action', 'block').strip()
                    
                    if level and keyword and action:
                        data.append({
                            'level': level,
                            'category': category,
                            'keyword': keyword,
                            'action': action
                        })
        except:
            print("無法讀取 CSV 文件")
            return
    
    with open(json_output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ JSON 文件已生成：{json_output_path}")
    print(f"📊 共 {len(data)} 條記錄")
    
    # 生成 SQL 調用語句
    sql_call = f"""
-- 使用 import_banned_words_from_csv 函數導入
SELECT * FROM public.import_banned_words_from_csv(
  '{json.dumps(data, ensure_ascii=False).replace("'", "''")}'::JSONB
);
"""
    
    with open(json_output_path.replace('.json', '_import.sql'), 'w', encoding='utf-8') as f:
        f.write(sql_call)
    
    print(f"✅ SQL 調用文件已生成：{json_output_path.replace('.json', '_import.sql')}")

if __name__ == '__main__':
    csv_file = r'c:\Users\USER\Documents\工作用\VoteChaos_BannedWords_V5.csv'
    sql_file = '導入禁字表數據.sql'
    json_file = '禁字表數據.json'
    
    print("🔄 開始轉換 CSV...")
    convert_csv_to_sql(csv_file, sql_file)
    print("\n🔄 生成 JSON 格式...")
    convert_csv_to_json(csv_file, json_file)
    print("\n✅ 全部完成！")

