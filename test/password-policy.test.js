const test = require("node:test");
const assert = require("node:assert/strict");

const { validatePassword } = require("../js/password-policy");

test("validates a password that satisfies every rule and matches confirmation", () => {
  const result = validatePassword("StrongPass1!", "StrongPass1!");

  assert.equal(result.isValid, true);
  assert.equal(result.allRulesMet, true);
  assert.equal(result.passwordsMatch, true);
  assert.deepEqual(result.rules, {
    length: true,
    lowercase: true,
    uppercase: true,
    digit: true,
    symbol: true,
  });
});

test("rejects passwords shorter than 10 characters", () => {
  const result = validatePassword("Short1!", "Short1!");

  assert.equal(result.isValid, false);
  assert.equal(result.rules.length, false);
});

test("rejects passwords missing a lowercase letter", () => {
  const result = validatePassword("STRONGPASS1!", "STRONGPASS1!");

  assert.equal(result.isValid, false);
  assert.equal(result.rules.lowercase, false);
});

test("rejects passwords missing an uppercase letter", () => {
  const result = validatePassword("strongpass1!", "strongpass1!");

  assert.equal(result.isValid, false);
  assert.equal(result.rules.uppercase, false);
});

test("rejects passwords missing a digit", () => {
  const result = validatePassword("StrongPass!", "StrongPass!");

  assert.equal(result.isValid, false);
  assert.equal(result.rules.digit, false);
});

test("rejects passwords missing a symbol", () => {
  const result = validatePassword("StrongPass1", "StrongPass1");

  assert.equal(result.isValid, false);
  assert.equal(result.rules.symbol, false);
});

test("rejects otherwise valid passwords when confirmation does not match", () => {
  const result = validatePassword("StrongPass1!", "StrongPass2!");

  assert.equal(result.isValid, false);
  assert.equal(result.allRulesMet, true);
  assert.equal(result.passwordsMatch, false);
});

test("normalizes missing password inputs to invalid values", () => {
  const result = validatePassword(undefined, undefined);

  assert.equal(result.isValid, false);
  assert.equal(result.allRulesMet, false);
  assert.equal(result.passwordsMatch, false);
});
