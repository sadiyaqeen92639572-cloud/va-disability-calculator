const assert = require('assert');
const { combineRatings, applyBilateralFactor, lookupMonthlyPay, calcBackPay, roundToNearestTen } = require('./assets/calc-engine.js');
const combinedRatingsTable = require('./data/combined-ratings-table.json');
const rateTable = require('./data/compensation-rates-2026.json');
const rateHistory2024 = require('./data/compensation-rates-history/2024.json');

let failures = 0;
function check(label, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    console.log(`PASS  ${label}`);
  } catch (e) {
    failures++;
    console.error(`FAIL  ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// --- combineRatings against verified fixtures from combined-ratings-table.json ---
for (const fixture of combinedRatingsTable.verified_fixtures) {
  check(`combineRatings(${JSON.stringify(fixture.input)})`, combineRatings(fixture.input), fixture.combined);
}

// --- rounding boundary sanity ---
check('roundToNearestTen(65)', roundToNearestTen(65), 70); // ends in 5, rounds up per VA convention
check('roundToNearestTen(64)', roundToNearestTen(64), 60);
check('roundToNearestTen(19)', roundToNearestTen(19), 20);

// --- bilateral factor, hand-verified case ---
// Two 20% ratings on both legs: combine(20,20) = 20+20*0.8 = 36 -> +10% = 39.6 -> combine with none = 39.6 -> round to 40
{
  const result = applyBilateralFactor([20, 20], []);
  check('applyBilateralFactor([20,20] bilateral, [])', result, 40);
}

// --- monthly pay lookup, cross-checked against sourced 2026 rate table ---
check('lookupMonthlyPay(100, alone, 2026)', lookupMonthlyPay(100, { status: 'alone' }, rateTable).monthly, rateTable.rates_30_100['100'].alone);
check('lookupMonthlyPay(70, spouse+1child, 2026)', lookupMonthlyPay(70, { status: 'child_1_spouse' }, rateTable).monthly, rateTable.rates_30_100['70'].child_1_spouse);
check('lookupMonthlyPay(10, alone, 2026) flat rate', lookupMonthlyPay(10, { status: 'alone' }, rateTable).monthly, rateTable.rates_10_20['10']);

// --- back pay: single period, 3 months, no dependents, entirely within the current table's coverage ---
{
  const effective = new Date(rateTable.effective_date);
  const currentYear = effective.getFullYear();
  const startYM = `${effective.getFullYear()}-${String(effective.getMonth() + 1).padStart(2, '0')}`;
  const endDate = new Date(effective.getFullYear(), effective.getMonth() + 2, 1);
  const endYM = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}`;
  const periods = [{ ratingPct: 70, dependents: { status: 'alone' }, startDate: startYM, endDate: endYM }];
  const r = calcBackPay(periods, {}, rateTable, currentYear);
  check('calcBackPay single period months', r.months, 3);
  check('calcBackPay single period total', r.total, rateTable.rates_30_100['70'].alone * 3);
}

// --- back pay: period spanning a COLA year boundary, confirms historical rate applied per-month ---
{
  const currentYear = new Date(rateTable.effective_date).getFullYear();
  const rateHistory = { 2024: rateHistory2024 };
  // Dec of the historical year through Jan of current year = 2 months, different rates each.
  const periods = [{ ratingPct: 70, dependents: { status: 'alone' }, startDate: '2024-12', endDate: '2025-01' }];
  const r = calcBackPay(periods, rateHistory, rateTable, currentYear);
  const expectedDec = rateHistory2024.rates_30_100['70'].alone; // 2024.json covers Dec 2024-Nov 2025
  const expectedJan = rateHistory2024.rates_30_100['70'].alone; // same table covers both months (pre-Dec-2025 COLA)
  check('calcBackPay COLA-boundary months', r.months, 2);
  check('calcBackPay COLA-boundary total uses historical rate, not current', r.total, expectedDec + expectedJan);
}

console.log(failures === 0 ? '\nAll tests passed.' : `\n${failures} test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
