const puppeteer = require('puppeteer');
(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('dialog', async dialog => {
      console.log('DIALOG:', dialog.message());
      await dialog.accept();
    });
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    console.log('Navigating to local site...');
    await page.goto('file:///C:/Users/b7be/.gemini/antigravity/scratch/subtitles-app/movie.html?id=anime-38000&type=anime', { waitUntil: 'networkidle0' });
    
    const title = await page.$eval('#movieTitle', el => el.textContent);
    console.log('Title text content:', title);
    
    await browser.close();
  } catch (err) {
    console.error('PUPPETEER ERROR:', err);
  }
})();
