(function () {
  'use strict';

  const page = document.body.dataset.authPage;
  const form = document.querySelector('.auth-form');
  if (!page || !form) return;

  const submitButton = form.querySelector('[data-submit-button]');
  const status = form.querySelector('[data-form-status]');
  const phonePattern = /^1[3-9]\d{9}$/;

  const messages = {
    login: {
      idle: '登录',
      loading: '正在验证账号',
      success: '登录验证通过，正在进入学习中心。'
    },
    register: {
      idle: '创建账号',
      loading: '正在创建账号',
      success: '账号创建完成，可以进入学习中心。'
    }
  };

  function fieldByName(name) {
    return form.elements.namedItem(name);
  }

  function errorElement(name) {
    return document.getElementById(name + '-error');
  }

  function setError(name, message) {
    const input = fieldByName(name);
    const error = errorElement(name);
    if (!input || !error) return;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    error.textContent = message;
  }

  function clearStatus() {
    status.textContent = '';
    status.classList.remove('is-visible');
  }

  function validateField(name) {
    const input = fieldByName(name);
    if (!input) return true;
    const value = input.value.trim();
    let message = '';

    if (name === 'name') {
      if (!value) message = '请输入姓名';
      else if (value.length < 2) message = '姓名至少需要 2 个字符';
    }

    if (name === 'phone') {
      if (!value) message = '请输入手机号';
      else if (!phonePattern.test(value)) message = '请输入有效的 11 位手机号';
    }

    if (name === 'password') {
      if (!value) message = '请输入密码';
      else if (value.length < 6) message = '密码至少需要 6 位字符';
    }

    if (name === 'inviteCode') {
      if (!value) message = '请输入企业邀请码';
      else if (value.length < 4) message = '请检查邀请码是否完整';
    }

    setError(name, message);
    return !message;
  }

  function validateForm() {
    const names = page === 'register'
      ? ['name', 'phone', 'password', 'inviteCode']
      : ['phone', 'password'];
    const results = names.map(validateField);
    const firstInvalid = names.find((name) => fieldByName(name)?.getAttribute('aria-invalid') === 'true');
    if (firstInvalid) fieldByName(firstInvalid).focus();
    return results.every(Boolean);
  }

  form.querySelectorAll('input').forEach((input) => {
    input.addEventListener('input', () => {
      if (input.name === 'phone') input.value = input.value.replace(/\D/g, '').slice(0, 11);
      if (input.name === 'inviteCode') input.value = input.value.replace(/\s/g, '').toUpperCase();
      if (input.getAttribute('aria-invalid') === 'true') validateField(input.name);
      clearStatus();
    });

    input.addEventListener('blur', () => {
      if (input.value.trim()) validateField(input.name);
    });
  });

  form.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.getAttribute('aria-controls'));
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.textContent = reveal ? '隐藏' : '显示';
      button.setAttribute('aria-label', reveal ? '隐藏密码' : '显示密码');
      input.focus();
    });
  });

  const helpButton = form.querySelector('[data-help-action]');
  if (helpButton) {
    helpButton.addEventListener('click', () => {
      status.textContent = '请联系企业培训管理员重置账号密码。';
      status.classList.add('is-visible');
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    clearStatus();
    if (!validateForm()) return;

    submitButton.disabled = true;
    submitButton.textContent = messages[page].loading;
    form.setAttribute('aria-busy', 'true');

    window.setTimeout(() => {
      submitButton.disabled = false;
      submitButton.textContent = messages[page].idle;
      form.setAttribute('aria-busy', 'false');
      status.textContent = messages[page].success;
      status.classList.add('is-visible');
    }, 850);
  });
})();
