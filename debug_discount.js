
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Listen to console logs
    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[SystemConfig]') || text.includes('[CreateTopic]')) {
            console.log(`PAGE LOG: ${text}`);
        }
    });

    try {
        // 1. Login
        console.log('Navigating to Auth...');
        await page.goto('http://localhost:8080/auth');
        await page.fill('input[type="email"]', 'admin@example.com');
        await page.fill('input[type="password"]', 'admin123');
        await page.click('button:has-text("登入")');
        await page.waitForTimeout(3000);

        // 2. Go to Create Topic
        console.log('Navigating to Create Topic...');
        await page.goto('http://localhost:8080/create');
        await page.waitForTimeout(5000); // Wait for configs to load

        console.log('Test finished.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
})();
