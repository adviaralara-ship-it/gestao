const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set viewport to emulate a mobile device
  await page.setViewport({ width: 375, height: 812, isMobile: true });
  
  await page.goto('http://localhost:4173/eventos/valida/test', { waitUntil: 'networkidle0' });
  
  await page.screenshot({ path: 'screenshot.png', fullPage: true });
  
  await browser.close();
})();
