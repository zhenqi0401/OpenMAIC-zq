import { ChevronRight, Home } from 'lucide-react';
import { adminModules, type AdminModuleId } from '@/components/admin/admin-navigation';

export interface AdminBreadcrumbItem {
  label: string;
  href?: string;
}

/** Ant Design Pro 风格的面包屑：首页 / 管理后台 / 当前模块。 */
export function AdminBreadcrumbs({ activeModuleId }: { activeModuleId: AdminModuleId }) {
  const adminModule = adminModules.find((item) => item.id === activeModuleId);
  const items: AdminBreadcrumbItem[] = [
    { label: '首页', href: '/' },
    { label: '管理后台', href: '/admin' },
    ...(adminModule ? [{ label: adminModule.label }] : []),
  ];

  return (
    <nav aria-label="面包屑" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {items.map((item, index) => {
          const current = index === items.length - 1;
          return (
            <li className="flex min-w-0 items-center gap-1.5" key={`${item.label}-${index}`}>
              {index === 0 ? (
                <Home aria-hidden="true" className="size-4 shrink-0 text-[var(--admin-muted-foreground)]" />
              ) : null}
              {item.href && !current ? (
                <a
                  className="shrink-0 whitespace-nowrap rounded-[2px] text-[var(--admin-muted-foreground)] transition-colors hover:text-[var(--admin-link-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-focus-ring)]/30"
                  href={item.href}
                >
                  {item.label}
                </a>
              ) : (
                <span
                  aria-current={current ? 'page' : undefined}
                  className={current ? 'truncate font-medium text-[var(--admin-foreground)]' : 'shrink-0 text-[var(--admin-muted-foreground)]'}
                >
                  {item.label}
                </span>
              )}
              {!current ? (
                <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-[var(--admin-disabled-foreground)]" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
