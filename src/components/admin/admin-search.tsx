"use client";

import { Search } from "lucide-react";

export function AdminSearch({
  value,
  onChange,
  placeholder,
  count,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  count?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <label className="datta-search min-w-[220px] flex-1">
        <Search aria-hidden />
        <input
          type="search"
          className="datta-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          spellCheck={false}
        />
      </label>
      {count ? <span className="datta-pill datta-pill-muted">{count}</span> : null}
    </div>
  );
}
