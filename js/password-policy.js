(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.LocalCoKitchenPasswordPolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const passwordRules = {
    length: (value) => value.length >= 10,
    lowercase: (value) => /[a-z]/.test(value),
    uppercase: (value) => /[A-Z]/.test(value),
    digit: (value) => /\d/.test(value),
    symbol: (value) => /[^A-Za-z0-9]/.test(value),
  };

  const validatePassword = (password, confirm) => {
    const normalizedPassword = String(password || "");
    const normalizedConfirm = String(confirm || "");
    const rules = Object.entries(passwordRules).reduce(
      (results, [rule, test]) => ({
        ...results,
        [rule]: test(normalizedPassword),
      }),
      {}
    );
    const allRulesMet = Object.values(rules).every(Boolean);
    const passwordsMatch =
      normalizedPassword.length > 0 && normalizedPassword === normalizedConfirm;

    return {
      allRulesMet,
      isValid: allRulesMet && passwordsMatch,
      passwordsMatch,
      rules,
    };
  };

  return {
    passwordRules,
    validatePassword,
  };
});
