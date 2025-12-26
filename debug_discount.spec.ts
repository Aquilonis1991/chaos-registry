
import { test, expect } from '@playwright/test';

test('Debug Daily Discount Logs', async ({ page }) => {
    // Increase timeout to 2 minutes
    test.setTimeout(120000);

    // Listen to console logs
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[SystemConfig]') || text.includes('[CreateTopic]')) {
            console.log(`PAGE LOG: ${text}`);
        }
    });

    // 1. Login
    console.log('Navigating to Auth...');
    await page.goto('http://localhost:8080/auth');
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("登入")');
    await page.waitForTimeout(3000);

    // 2. Go to Create Topic
    // 2. Go to Create Topic
    console.log('Navigating to Create Topic...');
    await page.goto('http://localhost:8080/create');

    // Wait for the debug banner to appear
    try {
        const debugSelector = '.bg-red-100';
        await page.waitForSelector(debugSelector, { timeout: 10000 });
        const debugText = await page.textContent(debugSelector);
        console.log('PAGE LOG: FOUND DEBUG BANNER:', debugText);
    } catch (e) {
        console.log('PAGE LOG: DEBUG BANNER NOT FOUND within timeout');
    }

    // Wait a bit more for other logs
    await page.waitForTimeout(5000);

    console.log('Test finished.');
});
