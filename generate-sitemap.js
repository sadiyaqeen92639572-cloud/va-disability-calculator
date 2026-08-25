const fs = require('fs');

const DOMAIN = 'https://vacombinedrating.com';
const today = new Date().toISOString().slice(0, 10);

const paths = [
  '/',
  '/va-disability-pay-calculator/',
  '/va-disability-compensation-calculator/',
  '/va-disability-back-pay-calculator/',
  '/guides/how-va-combined-ratings-work/',
  '/about/',
  '/privacy/',
  '/changelog/'
];

const existing = paths.filter(p => fs.existsSync('.' + p + 'index.html'));

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${existing.map(p => `  <url><loc>${DOMAIN}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`;

fs.writeFileSync('sitemap.xml', xml);
console.log(`Wrote sitemap.xml with ${existing.length}/${paths.length} pages.`);
if (existing.length !== paths.length) {
  console.warn('Missing pages:', paths.filter(p => !existing.includes(p)));
}
