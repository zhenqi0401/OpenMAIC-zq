import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import '@openmaic/renderer/fonts.css';
import 'animate.css';
import 'katex/dist/katex.min.css';
import { ThemeProvider } from '@/lib/hooks/use-theme';
import { I18nProvider } from '@/lib/hooks/use-i18n';
import { Toaster } from '@/components/ui/sonner';
import { ServerProvidersInit } from '@/components/server-providers-init';
import { AuthSessionGuard } from '@/components/auth/auth-session-guard';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { AntdProvider } from '@/components/providers/antd-provider';

const inter = localFont({
  src: '../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-sans',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: '元我智脑',
  description: '元我智脑企业智能学习平台，提供 AI 课程生成、企业学习、测评与阶段考核。',
  icons: {
    icon: [
      { url: '/brand/yuanwo-mark.png', type: 'image/png', sizes: '512x512' },
      { url: '/brand/yuanwo-icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/brand/yuanwo-apple-touch-icon.png', sizes: '180x180' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={inter.variable} suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AntdRegistry>
          <ThemeProvider>
            <AntdProvider>
              <I18nProvider>
                <ServerProvidersInit />
                <AuthSessionGuard>{children}</AuthSessionGuard>
                <Toaster position="top-center" />
              </I18nProvider>
            </AntdProvider>
          </ThemeProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
