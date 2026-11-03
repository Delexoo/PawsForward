/**
 * Behavior that matters: attributed donations owe 25%.
 * Run: node tests/commission.test.mjs
 */

const COMMISSION_RATE = 0.25;

function amountOwed(donations, employeeId) {
  const raised = donations
    .filter((d) => d.employee_id === employeeId)
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);
  return raised * COMMISSION_RATE;
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

assertEqual(amountOwed(donations, steve), 16.25, "Steve owed 25% of 65");
assertEqual(amountOwed(donations, mia), 25, "Mia owed 25% of 100");
assertEqual(amountOwed(donations, "nobody"), 0, "Unknown employee owed 0");

console.log("commission.test.mjs: all passed");
