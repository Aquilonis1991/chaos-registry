
import re
import os

files_to_scan = [
    r"c:\Users\USER\Documents\Mywork\votechaos-main\src\pages\RechargePage.tsx",
    r"c:\Users\USER\Documents\Mywork\votechaos-main\src\pages\MissionPage.tsx"
]

results = []

for file_path in files_to_scan:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        # Pattern for getText('key', 'default value')
        matches = re.findall(r"getText\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)", content)
        for key, default_text in matches:
            if "代幣" in default_text or "token" in default_text.lower() or "recharge" in key:
                results.append(f"{key},code_default,{default_text},,")

print("\n".join(results))
