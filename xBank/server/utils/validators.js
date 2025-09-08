// server/utils/validators.js
function isNonEmptyString(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

function isEmail(s) {
  if (!isNonEmptyString(s)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function isPhone(s) {
  if (!isNonEmptyString(s)) return false;
  return /^[\d+\-\s()]{6,20}$/.test(s.trim());
}

function isPassword(s) {
  if (!isNonEmptyString(s)) return false;
  return s.length >= 8;
}

module.exports = { isNonEmptyString, isEmail, isPhone, isPassword };
