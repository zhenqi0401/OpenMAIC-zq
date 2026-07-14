'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import {
  AuthClientError,
  login,
  normalizePhoneInput,
  validateAuthField,
  validateLoginValues,
  type AuthFieldErrors,
  type LoginValues,
} from '@/lib/auth/client';
import { AuthField } from './auth-field';
import { PasswordField } from './password-field';
import styles from './auth-page.module.css';

const initialValues: LoginValues = { phone: '', password: '' };

export function LoginForm() {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(name: keyof LoginValues, value: string) {
    const nextValue = name === 'phone' ? normalizePhoneInput(value) : value;
    setValues((current) => ({ ...current, [name]: nextValue }));
    setStatus('');
    setErrors((current) =>
      current[name] ? { ...current, [name]: validateAuthField(name, nextValue) } : current,
    );
  }

  function validateOnBlur(name: keyof LoginValues) {
    if (!values[name]) return;
    const nextError = validateAuthField(name, values[name]);
    if (nextError) setErrors((current) => ({ ...current, [name]: nextError }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus('');

    const nextErrors = validateLoginValues(values);
    setErrors(nextErrors);
    const firstInvalid = (['phone', 'password'] as const).find((name) => nextErrors[name]);
    if (firstInvalid) {
      const target = form.elements.namedItem(firstInvalid);
      if (target instanceof HTMLElement) target.focus();
      return;
    }

    setSubmitting(true);
    try {
      await login(values);
      router.replace('/');
      router.refresh();
    } catch (error) {
      const issue =
        error instanceof AuthClientError ? error.issue : { message: '登录失败，请稍后重试' };
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
        <p className={styles.formKicker}>继续学习</p>
        <h1>欢迎回来</h1>
        <p>使用手机号和密码进入学习中心。</p>
      </div>

      <fieldset className={styles.fields} disabled={submitting}>
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
          autoComplete="current-password"
          placeholder="请输入密码"
          value={values.password}
          error={errors.password}
          onChange={(event) => updateField('password', event.target.value)}
          onBlur={() => validateOnBlur('password')}
        />
      </fieldset>

      <div className={styles.formOptions}>
        <span>企业员工账号</span>
        <button type="button" onClick={() => setStatus('请联系企业培训管理员重置账号密码。')}>
          无法登录？
        </button>
      </div>

      <Button type="submit" className={styles.primaryButton} disabled={submitting}>
        {submitting ? '正在验证账号' : '登录'}
      </Button>
      <p className={styles.formStatus} role="status" aria-live="polite" data-state="error">
        {status}
      </p>
      <p className={styles.switchLine}>
        首次使用？ <Link href="/register">创建员工账号</Link>
      </p>
    </form>
  );
}
