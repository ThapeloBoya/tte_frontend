import React, { useState } from "react";
import Tooltip from "./Tooltip";

const helpIcons = {
  email: "Enter a valid email address (e.g. user@example.com)",
  phone: "International format accepted (e.g. +27 12 345 6789)",
  password: "At least 8 characters with 1 letter and 1 number",
  license: "Driver's license number",
  registration: "Vehicle registration number (e.g. CA 123-456)",
  sku: "Stock keeping unit code",
  amount: "Monetary value in ZAR (R)",
  date: "Select a date from the picker",
  notes: "Optional notes or comments",
  address: "Full physical address including city and postal code",
  cargo: "Type of cargo being transported",
  customerRef: "Your customer's reference number for this load",
  capacity: "Maximum load capacity in kg",
};

const helpLabels = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  password: "Password",
  address: "Address",
  notes: "Notes",
  licenseNumber: "License Number",
  registrationNumber: "Registration Number",
  capacity: "Capacity",
  cargoType: "Cargo Type",
  customerRef: "Customer Ref",
  amount: "Amount",
  date: "Date",
  sku: "SKU",
};

const FormField = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  touched,
  required,
  placeholder,
  helpKey,
  children,
  disabled,
  min,
  max,
  step,
  accept,
  options,
  className,
}) => {
  const [focused, setFocused] = useState(false);
  const showError = touched && error;
  const helpText = helpKey && (helpIcons[helpKey] || null);

  const handleBlur = (e) => {
    setFocused(false);
    if (onBlur) onBlur(e);
  };

  const inputId = `field-${name}`;
  const errorId = `error-${name}`;

  const baseStyle = {
    width: "100%",
    padding: "9px 11px",
    border: showError ? "1.5px solid #dc2626" : focused ? "1.5px solid #0f766e" : "1px solid #cbd5e1",
    borderRadius: 8,
    background: disabled ? "#f1f5f9" : "#fff",
    color: "#172033",
    boxSizing: "border-box",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.15s ease",
    minHeight: 40,
  };

  const renderInput = () => {
    if (type === "select") {
      return (
        <select
          id={inputId}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          style={baseStyle}
          aria-invalid={showError ? "true" : undefined}
          aria-describedby={showError ? errorId : helpText ? `help-${name}` : undefined}
        >
          {children || options}
        </select>
      );
    }

    if (type === "textarea") {
      return (
        <textarea
          id={inputId}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          rows={min || 2}
          style={{ ...baseStyle, resize: "vertical" }}
          aria-invalid={showError ? "true" : undefined}
          aria-describedby={showError ? errorId : helpText ? `help-${name}` : undefined}
        />
      );
    }

    return (
      <input
        id={inputId}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        accept={accept}
        style={baseStyle}
        aria-invalid={showError ? "true" : undefined}
        aria-describedby={showError ? errorId : helpText ? `help-${name}` : undefined}
      />
    );
  };

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && (
        <label htmlFor={inputId} style={{ fontWeight: 600, fontSize: 13, color: "#475569", display: "flex", alignItems: "center", gap: 4 }}>
          {label}
          {required && <span style={{ color: "#dc2626" }}>*</span>}
          {helpText && (
            <Tooltip text={helpText} position="top">
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", background: "#e2e8f0", color: "#64748b", fontSize: 10, fontWeight: 700, lineHeight: 1 }}>?</span>
            </Tooltip>
          )}
        </label>
      )}
      {renderInput()}
      {helpText && !showError && (
        <span id={`help-${name}`} style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.3 }}>
          {helpText}
        </span>
      )}
      {showError && (
        <span id={errorId} role="alert" style={{ fontSize: 12, color: "#dc2626", fontWeight: 600, lineHeight: 1.3 }}>
          {error}
        </span>
      )}
    </div>
  );
};

export { helpLabels };
export default FormField;
