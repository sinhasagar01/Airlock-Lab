import type { ReactNode } from "react";
import { primaryNavigation, type NavigationSection } from "@ai-dev/core";
import {
  Icon,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
  type IconName,
} from "@ai-dev/ui";
import { navigationIcons } from "../lib/appData";

type AppShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
  workspaceClassName?: string;
};

export function AppShell({
  sidebar,
  children,
  workspaceClassName = "",
}: AppShellProps) {
  return (
    <main className="app-shell">
      {sidebar}
      <section className={`workspace ${workspaceClassName}`.trim()}>
        {children}
      </section>
    </main>
  );
}

type SidebarProps = {
  activeSection: NavigationSection;
  pendingApprovalCount: number;
  onSelectSection: (section: NavigationSection) => void;
};

export function Sidebar({
  activeSection,
  pendingApprovalCount,
  onSelectSection,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <span className="product-mark">AIR</span>
        <div className="brand">Airlock</div>
      </div>

      <nav aria-label="Primary navigation" className="sidebar-nav">
        {primaryNavigation.map((item) => (
          <SidebarNavItem
            count={item.id === "approvals" ? pendingApprovalCount : 0}
            icon={navigationIcons[item.id]}
            isActive={activeSection === item.id}
            key={item.id}
            label={item.label}
            onClick={() => onSelectSection(item.id)}
          />
        ))}
      </nav>

      <div className="sidebar-user" aria-label="Current user">
        <span className="sidebar-user__avatar" aria-hidden="true">
          S
        </span>
        <div>
          <strong>Sagar</strong>
          <span>Admin</span>
        </div>
        <Icon name="chevron" size="sm" />
      </div>
    </aside>
  );
}

type SidebarNavItemProps = {
  count?: number;
  icon: IconName;
  isActive: boolean;
  label: string;
  onClick: () => void;
};

function SidebarNavItem({
  count = 0,
  icon,
  isActive,
  label,
  onClick,
}: SidebarNavItemProps) {
  return (
    <button
      aria-current={isActive ? "page" : undefined}
      aria-label={label}
      className="sidebar-nav-item"
      onClick={onClick}
      type="button"
    >
      <Icon name={icon} />
      <span>{label}</span>
      {count > 0 ? <span className="nav-count">{count}</span> : null}
    </button>
  );
}

type AppHeaderProps = {
  compact?: boolean;
  description: string;
  eyebrow: string;
  pendingApprovalCount: number;
  providerName: string;
  title: string;
  onChooseRepository: () => void;
};

export function AppHeader({
  compact = false,
  description,
  eyebrow,
  pendingApprovalCount,
  providerName,
  title,
  onChooseRepository,
}: AppHeaderProps) {
  return (
    <header className={`app-header${compact ? " app-header--compact" : ""}`}>
      <div className="app-header__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="hero-copy">{description}</p>
      </div>
      <div className="app-header__actions">
        <div className="status-row">
          <StatusPill tone="success">Provider: {providerName}</StatusPill>
          <StatusPill tone="warning">
            Pending approvals: {pendingApprovalCount}
          </StatusPill>
        </div>
        <PrimaryButton icon="repository" onClick={onChooseRepository}>
          Choose repository
        </PrimaryButton>
      </div>
    </header>
  );
}
