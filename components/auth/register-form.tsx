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
import styles from './auth-page.module.css';
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
    <form className={styles.authForm} onSubmit={submit} noValidate aria-busy={submitting}>
      <div className={styles.formHeading}>
        <p className={styles.formKicker}>加入学习空间</p>
        <h1>注册账号</h1>
        <p>填写姓名、手机号、密码与邀请码。</p>
      </div>

      <fieldset className={styles.fields} disabled={submitting}>
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

      <Button type="submit" className={styles.primaryButton} disabled={submitting}>
        {submitting ? '正在创建账号' : '创建账号'}
      </Button>
      <p className={styles.formStatus} role="status" aria-live="polite" data-state="error">
        {status}
      </p>
      <p className={styles.switchLine}>
        已有账号？ <Link href="/login">直接登录</Link>
      </p>
    </form>
  );
}
