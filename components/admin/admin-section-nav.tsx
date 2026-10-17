type AdminSection = 'add' | 'records' | 'publish' | 'history' | 'calendar';

const sections: { key: AdminSection; href: string; label: string }[] = [
  { key: 'add', href: '/admin', label: '新增唱片' },
  { key: 'records', href: '/admin/records', label: '管理唱片' },
  { key: 'publish', href: '/admin/batch-publish', label: '批次上架' },
  { key: 'history', href: '/admin/history', label: '上架紀錄' },
  { key: 'calendar', href: '/admin/calendar', label: '上架日曆' },
];

export function AdminSectionNav({ current }: { current: AdminSection }) {
  return (
    <nav aria-label="唱片管理功能" className="admin-section-nav">
      <div className="admin-shell">
        {sections.map((section) => (
          <a
            aria-current={current === section.key ? 'page' : undefined}
            href={section.href}
            key={section.key}
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
