export const required = (value, label) =>
  !value || (typeof value === "string" && !value.trim())
    ? `${label} is required`
    : null;

export const minLength = (min) => (value, label) =>
  value && value.length < min
    ? `${label} must be at least ${min} characters`
    : null;

export const maxLength = (max) => (value, label) =>
  value && value.length > max
    ? `${label} must be at most ${max} characters`
    : null;

export const isEmail = (value, label) =>
  value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? `${label} is not a valid email`
    : null;

export const isPhone = (value, label) =>
  value && !/^[\d\s\-+()]{7,20}$/.test(value)
    ? `${label} is not a valid phone number`
    : null;

export const isNumber = (value, label) =>
  value !== "" && value !== null && value !== undefined && isNaN(Number(value))
    ? `${label} must be a number`
    : null;

export const minValue = (min) => (value, label) =>
  value !== "" && value !== null && Number(value) < min
    ? `${label} must be at least ${min}`
    : null;

export const combine = (...validators) => (value, label) => {
  for (const fn of validators) {
    const err = fn(value, label);
    if (err) return err;
  }
  return null;
};

export const validateField = (value, rules, label) => {
  if (!rules || rules.length === 0) return null;
  return combine(...rules)(value, label);
};

export const validateForm = (fields) => {
  const errors = {};
  let isValid = true;
  Object.entries(fields).forEach(([key, { value, rules, label }]) => {
    const err = validateField(value, rules, label);
    if (err) {
      errors[key] = err;
      isValid = false;
    }
  });
  return { errors, isValid };
};
