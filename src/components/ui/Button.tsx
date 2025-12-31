"use client";

import React from "react";

type Variant = "primary" | "ghost";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ variant = "ghost", style, ...props }: ButtonProps) {
  const base: React.CSSProperties = {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid var(--stroke)",
    background: "var(--panel2)",
    color: "var(--text)",
    fontWeight: 900,
    cursor: props.disabled ? "not-allowed" : "pointer",
    opacity: props.disabled ? 0.6 : 1,
    transition:
      "transform .15s ease, box-shadow .15s ease, background .15s ease, border-color .15s ease",
  };

  const primary: React.CSSProperties = {
    background: "linear-gradient(90deg, var(--accent2), var(--accent))",
    border: "1px solid rgba(255,255,255,.14)",
    color: "var(--accentText)",
  };

  const ghost: React.CSSProperties = {
    background: "transparent",
  };

  return (
    <button
      {...props}
      style={{
        ...base,
        ...(variant === "primary" ? primary : ghost),
        ...style,
      }}
      onMouseEnter={(e) => {
        props.onMouseEnter?.(e);
        if (props.disabled) return;
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow =
          "0 14px 40px rgba(0,0,0,.25), var(--glow)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,.18)";
      }}
      onMouseLeave={(e) => {
        props.onMouseLeave?.(e);
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "var(--stroke)";
      }}
    />
  );
}
