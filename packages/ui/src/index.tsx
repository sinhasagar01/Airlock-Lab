import type { ReactNode } from "react";

type StatusBadgeTone = "neutral" | "success" | "warning" | "danger";

type StatusBadgeProps = {
  children: ReactNode;
  tone?: StatusBadgeTone;
};

const toneStyles: Record<
  StatusBadgeTone,
  { background: string; color: string }
> = {
  neutral: { background: "#eef2f6", color: "#344054" },
  success: { background: "#e8f6ef", color: "#087443" },
  warning: { background: "#fff4df", color: "#915930" },
  danger: { background: "#ffe8e8", color: "#b42318" },
};

export function StatusBadge({ children, tone = "neutral" }: StatusBadgeProps) {
  const style = toneStyles[tone];

  return (
    <span
      style={{
        ...style,
        borderRadius: 999,
        display: "inline-flex",
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        padding: "7px 9px",
      }}
    >
      {children}
    </span>
  );
}

type EmptyStateProps = {
  title: string;
  children: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, children, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__mark" aria-hidden="true">
        +
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}

type StatTileProps = {
  label: string;
  value: string | number;
  detail: string;
};

export function StatTile({ label, value, detail }: StatTileProps) {
  return (
    <div className="stat-tile">
      <span className="stat-tile__label">{label}</span>
      <strong>{value}</strong>
      <span className="stat-tile__detail">{detail}</span>
    </div>
  );
}
