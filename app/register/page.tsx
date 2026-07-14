import type { Metadata } from 'next';

import { AuthLayout } from '@/components/auth/auth-layout';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = {
  title: '创建账号 | 企业培训平台',
};

export default function RegisterPage() {
  return (
    <AuthLayout mode="register">
      <RegisterForm />
    </AuthLayout>
  );
}
