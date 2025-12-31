"use client";

import React, { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function Card({ children, className, style }: Props) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
