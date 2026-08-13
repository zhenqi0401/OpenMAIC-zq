'use client';

import { CheckOutlined } from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import { useI18n } from '@/lib/hooks/use-i18n';
import { supportedLocales, type Locale } from '@/lib/i18n';

interface LanguageSwitcherProps {
  /** Called when the dropdown opens, so parent can close sibling dropdowns. */
  onOpen?: () => void;
}

/**
 * Locale picker backed by antd Dropdown. The trigger keeps the compact locale
 * code (CN/TW/EN) so it matches sibling circular icon controls.
 */
export function LanguageSwitcher({ onOpen }: LanguageSwitcherProps) {
  const { locale, setLocale } = useI18n();

  const items = supportedLocales.map((l) => ({
    key: l.code,
    label: (
      <span className="flex items-center gap-2">
        {l.label}
        {locale === l.code ? <CheckOutlined /> : null}
      </span>
    ),
  }));

  return (
    <Dropdown
      menu={{
        items,
        selectedKeys: [locale],
        onClick: ({ key }) => setLocale(key as Locale),
      }}
      placement="bottomRight"
      onOpenChange={(open) => {
        if (open) onOpen?.();
      }}
    >
      <Button type="text" shape="circle" aria-label="语言设置">
        {supportedLocales.find((l) => l.code === locale)?.shortLabel ?? locale}
      </Button>
    </Dropdown>
  );
}
