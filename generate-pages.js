const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://vacombinedrating.com';
const LAST_REVIEWED = '2026-08-24';
const YEAR = new Date().getFullYear();
const ORG = {
  '@type': 'Organization',
  name: 'Gesmine-Invest Limited',
  legalName: 'Gesmine-Invest Limited',
  url: DOMAIN,
  identifier: { '@type': 'PropertyValue', propertyID: 'UK Company Number', value: '14120136' },
  address: { '@type': 'PostalAddress', streetAddress: 'Hardy House, 269 Poynders Gardens', addressLocality: 'London', postalCode: 'SW4 8PQ', addressCountry: 'GB' }
};

const rateTable = require('./data/compensation-rates-2026.json');
const combinedRatingsTable = require('./data/combined-ratings-table.json');
const bilateralNotes = require('./data/bilateral-factor-notes.json');
const monetization = require('./data/monetization-config.json');

function assertComplete(dataFile, label) {
  const required = ['source', 'last_verified'];
  for (const field of required) {
    if (!dataFile[field] || (field === 'source' && !dataFile.source.url)) {
      throw new Error(`BUILD BLOCKED: "${label}" is missing required field "${field}" — no page without a cited, dated source.`);
    }
  }
}
assertComplete(rateTable, 'compensation-rates-2026.json');
assertComplete(combinedRatingsTable, 'combined-ratings-table.json');
assertComplete(bilateralNotes, 'bilateral-factor-notes.json');

// load + validate every history file present under data/compensation-rates-history/
const historyDir = path.join(__dirname, 'data', 'compensation-rates-history');
const rateHistory = {};
for (const file of fs.readdirSync(historyDir)) {
  if (!file.endsWith('.json')) continue;
  const data = JSON.parse(fs.readFileSync(path.join(historyDir, file), 'utf8'));
  assertComplete(data, `compensation-rates-history/${file}`);
  const year = Number(file.replace('.json', ''));
  rateHistory[year] = data;
}

function monetizationSlot(id) {
  const adsOn = monetization.ads.enabled && monetization.ads.slots.includes(id);
  const leadOn = monetization.leadgen.enabled && monetization.leadgen.placement.includes(id);
  const loanOn = monetization.loan_affiliate.enabled && monetization.loan_affiliate.placement.includes(id);
  if (!adsOn && !leadOn && !loanOn) return `<div id="mon-${id}" class="mon-slot" hidden></div>`;
  let inner = '';
  if (leadOn) inner += `<a class="cta-leadgen" href="${monetization.leadgen.destination_url}">${monetization.leadgen.cta_text}</a>`;
  if (loanOn) inner += `<a class="cta-affiliate" href="${monetization.loan_affiliate.destination_url}">${monetization.loan_affiliate.cta_text}<small>Informational — not an endorsement.</small></a>`;
  return `<div id="mon-${id}" class="mon-slot">${inner}</div>`;
}

function webApp(fields) {
  return Object.assign({
    '@type': 'WebApplication',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    dateModified: LAST_REVIEWED,
    author: ORG,
    publisher: ORG,
    version: '2026-08-v1'
  }, fields);
}

function faqJsonLd(items) {
  return {
    '@type': 'FAQPage',
    mainEntity: items.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a }
    }))
  };
}

function eeatSection() {
  return `
<div class="eeat-section">
  <h2 class="eeat-title">Transparency &amp; Methodology</h2>
  <div class="eeat-compliance-item">
    <div class="eeat-compliance-text"><h4>Independent, source-checked figures</h4><p>Every dollar figure traces to <a href="${rateTable.source.url}" target="_blank" rel="noopener">VA.gov's published compensation rate tables</a> (last verified ${rateTable.last_verified}) or <a href="${combinedRatingsTable.source.url}" target="_blank" rel="noopener">38 CFR §4.25</a>. No AI-estimated numbers.</p></div>
  </div>
  <div class="eeat-compliance-item">
    <div class="eeat-compliance-text"><h4>Not legal or financial advice</h4><p>This tool estimates VA disability ratings and pay for planning purposes only. For your official rating or a claim decision, consult an accredited <a href="https://www.va.gov/vso/" target="_blank" rel="noopener">Veterans Service Organization</a> or a VA-accredited attorney/claims agent.</p></div>
  </div>
  <div class="eeat-compliance-item">
    <div class="eeat-compliance-text"><h4>Published by an identifiable operator</h4><p>Run by Gesmine-Invest Limited (UK company 14120136) — see <a href="/about/">About</a> for full sourcing methodology and data gaps we disclose rather than paper over.</p></div>
  </div>
</div>`;
}

function layout({ title, description, canonicalPath, h1, subtitle, jsonLd, bodyHtml }) {
  const canonical = `${DOMAIN}${canonicalPath}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/styles.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
<header>
<a href="/">VA Combined Rating Calculator</a>
<h1>${h1}</h1>
<p>${subtitle}</p>
<p class="reviewed-badge">Last reviewed ${LAST_REVIEWED}</p>
</header>
<div class="va-branding-notice">This is an independent tool — not affiliated with the U.S. Department of Veterans Affairs, not a VSO, and not a law firm.</div>
<nav class="crumbs"><a href="/">Home</a> / ${h1}</nav>
<main>
${bodyHtml}
${eeatSection()}
</main>
<footer>
<p>VA Combined Rating Calculator is published by Gesmine-Invest Limited, registered UK company number 14120136, registered office at Hardy House, 269 Poynders Gardens, London, United Kingdom, SW4 8PQ. Not affiliated with the U.S. Department of Veterans Affairs.</p>
<p><a href="/about/">About</a> · <a href="/privacy/">Privacy</a> · <a href="/changelog/">Changelog</a> · &copy; ${YEAR} VA Combined Rating Calculator. Estimates only — not legal or financial advice.</p>
</footer>
<script src="/assets/calc-engine.js"></script>
</body>
</html>
`;
}

function write(dir, html) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log('wrote', dir);
}

function claimStageWidget() {
  return `
  <div id="claim-stage-block">
    <label>Where are you in the claims process?
      <select id="claim-stage">
        <option value="not_filed">Haven't filed yet</option>
        <option value="awaiting_decision">Filed, awaiting decision</option>
        <option value="denied_appealing">Denied, considering appeal</option>
        <option value="rated_want_increase">Already rated, want an increase</option>
      </select>
    </label>
    <div id="vso-notice" class="vso-notice">
      <h3>Free help is available</h3>
      <p>VA claims representation is regulated — before an initial decision is issued, fees for help with a claim are tightly restricted. Free, accredited help is available from Veterans Service Organizations:</p>
      <ul>
        <li><a href="https://www.vfw.org/assistance/va-claims-assistance" rel="nofollow noopener" target="_blank">VFW Veterans Service Officers</a></li>
        <li><a href="https://www.dav.org/veterans/resources/find-your-local-office/" rel="nofollow noopener" target="_blank">DAV National Service Officers</a></li>
        <li><a href="https://www.legion.org/serviceofficers" rel="nofollow noopener" target="_blank">American Legion Service Officers</a></li>
      </ul>
    </div>
    <div id="attorney-block" hidden>
      <a href="#leadgen" class="cta-leadgen">Talk to an accredited VA disability attorney<small>Free case review. Contingency-fee cases only apply after an initial decision or on appeal.</small></a>
    </div>
  </div>`;
}

function claimStageScript() {
  return `
  const claimStageSelect = document.getElementById('claim-stage');
  const vsoNotice = document.getElementById('vso-notice');
  const attorneyBlock = document.getElementById('attorney-block');
  function updateClaimStageRouting() {
    const routeToVso = claimStageSelect.value === 'not_filed' || claimStageSelect.value === 'awaiting_decision';
    vsoNotice.hidden = !routeToVso;
    attorneyBlock.hidden = routeToVso;
  }
  claimStageSelect.addEventListener('change', updateClaimStageRouting);
  updateClaimStageRouting();`;
}

function leadgenSection() {
  return `
<section id="leadgen">
<h2>Have questions about your claim or appeal?</h2>
<p>Share a few details and we'll connect you with an accredited VA disability attorney or claims agent for a free case review.</p>
<form id="lead-form">
  <label>Name <input type="text" name="name" required></label>
  <label>Email <input type="email" name="email" required></label>
  <label>Combined rating (%) <input type="text" name="rating"></label>
  <label>Brief context <input type="text" name="context"></label>
  <button type="submit" class="submit-btn">Request a free case review</button>
</form>
<p class="privacy-note">By submitting, you agree to be contacted about your claim. See our <a href="/privacy/">privacy policy</a>.</p>
</section>`;
}

function leadgenScript() {
  return `
  document.getElementById('lead-form').addEventListener('submit', function(e) {
    e.preventDefault();
    alert('Thanks — this form is a placeholder. Wire it to a real submission endpoint once an OGC-accredited lead buyer is verified (see monetization-config.json).');
  });`;
}

function toolLinksSection(currentSlug) {
  const tools = [
    { slug: '', label: 'Combined rating calculator' },
    { slug: 'va-disability-pay-calculator', label: 'Monthly pay calculator' },
    { slug: 'va-disability-compensation-calculator', label: 'Compensation with dependents' },
    { slug: 'va-disability-back-pay-calculator', label: 'Back pay calculator' },
    { slug: 'guides/how-va-combined-ratings-work', label: 'How combined ratings work' }
  ].filter(t => t.slug !== currentSlug);
  return `
<section>
<h2>Other tools</h2>
<ul class="tool-links">
${tools.map(t => `  <li><a href="/${t.slug}${t.slug ? '/' : ''}">${t.label}</a></li>`).join('\n')}
</ul>
</section>`;
}

function dependentSelectOptions() {
  return `
        <option value="alone">Veteran alone (no dependents)</option>
        <option value="spouse_no_children">Spouse only</option>
        <option value="spouse_1_parent">Spouse + 1 dependent parent</option>
        <option value="spouse_2_parents">Spouse + 2 dependent parents</option>
        <option value="parent_1">1 dependent parent only</option>
        <option value="parent_2">2 dependent parents only</option>
        <option value="child_1_only">1 child only (no spouse)</option>
        <option value="child_1_spouse">Spouse + 1 child</option>
        <option value="child_1_spouse_1_parent">Spouse + 1 child + 1 parent</option>
        <option value="child_1_spouse_2_parents">Spouse + 1 child + 2 parents</option>
        <option value="child_1_parent_1">1 child + 1 parent</option>
        <option value="child_1_parent_2">1 child + 2 parents</option>`;
}

function rateTableSection() {
  const rows = ['30', '40', '50', '60', '70', '80', '90', '100'].map(pct => {
    const b = rateTable.rates_30_100[pct];
    return `<tr><td>${pct}%</td><td>$${b.alone.toLocaleString()}</td><td>$${b.spouse_no_children.toLocaleString()}</td><td>+$${b.additional_child_under_18}</td><td>+$${b.additional_spouse_aid_attendance}</td></tr>`;
  }).join('\n');
  return `
<section>
<h2>2026 VA Compensation Rates (effective ${rateTable.effective_date})</h2>
<div class="rate-table-wrapper">
<table>
<tr><th>Rating</th><th>Veteran alone</th><th>+ Spouse</th><th>Each add'l child under 18</th><th>Spouse A&amp;A</th></tr>
${rows}
</table>
</div>
<p class="formula-footnote">10% = $${rateTable.rates_10_20['10']}/mo, 20% = $${rateTable.rates_10_20['20']}/mo (flat, no dependent add-on). Source: <a href="${rateTable.source.url}" rel="nofollow noopener">VA.gov</a>, verified ${rateTable.last_verified}.</p>
</section>`;
}

// ---- va-disability-pay-calculator ----
{
  const body = `
<div class="disclaimer-banner">Estimate only, based on official 2026 VA compensation rates. Not a substitute for your VA award letter.</div>
<form id="calc-form">
  <label>Combined disability rating (%)
    <select id="ratingPct">
      <option value="10">10%</option><option value="20">20%</option>
      <option value="30">30%</option><option value="40">40%</option><option value="50">50%</option>
      <option value="60">60%</option><option value="70" selected>70%</option><option value="80">80%</option>
      <option value="90">90%</option><option value="100">100%</option>
    </select>
  </label>
  <label>Dependent status
    <select id="depStatus">${dependentSelectOptions()}</select>
  </label>
  <button type="submit" class="submit-btn">Calculate monthly pay</button>
</form>
<div id="results-block">
  <div class="result-amount" id="r-monthly">$0/mo</div>
  <p id="r-note" class="privacy-note"></p>
</div>
${rateTableSection()}
${toolLinksSection('va-disability-pay-calculator')}
<section>
<h2>FAQ</h2>
<h3>How much is 100% VA disability per month?</h3>
<p>$${rateTable.rates_30_100['100'].alone.toLocaleString()}/mo for a veteran alone with no dependents, effective ${rateTable.effective_date}. Add a spouse, children, or dependent parents and the amount increases — see the rate table above.</p>
<h3>Do ratings below 30% get extra pay for dependents?</h3>
<p>No. Ratings of 10% and 20% pay a flat rate ($${rateTable.rates_10_20['10']}/mo and $${rateTable.rates_10_20['20']}/mo respectively) with no dependent add-on. The dependent-status matrix only applies at 30% and above.</p>
</section>
<script>
const RATE_TABLE = ${JSON.stringify(rateTable)};
document.getElementById('calc-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const ratingPct = Number(document.getElementById('ratingPct').value);
  const status = document.getElementById('depStatus').value;
  const r = lookupMonthlyPay(ratingPct, { status: status }, RATE_TABLE);
  document.getElementById('r-monthly').textContent = fmtUSD(r.monthly) + '/mo';
  document.getElementById('r-note').textContent = r.note;
  document.getElementById('results-block').classList.add('visible');
});
</script>`;
  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    webApp({ name: 'VA Disability Pay Calculator' }),
    faqJsonLd([
      ['How much is 100% VA disability per month?', `$${rateTable.rates_30_100['100'].alone.toLocaleString()}/mo for a veteran alone with no dependents, effective ${rateTable.effective_date}.`],
      ['Do ratings below 30% get extra pay for dependents?', 'No. Ratings of 10% and 20% pay a flat rate with no dependent add-on.']
    ]),
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: DOMAIN + '/' },
      { '@type': 'ListItem', position: 2, name: 'VA Disability Pay Calculator', item: DOMAIN + '/va-disability-pay-calculator/' }
    ]},
    ORG
  ]};
  write('va-disability-pay-calculator', layout({
    title: 'VA Disability Pay Calculator — 2026 Monthly Rates by Rating & Dependents',
    description: 'Look up your exact monthly VA disability compensation by combined rating percentage and dependent status, using official 2026 VA rates.',
    canonicalPath: '/va-disability-pay-calculator/',
    h1: 'VA Disability Pay Calculator',
    subtitle: 'Official 2026 monthly rates by rating percentage and dependent status.',
    jsonLd, bodyHtml: body
  }));
}

// ---- va-disability-compensation-calculator (includes #with-dependents anchor) ----
{
  const body = `
<div class="disclaimer-banner">Estimate only, based on official 2026 VA compensation rates. Not a substitute for your VA award letter.</div>
<form id="calc-form">
  <label>Combined disability rating (%)
    <select id="ratingPct">
      <option value="10">10%</option><option value="20">20%</option>
      <option value="30">30%</option><option value="40">40%</option><option value="50">50%</option>
      <option value="60">60%</option><option value="70" selected>70%</option><option value="80">80%</option>
      <option value="90">90%</option><option value="100">100%</option>
    </select>
  </label>
  <label>Dependent status
    <select id="depStatus">${dependentSelectOptions()}</select>
  </label>
  <label>Additional children under 18 (beyond the first)
    <input type="number" id="extraChildren" min="0" step="1" value="0">
  </label>
  <label>Additional school-age children (18-23, in school)
    <input type="number" id="extraSchoolChildren" min="0" step="1" value="0">
  </label>
  <label class="checkbox-label"><input type="checkbox" id="spouseAA"> Spouse receives Aid &amp; Attendance</label>
  <button type="submit" class="submit-btn">Calculate compensation</button>
</form>
<div id="results-block">
  <div class="result-amount" id="r-monthly">$0/mo</div>
  <p id="r-note" class="privacy-note"></p>
</div>

<section id="with-dependents">
<h2>How dependent status changes your compensation</h2>
<p>At 30% and above, VA adds a fixed dollar amount for each dependent category: a spouse, dependent parents, and children (with a higher rate for a spouse or child under 18, and a separate rate for school-age children 18-23 and a spouse who qualifies for Aid &amp; Attendance). Ratings below 30% pay a flat rate regardless of dependents.</p>
<p>Worked example at 70%: a veteran alone receives $${rateTable.rates_30_100['70'].alone.toLocaleString()}/mo. The same veteran with a spouse and one child receives $${rateTable.rates_30_100['70'].child_1_spouse.toLocaleString()}/mo — a difference of $${(rateTable.rates_30_100['70'].child_1_spouse - rateTable.rates_30_100['70'].alone).toLocaleString()}/mo.</p>
</section>

${rateTableSection()}
${toolLinksSection('va-disability-compensation-calculator')}
<section>
<h2>FAQ</h2>
<h3>Does VA disability compensation count as income for taxes?</h3>
<p>No. VA disability compensation is not subject to federal income tax.</p>
<h3>What if my dependent situation changes mid-year?</h3>
<p>Report the change to VA — your monthly amount updates going forward from the date of the change, it is not retroactively recalculated for the whole year.</p>
</section>
<script>
const RATE_TABLE = ${JSON.stringify(rateTable)};
document.getElementById('calc-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const ratingPct = Number(document.getElementById('ratingPct').value);
  const dependents = {
    status: document.getElementById('depStatus').value,
    extraChildrenUnder18: Number(document.getElementById('extraChildren').value) || 0,
    extraChildrenSchool: Number(document.getElementById('extraSchoolChildren').value) || 0,
    spouseAA: document.getElementById('spouseAA').checked
  };
  const r = lookupMonthlyPay(ratingPct, dependents, RATE_TABLE);
  document.getElementById('r-monthly').textContent = fmtUSD(r.monthly) + '/mo';
  document.getElementById('r-note').textContent = r.note;
  document.getElementById('results-block').classList.add('visible');
});
</script>`;
  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    webApp({ name: 'VA Disability Compensation Calculator' }),
    faqJsonLd([
      ['Does VA disability compensation count as income for taxes?', 'No. VA disability compensation is not subject to federal income tax.'],
      ['What if my dependent situation changes mid-year?', 'Report the change to VA — your monthly amount updates going forward from the date of the change, it is not retroactively recalculated for the whole year.']
    ]),
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: DOMAIN + '/' },
      { '@type': 'ListItem', position: 2, name: 'VA Disability Compensation Calculator', item: DOMAIN + '/va-disability-compensation-calculator/' }
    ]},
    ORG
  ]};
  write('va-disability-compensation-calculator', layout({
    title: 'VA Disability Compensation Calculator — Full Dependent-Status Breakdown',
    description: 'Calculate your VA disability compensation including spouse, children, and dependent-parent add-ons, using official 2026 rates.',
    canonicalPath: '/va-disability-compensation-calculator/',
    h1: 'VA Disability Compensation Calculator',
    subtitle: 'Rating plus spouse, children, and dependent parents — the full picture.',
    jsonLd, bodyHtml: body
  }));
}

// ---- va-disability-back-pay-calculator ----
{
  const body = `
<div class="disclaimer-banner">Estimate only. Uses historical VA rates per year where sourced — see coverage notes below. Not a substitute for your VA award letter. Not interest-bearing; VA back pay does not accrue interest.</div>
<form id="calc-form">
  <div id="period-rows">
    <div class="repeater-row" data-period-row>
      <label>Rating (%)
        <select class="period-rating">
          <option value="10">10%</option><option value="20">20%</option>
          <option value="30">30%</option><option value="40">40%</option><option value="50">50%</option>
          <option value="60">60%</option><option value="70" selected>70%</option><option value="80">80%</option>
          <option value="90">90%</option><option value="100">100%</option>
        </select>
      </label>
      <label>Effective from (YYYY-MM)
        <input type="month" class="period-start" value="2024-01">
      </label>
      <button type="button" class="remove-row" title="Remove">✕</button>
    </div>
  </div>
  <button type="button" id="add-period-btn" class="add-row-btn">+ Add a rating-change period</button>
  <label>Dependent status (applies to all periods)
    <select id="depStatus">${dependentSelectOptions()}</select>
  </label>
  <button type="submit" class="submit-btn">Calculate back pay</button>
</form>
<div id="results-block">
  <div class="result-amount" id="r-total">$0</div>
  <div class="result-row"><span>Months covered</span><span id="r-months">0</span></div>
  <p id="r-warning" class="result-warning" hidden></p>
</div>
${toolLinksSection('va-disability-back-pay-calculator')}
<section>
<h2>FAQ</h2>
<h3>Does VA back pay include interest?</h3>
<p>No. VA disability back pay is not interest-bearing — you receive the sum of the monthly amounts you were owed, not an interest-adjusted total.</p>
<h3>Why does this use a different rate for older months?</h3>
<p>VA compensation rates change every December 1st with a cost-of-living adjustment (COLA). A back-pay period spanning more than about 14 months usually crosses at least one rate change — this calculator applies the historically correct rate for each month rather than a flat current-year rate, which would overstate or understate older months.</p>
<h3>What if I had a rating change during the back-pay period?</h3>
<p>Use "Add a rating-change period" to enter each period at its own rating and start date — the calculator sums each period separately at the applicable rate.</p>
</section>
<script>
const RATE_TABLE = ${JSON.stringify(rateTable)};
const RATE_HISTORY = ${JSON.stringify(rateHistory)};
const CURRENT_YEAR = ${new Date(rateTable.effective_date).getFullYear()};

function periodRowTemplate() {
  const div = document.createElement('div');
  div.className = 'repeater-row';
  div.setAttribute('data-period-row', '');
  div.innerHTML = \`
    <label>Rating (%)
      <select class="period-rating">
        <option value="10">10%</option><option value="20">20%</option>
        <option value="30">30%</option><option value="40">40%</option><option value="50">50%</option>
        <option value="60">60%</option><option value="70">70%</option><option value="80">80%</option>
        <option value="90">90%</option><option value="100">100%</option>
      </select>
    </label>
    <label>Effective from (YYYY-MM)
      <input type="month" class="period-start" value="2024-01">
    </label>
    <button type="button" class="remove-row" title="Remove">✕</button>\`;
  return div;
}
document.getElementById('add-period-btn').addEventListener('click', function() {
  document.getElementById('period-rows').appendChild(periodRowTemplate());
  wireRemove();
});
function wireRemove() {
  document.querySelectorAll('.remove-row').forEach(function(btn) {
    btn.onclick = function() {
      const rows = document.querySelectorAll('[data-period-row]');
      if (rows.length > 1) btn.closest('[data-period-row]').remove();
    };
  });
}
wireRemove();

document.getElementById('calc-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const depStatus = document.getElementById('depStatus').value;
  const rows = Array.from(document.querySelectorAll('[data-period-row]'));
  const periods = rows.map(function(row, i) {
    const nextRow = rows[i + 1];
    return {
      ratingPct: Number(row.querySelector('.period-rating').value),
      dependents: { status: depStatus },
      startDate: row.querySelector('.period-start').value,
      endDate: nextRow ? nextRow.querySelector('.period-start').value : null
    };
  });
  const r = calcBackPay(periods, RATE_HISTORY, RATE_TABLE, CURRENT_YEAR);
  document.getElementById('r-total').textContent = fmtUSD(r.total);
  document.getElementById('r-months').textContent = r.months;
  const warnEl = document.getElementById('r-warning');
  if (r.warning) { warnEl.textContent = r.warning; warnEl.hidden = false; } else { warnEl.hidden = true; }
  document.getElementById('results-block').classList.add('visible');
});
</script>`;
  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    webApp({ name: 'VA Disability Back Pay Calculator' }),
    faqJsonLd([
      ['Does VA back pay include interest?', 'No. VA disability back pay is not interest-bearing.'],
      ['Why does this use a different rate for older months?', 'VA compensation rates change every December 1st with a COLA adjustment — this calculator applies the historically correct rate per month.']
    ]),
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: DOMAIN + '/' },
      { '@type': 'ListItem', position: 2, name: 'VA Disability Back Pay Calculator', item: DOMAIN + '/va-disability-back-pay-calculator/' }
    ]},
    ORG
  ]};
  write('va-disability-back-pay-calculator', layout({
    title: 'VA Disability Back Pay Calculator — Uses Historical Rates, Not a Flat Estimate',
    description: 'Calculate your VA disability back pay using the correct historical rate for each month, not a flat current-year estimate.',
    canonicalPath: '/va-disability-back-pay-calculator/',
    h1: 'VA Disability Back Pay Calculator',
    subtitle: 'Applies the correct historical rate to every month, including rating changes.',
    jsonLd, bodyHtml: body
  }));
}

// ---- guides/how-va-combined-ratings-work ----
{
  const body = `
<section>
<h2>Why VA doesn't just add up your percentages</h2>
<p>If you have a 50% disability and a 30% disability, you might expect them to combine to 80%. VA's Combined Ratings Table (38 CFR §4.25) doesn't work that way. Instead, VA uses a "whole person" theory: it treats a veteran as 100% able-bodied to start, and each successive disability rating is applied against whatever efficiency remains — not against the original 100%.</p>
<h3>Worked example</h3>
<p>Veteran has a 50% disability and a 30% disability.</p>
<ol>
<li>Start with the higher rating: 50%.</li>
<li>The veteran has 50% of their "whole person" efficiency remaining (100% − 50%).</li>
<li>The 30% disability is applied against that remaining 50%: 30% × 50% = 15%.</li>
<li>Combined value: 50% + 15% = 65%.</li>
<li>VA rounds to the nearest 10%. 65 ends in 5, which rounds UP: final combined rating = <strong>70%</strong>.</li>
</ol>
<p>${combinedRatingsTable.rounding_rule.description}</p>
<h3>The bilateral factor (38 CFR §4.26)</h3>
<p>${bilateralNotes.description}</p>
<p>Qualifying pairs: ${bilateralNotes.qualifying_pairs.join(', ')}. ${bilateralNotes.non_qualifying_example}</p>
<p>Use the <a href="/">combined rating calculator</a> to run your own numbers, including the bilateral factor toggle.</p>
</section>
<section>
<h2>Source</h2>
<p>Formula and rounding rule: <a href="${combinedRatingsTable.source.url}" rel="nofollow noopener">38 CFR §4.25</a>, cross-checked against a published worked-example walkthrough. Bilateral factor: <a href="${bilateralNotes.source.url}" rel="nofollow noopener">38 CFR §4.26</a>. Last verified ${combinedRatingsTable.last_verified}.</p>
</section>
${toolLinksSection('guides/how-va-combined-ratings-work')}`;
  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Article', headline: 'How VA Combined Ratings Work', datePublished: '2026-08-24', dateModified: LAST_REVIEWED, author: ORG, publisher: ORG },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: DOMAIN + '/' },
      { '@type': 'ListItem', position: 2, name: 'How VA Combined Ratings Work', item: DOMAIN + '/guides/how-va-combined-ratings-work/' }
    ]},
    ORG
  ]};
  write('guides/how-va-combined-ratings-work', layout({
    title: 'How VA Combined Ratings Work — Worked Example',
    description: 'Why VA doesn\'t add disability percentages together, with a step-by-step worked example of the official whole-person combination formula.',
    canonicalPath: '/guides/how-va-combined-ratings-work/',
    h1: 'How VA Combined Ratings Work',
    subtitle: 'A step-by-step worked example of VA\'s whole-person formula.',
    jsonLd, bodyHtml: body
  }));
}

// ---- about ----
{
  const body = `
<section>
<h2>About VA Combined Rating Calculator</h2>
<p>VA Combined Rating Calculator is published by Gesmine-Invest Limited, registered UK company number 14120136, registered office at Hardy House, 269 Poynders Gardens, London, United Kingdom, SW4 8PQ.</p>
<p><strong>We are not affiliated with the U.S. Department of Veterans Affairs, not a Veterans Service Organization (VSO), and not a law firm.</strong> This site provides free, independent calculators for VA disability combined ratings, monthly compensation, and back pay, built from VA's published rate tables and 38 CFR regulations.</p>
<h3>Sourcing methodology</h3>
<p>Every rate figure on this site traces to VA.gov's published compensation rate tables or the Code of Federal Regulations, with the source URL and last-verified date shown on each page. We do not publish invented or estimated dollar figures. Historical rate data used for back-pay calculations is sourced per year; where full dependent-status breakdowns weren't available for older years, we say so explicitly rather than guess.</p>
<h3>What we don't calculate</h3>
<p>We do not calculate Special Monthly Compensation (SMC), which applies to specific catastrophic disabilities. If you believe SMC may apply to your case, consult an accredited VSO or attorney.</p>
<h3>Monetization disclosure</h3>
<p>This site may connect visitors with accredited VA disability attorneys/claims agents for a free case review, and may include informational links to VA home loan lenders. We only route attorney-referral leads for claims past the initial-decision stage, consistent with 38 CFR §14.636 fee restrictions — veterans who haven't yet filed are directed to free accredited VSO resources instead. Some links may be affiliate links.</p>
</section>`;
  const jsonLd = { '@context': 'https://schema.org', '@graph': [ORG] };
  write('about', layout({
    title: 'About — VA Combined Rating Calculator',
    description: 'Who publishes this site, our sourcing methodology, and our monetization disclosure.',
    canonicalPath: '/about/',
    h1: 'About',
    subtitle: '',
    jsonLd, bodyHtml: body
  }));
}

// ---- privacy ----
{
  const body = `
<section>
<h2>Privacy Policy</h2>
<p>Calculator inputs are processed entirely in your browser and are not sent to our servers.</p>
<p>If you submit the case-review request form, we collect your name, email, combined rating, and any context you provide to connect you with an accredited VA disability attorney or claims agent. We do not sell this information to unrelated third parties.</p>
<p>Last updated ${LAST_REVIEWED}.</p>
</section>`;
  const jsonLd = { '@context': 'https://schema.org', '@graph': [ORG] };
  write('privacy', layout({
    title: 'Privacy Policy — VA Combined Rating Calculator',
    description: 'How this site handles your data.',
    canonicalPath: '/privacy/',
    h1: 'Privacy Policy',
    subtitle: '',
    jsonLd, bodyHtml: body
  }));
}

// ---- changelog ----
{
  const body = `
<section>
<h2>Changelog</h2>
<ul>
<li><strong>${LAST_REVIEWED}</strong> — Site launched: combined rating calculator with bilateral factor, monthly pay calculator, compensation-with-dependents calculator, back-pay calculator using historical rate data (2020-2026), and a guide to how combined ratings work.</li>
</ul>
<h3>Known data gaps</h3>
<ul>
<li>Historical compensation-rates-history files for 2020-2024 have full "veteran alone" rates but partial dependent-status matrices (see each file's <code>coverage_note</code>) — the back-pay calculator warns when a calculation falls back to the alone-rate for a period with incomplete dependent data.</li>
<li>The combined-ratings-table.json 3-condition fixture ([30,20,10] → 50) is formula-derived and corroborated against a published worked example, but not independently cross-checked against a raw rendering of the official Table I (eCFR/GovInfo blocked automated fetch at build time) — flagged for manual spot-check.</li>
</ul>
</section>`;
  const jsonLd = { '@context': 'https://schema.org', '@graph': [ORG] };
  write('changelog', layout({
    title: 'Changelog — VA Combined Rating Calculator',
    description: 'What changed on this site and when, including known data gaps.',
    canonicalPath: '/changelog/',
    h1: 'Changelog',
    subtitle: '',
    jsonLd, bodyHtml: body
  }));
}

console.log('Done.');
