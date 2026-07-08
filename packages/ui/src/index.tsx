import type { ButtonHTMLAttributes, ReactNode } from "react";
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CirclePlay,
  Copy,
  Database,
  FileText,
  Folder,
  FolderGit2,
  GitBranch,
  GitPullRequestArrow,
  Grid2X2,
  LayoutDashboard,
  Search,
  Settings,
  UserCircle2,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type IconName =
  | "activity"
  | "agent"
  | "approval"
  | "branch"
  | "changes"
  | "chevron"
  | "copy"
  | "database"
  | "file"
  | "folder"
  | "grid"
  | "index"
  | "play"
  | "repository"
  | "search"
  | "settings"
  | "spark"
  | "user";

type IconProps = {
  name: IconName;
  size?: "sm" | "md" | "lg";
};

export function Icon({ name, size = "md" }: IconProps) {
  const LucideIcon = iconComponents[name];

  return (
    <span
      aria-hidden="true"
      className={`app-icon app-icon--${name} app-icon--${size}`}
    >
      <LucideIcon aria-hidden="true" focusable="false" strokeWidth={2.15} />
    </span>
  );
}

const iconComponents: Record<IconName, LucideIcon> = {
  activity: LayoutDashboard,
  agent: Bot,
  approval: CheckCircle2,
  branch: GitBranch,
  changes: GitPullRequestArrow,
  chevron: ChevronRight,
  copy: Copy,
  database: Database,
  file: FileText,
  folder: Folder,
  grid: Grid2X2,
  index: BrainCircuit,
  play: CirclePlay,
  repository: FolderGit2,
  search: Search,
  settings: Settings,
  spark: Zap,
  user: UserCircle2,
};

export type Tone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "accent"
  | "agent"
  | "context";

type StatusPillProps = {
  children: ReactNode;
  tone?: Tone;
  size?: "sm" | "md";
  showDot?: boolean;
};

export function StatusPill({
  children,
  tone = "neutral",
  size = "md",
  showDot = true,
}: StatusPillProps) {
  return (
    <span
      className={`status-pill status-pill--${tone} status-pill--${size}${
        showDot ? "" : " status-pill--no-dot"
      }`}
    >
      {children}
    </span>
  );
}

export function StatusBadge(props: StatusPillProps) {
  return <StatusPill {...props} />;
}

type IconBadgeProps = {
  icon: IconName;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
};

export function IconBadge({ icon, tone = "accent", size = "md" }: IconBadgeProps) {
  return (
    <span className={`icon-badge icon-badge--${tone} icon-badge--${size}`}>
      <Icon name={icon} size={size === "lg" ? "lg" : "md"} />
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: IconName;
};

export function PrimaryButton({
  children,
  className = "",
  icon,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button className={`primary-action ${className}`.trim()} type={type} {...props}>
      {icon ? <Icon name={icon} size="sm" /> : null}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className = "",
  icon,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`secondary-action ${className}`.trim()}
      type={type}
      {...props}
    >
      {icon ? <Icon name={icon} size="sm" /> : null}
      {children}
    </button>
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
  icon?: IconName;
  tone?: Tone;
};

export function SummaryCard({
  label,
  value,
  detail,
  icon,
  tone = "accent",
}: StatTileProps) {
  return (
    <article className="summary-card">
      {icon ? (
        <IconBadge icon={icon} tone={tone} size="lg" />
      ) : null}
      <span className="summary-card__label">{label}</span>
      <strong>{value}</strong>
      <span className="summary-card__detail">{detail}</span>
      <span className="summary-card__chevron" aria-hidden="true">
        <Icon name="chevron" size="sm" />
      </span>
    </article>
  );
}

export function StatTile(props: StatTileProps) {
  return <SummaryCard {...props} />;
}

type DashboardCardProps = {
  children: ReactNode;
  className?: string;
};

export function DashboardCard({ children, className = "" }: DashboardCardProps) {
  return <article className={`dashboard-card ${className}`.trim()}>{children}</article>;
}
