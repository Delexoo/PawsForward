/**
 * Behavior that matters: attributed donations owe 25%, minus recorded payouts.
 * Run: node tests/commission.test.mjs
 */

const COMMISSION_RATE = 0.25;

function amountOwed(donations, payouts, employeeId) {
  const raised = donations
    .filter((d) => d.employee_id === employeeId)
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const paid = (payouts || [])
    .filter((p) => p.employee_id === employeeId)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  return Math.max(0, raised * COMMISSION_RATE - paid);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

const steve = "emp-steve";
const mia = "emp-mia";
const donations = [
  { employee_id: steve, amount: 40 },
  { employee_id: steve, amount: 25 },
  { employee_id: mia, amount: 100 },
  { employee_id: null, amount: 10 },
];
const payouts = [
  { employee_id: steve, amount: 10 },
  { employee_id: mia, amount: 25 },
];

assertEqual(amountOwed(donations, [], steve), 16.25, "Steve owed 25% of 65");
assertEqual(amountOwed(donations, [], mia), 25, "Mia owed 25% of 100");
assertEqual(amountOwed(donations, [], "nobody"), 0, "Unknown employee owed 0");
assertEqual(amountOwed(donations, payouts, steve), 6.25, "Steve owed drops after $10 payout");
assertEqual(amountOwed(donations, payouts, mia), 0, "Mia fully paid");

console.log("commission.test.mjs: all passed");
