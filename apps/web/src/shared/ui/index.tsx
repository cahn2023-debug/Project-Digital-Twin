import type { ReactNode } from "react";
import type { IconName, Tone } from "../types";

export function Panel({
  action,
  children,
  className = "",
  subtitle,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <section className={"panel " + className}>
      <div className="panel-head">
        <div>
          <div className="panel-title">{title}</div>
          {subtitle ? <div className="panel-sub">{subtitle}</div> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function KpiCard({
  icon,
  label,
  value,
  foot,
}: {
  icon: IconName;
  label: string;
  value: string;
  foot: ReactNode;
}) {
  return (
    <article className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon">
          <Icon name={icon} size={15} />
        </span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-foot">{foot}</div>
    </article>
  );
}

export function PageHeader({
  actions,
  subtitle,
  title,
  status,
  tone,
}: {
  actions: ReactNode;
  subtitle: string;
  title: string;
  status: string;
  tone: Tone;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="title-row">
          <h1>{title}</h1>
          <StatusBadge tone={tone}>{status}</StatusBadge>
        </div>
        <div className="page-subtitle">{subtitle}</div>
      </div>
      <div className="page-actions">{actions}</div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  primary = false,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  title?: string;
}) {
  return (
    <button
      className={"btn" + (primary ? " primary" : "")}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

export function AlertList({
  items,
}: {
  items: Array<{ title: string; meta: string; tone: Tone; icon?: IconName }>;
}) {
  return (
    <div className="panel-body alert-list">
      {items.map((item) => (
        <div className="alert-item" key={item.title}>
          <div className={"alert-icon " + item.tone}>
            <Icon name={item.icon ?? "alert"} size={14} />
          </div>
          <div>
            <div className="alert-title">{item.title}</div>
            <div className="alert-meta">{item.meta}</div>
          </div>
        </div>
      ))}
    </div>
  );
}


const iconPaths: Record<IconName, ReactNode> = {
  alert: (
    <>
      <path
        d="M12 3 2.5 20h19L12 3Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M12 9v5M12 17.5v.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </>
  ),
  bell: (
    <>
      <path
        d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M10 20h4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </>
  ),
  box: (
    <>
      <path
        d="m4 7 8-4 8 4-8 4-8-4Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M4 7v10l8 4 8-4V7M12 11v10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  camera: (
    <>
      <path
        d="M4 8h4l1.5-2h5L16 8h4v11H4V8Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <circle
        cx="12"
        cy="13"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  chart: (
    <path
      d="M4 20V10M10 20V4M16 20v-7M22 20H2"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.7"
    />
  ),
  check: (
    <path
      d="m5 12 4 4L19 6"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    />
  ),
  chevron: (
    <path
      d="m7 10 5 5 5-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  ),
  db: (
    <>
      <ellipse
        cx="12"
        cy="5"
        rx="8"
        ry="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  edit: (
    <>
      <path
        d="M4 20h4L19 9l-4-4L4 16v4Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="m13 7 4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  eye: (
    <>
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle
        cx="12"
        cy="12"
        r="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  file: (
    <>
      <path
        d="M6 2.5h8l4 4V21H6V2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M14 2.5v4h4M9 12h6M9 16h6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </>
  ),
  filter: (
    <path
      d="M3 5h18l-7 8v6l-4-2v-4L3 5Z"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  ),
  folder: (
    <path
      d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h8A1.5 1.5 0 0 1 20 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3 18.5v-12Z"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.7"
    />
  ),
  git: (
    <>
      <circle
        cx="6"
        cy="5"
        r="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle
        cx="18"
        cy="7"
        r="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle
        cx="6"
        cy="19"
        r="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M6 7v10M8 9c4 0 3-2 8-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  grid: (
    <>
      <rect
        x="3"
        y="3"
        width="7"
        height="7"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="7"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <rect
        x="3"
        y="14"
        width="7"
        height="7"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <rect
        x="14"
        y="14"
        width="7"
        height="7"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  map: (
    <>
      <path
        d="m3 6 5-2 8 3 5-2v13l-5 2-8-3-5 2V6Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M8 4v13M16 7v13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </>
  ),
  menu: (
    <path
      d="M4 6h16M4 12h16M4 18h16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
    />
  ),
  mobile: (
    <>
      <rect
        x="7"
        y="2.5"
        width="10"
        height="19"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M10 5h4M11 18.5h2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </>
  ),
  moon: (
    <path
      d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    />
  ),
  plus: (
    <path
      d="M12 5v14M5 12h14"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
    />
  ),
  refresh: (
    <>
      <path
        d="M20 7v5h-5M4 17v-5h5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
      <path
        d="M18 12a6 6 0 0 0-10.4-4M6 12a6 6 0 0 0 10.4 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </>
  ),
  search: (
    <>
      <circle
        cx="11"
        cy="11"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m16 16 4 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </>
  ),
  sun: (
    <>
      <circle
        cx="12"
        cy="12"
        r="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </>
  ),
  users: (
    <>
      <circle
        cx="9"
        cy="8"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M3.5 20c0-4 2.2-6 5.5-6s5.5 2 5.5 6M15 5.5c2 0 3.5 1.5 3.5 3.5S17 12.5 15 12.5M16 15c2.8.3 4.5 2 4.5 5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </>
  ),
  x: (
    <path
      d="M18 6 6 18M6 6l12 12"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="1.8"
    />
  ),
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {iconPaths[name]}
    </svg>
  );
}

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={"status " + tone}>{children}</span>;
}


