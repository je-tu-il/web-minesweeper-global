import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));
  const html = await page.content();
  console.log('HTML CONTENT:', html);
  await browser.close();
})();
