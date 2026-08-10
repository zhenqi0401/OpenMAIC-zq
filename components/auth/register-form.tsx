'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
  AuthClientError,
  normalizeInviteCodeInput,
  normalizePhoneInput,
  register,
  validateAuthField,
  validateRegisterValues,
  type AuthFieldErrors,
  type RegisterValues,
} from '@/lib/auth/client';
import { AuthField } from './auth-field';
import { PasswordField } from './password-field';
import { INVITE_CODE_MAX_LENGTH } from '@/lib/auth/invite-code';

const initialValues: RegisterValues = { name: '', phone: '', password: '', inviteCode: '' };

export function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(name: keyof RegisterValues, value: string) {
    const nextValue =
      name === 'phone'
        ? normalizePhoneInput(value)
        : name === 'inviteCode'
          ? normalizeInviteCodeInput(value)
          : value;
    setValues((current) => ({ ...current, [name]: nextValue }));
    setStatus('');
    setErrors((current) =>
      current[name] ? { ...current, [name]: validateAuthField(name, nextValue) } : current,
    );
  }

  function validateOnBlur(name: keyof RegisterValues) {
    if (!values[name]) return;
    const nextError = validateAuthField(name, values[name]);
    if (nextError) setErrors((current) => ({ ...current, [name]: nextError }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus('');

    const nextErrors = validateRegisterValues(values);
    setErrors(nextErrors);
    const order = ['name', 'phone', 'password', 'inviteCode'] as const;
    const firstInvalid = order.find((name) => nextErrors[name]);
    if (firstInvalid) {
      const target = form.elements.namedItem(firstInvalid);
      if (target instanceof HTMLElement) target.focus();
      return;
    }

    setSubmitting(true);
    try {
      await register(values);
      router.replace('/');
      router.refresh();
    } catch (error) {
      const issue =
        error instanceof AuthClientError ? error.issue : { message: '账号创建失败，请稍后重试' };
      if (issue.field) {
        setErrors((current) => ({ ...current, [issue.field!]: issue.message }));
        requestAnimationFrame(() => {
          const target = form.elements.namedItem(issue.field!);
          if (target instanceof HTMLElement) target.focus();
        });
      } else {
        setStatus(issue.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="mx-auto mt-5 grid w-full max-w-[400px] flex-1 content-start gap-3.5 max-[900px]:mt-3"
      onSubmit={submit}
      noValidate
      aria-busy={submitting}
    >
      <div>
        <p className="text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase [@media(max-height:700px)_and_(max-width:900px)]:hidden">
          加入学习空间
        </p>
        <h1 className="mt-1 mb-1.5 text-[29px] leading-tight font-semibold tracking-tight text-foreground">
          注册账号
        </h1>
        <p className="text-sm leading-snug text-muted-foreground [@media(max-height:700px)_and_(max-width:900px)]:hidden">
          填写姓名、手机号、密码与邀请码。
        </p>
      </div>

      <fieldset className="grid min-w-0 gap-3" disabled={submitting}>
        <AuthField
          name="name"
          label="姓名"
          type="text"
          autoComplete="name"
          maxLength={20}
          placeholder="请输入真实姓名"
          value={values.name}
          error={errors.name}
          onChange={(event) => updateField('name', event.target.value)}
          onBlur={() => validateOnBlur('name')}
        />
        <AuthField
          name="phone"
          label="手机号"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={11}
          placeholder="请输入 11 位手机号"
          value={values.phone}
          error={errors.phone}
          onChange={(event) => updateField('phone', event.target.value)}
          onBlur={() => validateOnBlur('phone')}
        />
        <PasswordField
          name="password"
          label="密码"
          autoComplete="new-password"
          placeholder="至少 6 位密码"
          value={values.password}
          error={errors.password}
          onChange={(event) => updateField('password', event.target.value)}
          onBlur={() => validateOnBlur('password')}
        />
        <AuthField
          name="inviteCode"
          label="邀请码"
          type="text"
          autoComplete="off"
          maxLength={INVITE_CODE_MAX_LENGTH}
          placeholder="请输入企业邀请码"
          value={values.inviteCode}
          error={errors.inviteCode}
          onChange={(event) => updateField('inviteCode', event.target.value)}
          onBlur={() => validateOnBlur('inviteCode')}
        />
      </fieldset>

      <Button type="submit" className="mt-0.5 h-12 rounded-xl text-[15px] font-semibold" disabled={submitting}>
        {submitting ? '正在创建账号' : '创建账号'}
      </Button>
      <p
        className="text-center text-[13px] leading-snug text-destructive empty:hidden"
        role="status"
        aria-live="polite"
        data-state="error"
      >
        {status}
      </p>
      <p className="text-center text-[13px] text-muted-foreground">
        已有账号？{' '}
        <Link href="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
          直接登录
        </Link>
      </p>
    </form>
  );
}
