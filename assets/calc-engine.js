/*
 * VA disability calculator math.
 * Combined rating: NOT addition — 38 CFR §4.25 "whole person" combination.
 * Bilateral factor: 38 CFR §4.26 — paired-limb disabilities get a +10% bump before final combination.
 * Monthly pay: table lookup (rate_table), not a formula — VA publishes fixed dollar amounts per
 * (rating %, dependent status), effective Dec 1 each year (COLA).
 * Back pay: applies the historically-correct year's rate to each elapsed month, not a flat current rate —
 * a flat-rate approximation is wrong past ~14 months, which is the common case for claims that drag.
 */

// combined = combined + (100-combined) * (r/100), applied iteratively, ratings sorted descending.
// VA rounds the running combined value to the nearest whole number at each step is NOT correct —
// only the FINAL result is rounded, to the nearest 10 (values ending .5 round up). Table I is the
// authoritative source; ratingsTable.fixtures should be used to verify this function's output.
function combineRatings(ratings) {
  const sorted = ratings.filter(r => r > 0).slice().sort((a, b) => b - a);
  if (sorted.length === 0) return 0;
  let combined = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    combined = combined + (100 - combined) * (sorted[i] / 100);
  }
  return roundToNearestTen(combined);
}

function roundToNearestTen(value) {
  const remainder = value % 10;
  const base = value - remainder;
  return remainder >= 5 ? base + 10 : base;
}

// Bilateral factor (38 CFR §4.26): disabilities affecting paired limbs (both arms, both legs, or
// paired skeletal muscle groups — NOT one arm + one leg) are first combined together via the normal
// combineRatings() step, then that bilateral sub-combined value is increased by 10% of itself
// BEFORE being combined with the veteran's other (non-paired) ratings.
function applyBilateralFactor(bilateralRatings, otherRatings) {
  if (!bilateralRatings || bilateralRatings.length < 2) {
    return combineRatings([...(bilateralRatings || []), ...otherRatings]);
  }
  const bilateralCombined = combineRatings(bilateralRatings);
  const bilateralBumped = bilateralCombined + bilateralCombined * 0.10;
  // The bumped bilateral value is then combined with remaining ratings using the same whole-person method.
  return combineRatings([bilateralBumped, ...otherRatings]);
}

// Rating bucket rounds DOWN to nearest 10 already handled by combineRatings/roundToNearestTen upstream.
// dependents: { status: 'alone'|'spouse_no_children'|'spouse_1_parent'|'spouse_2_parents'|'parent_1'|
//   'parent_2'|'child_1_only'|'child_1_spouse'|'child_1_spouse_1_parent'|'child_1_spouse_2_parents'|
//   'child_1_parent_1'|'child_1_parent_2', extraChildrenUnder18: n, extraChildrenSchool: n, spouseAA: bool }
function lookupMonthlyPay(ratingPct, dependents, rateTable) {
  dependents = dependents || {};
  if (ratingPct < 30) {
    const flat = rateTable.rates_10_20[String(ratingPct)];
    return { monthly: flat || 0, note: 'Ratings below 30% pay a flat rate with no dependent add-on.' };
  }
  const bucket = rateTable.rates_30_100[String(ratingPct)];
  if (!bucket) return { monthly: 0, note: 'No rate found for this rating percentage.' };
  let monthly = bucket[dependents.status] != null ? bucket[dependents.status] : bucket.alone;
  const extraChildren = Number(dependents.extraChildrenUnder18) || 0;
  const extraSchoolChildren = Number(dependents.extraChildrenSchool) || 0;
  monthly += extraChildren * (bucket.additional_child_under_18 || 0);
  monthly += extraSchoolChildren * (bucket.additional_child_over_18_school || 0);
  if (dependents.spouseAA) monthly += (bucket.additional_spouse_aid_attendance || 0);
  return { monthly, note: '' };
}

// VA rate tables cover Dec 1 -> Nov 30, not the calendar year, so the applicable table for a given
// month is picked by comparing dates against each table's effective_date, not by matching year numbers.
function buildRateTimeline(rateHistory, currentRateTable) {
  const entries = Object.values(rateHistory).concat([currentRateTable])
    .map(t => ({ effectiveDate: new Date(t.effective_date), table: t }))
    .sort((a, b) => a.effectiveDate - b.effectiveDate);
  return entries;
}

function tableForMonth(cursor, timeline) {
  let applicable = null;
  for (const entry of timeline) {
    if (entry.effectiveDate <= cursor) applicable = entry.table;
    else break;
  }
  return applicable;
}

// periods: [{ ratingPct, dependents, startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' (or null = today) }]
// rateHistory: { [fileYear]: rateTableForThatPeriod } — each table's own effective_date drives lookup.
function calcBackPay(periods, rateHistory, currentRateTable, currentYear) {
  let total = 0;
  const monthlyBreakdown = [];
  const missingMonths = [];
  const dependentGapYears = new Set();
  const timeline = buildRateTimeline(rateHistory, currentRateTable);

  for (const period of periods) {
    const start = new Date(period.startDate + '-01');
    const end = period.endDate ? new Date(period.endDate + '-01') : new Date();
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    const wantsDependents = period.dependents && period.dependents.status && period.dependents.status !== 'alone';

    while (cursor <= endMonth) {
      const table = tableForMonth(cursor, timeline);
      if (!table) {
        missingMonths.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
      } else {
        const bucket = period.ratingPct >= 30 ? table.rates_30_100[String(period.ratingPct)] : null;
        // Historical files may only have the "alone" rate sourced — flag rather than silently
        // returning the zero-dependent figure for a veteran who has dependents.
        if (wantsDependents && bucket && bucket[period.dependents.status] == null) {
          dependentGapYears.add(new Date(table.effective_date).getFullYear());
        }
        const { monthly } = lookupMonthlyPay(period.ratingPct, period.dependents, table);
        total += monthly;
        monthlyBreakdown.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1, ratingPct: period.ratingPct, monthly });
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }

  const warnings = [];
  if (missingMonths.length) {
    warnings.push(`No sourced rate data for ${missingMonths.join(', ')} — those months are excluded from this total.`);
  }
  if (dependentGapYears.size) {
    warnings.push(`Dependent-status rates aren't fully sourced for the rate period(s) starting ${Array.from(dependentGapYears).join(', ')} — those months use the veteran-alone rate instead, which understates your actual back pay if you had dependents then.`);
  }

  return {
    total,
    months: monthlyBreakdown.length,
    monthlyBreakdown,
    missingMonths,
    dependentGapYears: Array.from(dependentGapYears),
    warning: warnings.join(' ') + (warnings.length ? ' Verify against your VA award letter.' : '')
  };
}

function fmtUSD(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

if (typeof module !== 'undefined') {
  module.exports = { combineRatings, applyBilateralFactor, lookupMonthlyPay, calcBackPay, roundToNearestTen, fmtUSD };
}
