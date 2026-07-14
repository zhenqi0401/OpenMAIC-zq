(() => {
  'use strict';

  const courses = [
    {
      id: 'enterprise-safety',
      name: '门店安全操作与突发事件应对',
      source: 'enterprise',
      scenes: 18,
      updated: '今天更新',
      code: 'SAFE / 04',
      number: '01',
      visual: 'safety',
    },
    {
      id: 'enterprise-service',
      name: '高峰时段顾客服务标准',
      source: 'enterprise',
      scenes: 12,
      updated: '7 月 9 日更新',
      code: 'SERVICE / 02',
      number: '02',
      visual: 'service',
    },
    {
      id: 'enterprise-quality',
      name: '商品陈列与质量巡检',
      source: 'enterprise',
      scenes: 15,
      updated: '7 月 7 日更新',
      code: 'QUALITY / 07',
      number: '03',
      visual: 'quality',
    },
    {
      id: 'enterprise-data',
      name: '门店经营数据基础',
      source: 'enterprise',
      scenes: 10,
      updated: '7 月 4 日更新',
      code: 'DATA / 01',
      number: '04',
      visual: 'data',
    },
    {
      id: 'local-onboarding',
      name: '新员工值班手册',
      source: 'local',
      scenes: 9,
      updated: '本机 · 7 月 8 日',
      code: 'LOCAL / ZIP',
      number: 'L1',
      visual: 'local',
    },
    {
      id: 'local-training',
      name: '服务话术练习课',
      source: 'local',
      scenes: 7,
      updated: '本机 · 7 月 3 日',
      code: 'LOCAL / ZIP',
      number: 'L2',
      visual: 'import',
    },
  ];

  const questions = [
    {
      text: '发现卖场地面有积水时，第一步应如何处理？',
      options: ['等待保洁人员巡场', '立即设置警示并安排清理', '先拍照发到工作群', '只提醒经过的顾客'],
      answer: 1,
    },
    {
      text: '高峰时段顾客排队较长，员工最合适的做法是？',
      options: ['停止补货，全员离岗', '让顾客自行选择其他门店', '及时增开服务点并主动说明', '关闭入口控制客流'],
      answer: 2,
    },
    {
      text: '交接班时，以下哪项信息必须当面确认？',
      options: ['同事的休假计划', '未处理异常与重点设备状态', '当日天气情况', '个人学习笔记'],
      answer: 1,
    },
    {
      text: '设备出现异常声响但仍可运行时，应如何处理？',
      options: ['继续使用到下班', '自行拆机检查', '停用、标识并按流程报修', '降低速度继续使用'],
      answer: 2,
    },
    {
      text: '顾客提出无法立即解决的问题时，正确做法是？',
      options: ['明确记录诉求并告知后续处理节点', '承诺无法保证的结果', '让顾客稍后自行再来', '转身处理其他工作'],
      answer: 0,
    },
  ];

  const state = {
    filter: 'all',
    search: '',
    theme: 'light',
    examPhase: 'intro',
    answers: {},
    attempts: 1,
    result: null,
    completed: false,
  };

  const elements = {
    body: document.body,
    courseGrid: document.querySelector('#course-grid'),
    emptyState: document.querySelector('#empty-state'),
    courseStatus: document.querySelector('#course-status'),
    searchInput: document.querySelector('#search-input'),
    fileInput: document.querySelector('#file-input'),
    examDialog: document.querySelector('#exam-dialog'),
    questionList: document.querySelector('#question-list'),
    questionForm: document.querySelector('#question-form'),
    submitExam: document.querySelector('#submit-exam'),
    answeredCount: document.querySelector('#answered-count'),
    answerProgress: document.querySelector('#answer-progress'),
    toast: document.querySelector('#toast'),
  };

  let toastTimer;

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function sourceLabel(source) {
    return source === 'enterprise' ? '企业课程' : '本地导入';
  }

  function getVisibleCourses() {
    const query = state.search.trim().toLocaleLowerCase('zh-CN');
    return courses.filter((course) => {
      const matchesFilter = state.filter === 'all' || course.source === state.filter;
      const matchesSearch = !query || course.name.toLocaleLowerCase('zh-CN').includes(query);
      return matchesFilter && matchesSearch;
    });
  }

  function renderCounts() {
    const enterpriseCount = courses.filter((course) => course.source === 'enterprise').length;
    const localCount = courses.filter((course) => course.source === 'local').length;
    document.querySelector('#count-all').textContent = String(courses.length);
    document.querySelector('#count-enterprise').textContent = String(enterpriseCount);
    document.querySelector('#count-local').textContent = String(localCount);
    document.querySelector('#course-total').textContent = String(courses.length);
  }

  function renderCourses() {
    const visible = getVisibleCourses();
    elements.courseGrid.innerHTML = visible
      .map(
        (course) => `
          <article class="course-card" data-course-id="${escapeHtml(course.id)}">
            <div class="course-visual visual-${escapeHtml(course.visual)}" aria-hidden="true">
              <span class="visual-code">${escapeHtml(course.code)}</span>
              <span class="visual-number">${escapeHtml(course.number)}</span>
            </div>
            <div class="course-card-body">
              <span class="source-badge ${course.source}">${sourceLabel(course.source)}</span>
              <h3 title="${escapeHtml(course.name)}">${escapeHtml(course.name)}</h3>
              <p class="course-card-meta">${course.scenes} 个学习场景 · ${escapeHtml(course.updated)}</p>
              <div class="card-actions">
                <button type="button" data-open="${escapeHtml(course.id)}">打开课程 <span aria-hidden="true">→</span></button>
                ${
                  course.source === 'local'
                    ? `<span class="local-actions">
                        <button type="button" data-rename="${escapeHtml(course.id)}">重命名</button>
                        <button type="button" data-delete="${escapeHtml(course.id)}">删除</button>
                      </span>`
                    : ''
                }
              </div>
            </div>
          </article>
        `,
      )
      .join('');

    elements.courseGrid.hidden = visible.length === 0;
    elements.emptyState.hidden = visible.length !== 0;
    elements.courseStatus.textContent = visible.length
      ? `当前显示 ${visible.length} 门课程`
      : '当前筛选没有结果';
    renderCounts();
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    toastTimer = window.setTimeout(() => elements.toast.classList.remove('show'), 2600);
  }

  function setFilter(filter) {
    state.filter = filter;
    document.querySelectorAll('[data-filter]').forEach((button) => {
      const active = button.dataset.filter === filter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderCourses();
  }

  function importCourse(file) {
    if (!file.name.toLocaleLowerCase('en-US').endsWith('.zip')) {
      showToast('请选择 ZIP 格式的课程文件。');
      return;
    }

    const rawName = file.name.replace(/\.zip$/i, '').trim();
    courses.unshift({
      id: `local-${Date.now()}`,
      name: rawName || '未命名本地课程',
      source: 'local',
      scenes: 8,
      updated: '本机 · 刚刚导入',
      code: 'LOCAL / ZIP',
      number: `L${courses.filter((course) => course.source === 'local').length + 1}`,
      visual: 'import',
    });
    state.filter = 'local';
    state.search = '';
    elements.searchInput.value = '';
    setFilter('local');
    showToast(`已导入“${rawName || '未命名本地课程'}”`);
  }

  function renameCourse(id) {
    const course = courses.find((item) => item.id === id && item.source === 'local');
    if (!course) return;
    const nextName = window.prompt('输入新的课程名称', course.name);
    if (nextName === null) return;
    const trimmed = nextName.trim();
    if (!trimmed) {
      showToast('课程名称不能为空。');
      return;
    }
    course.name = trimmed.slice(0, 100);
    course.updated = '本机 · 刚刚修改';
    renderCourses();
    showToast('课程已重命名。');
  }

  function deleteCourse(id) {
    const index = courses.findIndex((item) => item.id === id && item.source === 'local');
    if (index < 0) return;
    if (!window.confirm(`删除本地课程“${courses[index].name}”？此操作只影响当前原型页面。`)) return;
    const [{ name }] = courses.splice(index, 1);
    renderCourses();
    showToast(`已删除“${name}”`);
  }

  function renderQuestions() {
    elements.questionList.innerHTML = questions
      .map(
        (question, questionIndex) => `
          <section class="question-item" aria-labelledby="question-${questionIndex}">
            <span class="question-number">QUESTION ${String(questionIndex + 1).padStart(2, '0')}</span>
            <h3 id="question-${questionIndex}">${escapeHtml(question.text)}</h3>
            <div class="option-list">
              ${question.options
                .map(
                  (option, optionIndex) => `
                    <label class="option">
                      <input type="radio" name="question-${questionIndex}" value="${optionIndex}" />
                      <span>${String.fromCharCode(65 + optionIndex)}. ${escapeHtml(option)}</span>
                    </label>
                  `,
                )
                .join('')}
            </div>
          </section>
        `,
      )
      .join('');
  }

  function setExamPhase(phase) {
    state.examPhase = phase;
    document.querySelectorAll('.exam-view').forEach((view) => {
      view.classList.toggle('active', view.id === `exam-${phase}`);
    });
    document.querySelector('.dialog-body').scrollTop = 0;
  }

  function openExam() {
    if (state.completed && state.result) {
      applyResult();
      setExamPhase('result');
    } else {
      setExamPhase('intro');
    }
    elements.examDialog.classList.add('open');
    elements.examDialog.setAttribute('aria-hidden', 'false');
    elements.body.classList.add('dialog-open');
    window.setTimeout(() => document.querySelector('#dialog-close').focus(), 0);
  }

  function closeExam(force = false) {
    if (!force && state.examPhase === 'questions') {
      const leave = window.confirm('退出本次考核？当前未提交的答案不会计入成绩。');
      if (!leave) return;
    }
    elements.examDialog.classList.remove('open');
    elements.examDialog.setAttribute('aria-hidden', 'true');
    elements.body.classList.remove('dialog-open');
    document.querySelector('#exam-note').focus();
  }

  function resetAnswers() {
    state.answers = {};
    elements.questionForm.reset();
    updateAnswerProgress();
  }

  function updateAnswerProgress() {
    const answered = Object.keys(state.answers).length;
    elements.answeredCount.textContent = String(answered);
    elements.answerProgress.style.width = `${(answered / questions.length) * 100}%`;
    elements.submitExam.disabled = answered !== questions.length;
    document.querySelector('#submit-help').textContent =
      answered === questions.length ? '全部题目已完成，可以提交。' : `还有 ${questions.length - answered} 道题未作答。`;
  }

  function applyResult() {
    if (!state.result) return;
    const passed = state.result.passed;
    const mark = document.querySelector('#result-mark');
    mark.textContent = passed ? '✓' : '×';
    mark.classList.toggle('failed', !passed);
    document.querySelector('#result-title').textContent = passed ? '考核通过' : '未达到通过线';
    document.querySelector('#result-score').textContent = String(state.result.score);
    document.querySelector('#result-correct').textContent = String(state.result.correct);
    document.querySelector('#result-attempt').textContent = String(state.attempts);
    document.querySelector('#result-copy').textContent = passed
      ? '你已达到 80 分通过线。'
      : '本次成绩未达到 80 分，可以返回后重新参加。';
  }

  function updateExamNote() {
    const note = document.querySelector('#exam-note');
    document.querySelector('#note-attempt').textContent = String(state.attempts);
    document.querySelector('#intro-attempt').textContent = String(state.attempts);
    if (state.completed) {
      note.classList.add('completed');
      document.querySelector('#note-status').textContent = '考核已完成';
      document.querySelector('#note-action').innerHTML = '查看结果 <span aria-hidden="true">→</span>';
      document.querySelector('#pending-total').textContent = '0';
    } else if (state.result) {
      document.querySelector('#note-status').textContent = `上次 ${state.result.score} 分 · 可重试`;
      document.querySelector('#note-action').innerHTML = '再次参加 <span aria-hidden="true">→</span>';
    }
  }

  document.querySelectorAll('[data-filter]').forEach((button) => {
    button.addEventListener('click', () => setFilter(button.dataset.filter));
  });

  elements.searchInput.addEventListener('input', (event) => {
    state.search = event.target.value;
    renderCourses();
  });

  document.querySelector('#clear-filters').addEventListener('click', () => {
    state.search = '';
    elements.searchInput.value = '';
    setFilter('all');
    elements.searchInput.focus();
  });

  document.querySelector('#import-button').addEventListener('click', () => elements.fileInput.click());
  elements.fileInput.addEventListener('change', () => {
    const [file] = elements.fileInput.files;
    if (file) importCourse(file);
    elements.fileInput.value = '';
  });

  elements.courseGrid.addEventListener('click', (event) => {
    const openButton = event.target.closest('[data-open]');
    const renameButton = event.target.closest('[data-rename]');
    const deleteButton = event.target.closest('[data-delete]');
    if (openButton) {
      const course = courses.find((item) => item.id === openButton.dataset.open);
      if (course) showToast(`正在打开“${course.name}”`);
    }
    if (renameButton) renameCourse(renameButton.dataset.rename);
    if (deleteButton) deleteCourse(deleteButton.dataset.delete);
  });

  document.querySelector('#theme-button').addEventListener('click', (event) => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    elements.body.dataset.theme = state.theme;
    const dark = state.theme === 'dark';
    event.currentTarget.textContent = dark ? '☀' : '☾';
    event.currentTarget.title = dark ? '切换为浅色主题' : '切换为深色主题';
    event.currentTarget.setAttribute('aria-label', event.currentTarget.title);
  });

  document.querySelector('#language-button').addEventListener('click', () => showToast('当前语言：简体中文'));
  document.querySelector('#logout-button').addEventListener('click', () => showToast('原型不会退出真实账户。'));

  document.querySelector('#exam-note').addEventListener('click', openExam);
  document.querySelector('#dialog-close').addEventListener('click', () => closeExam());
  elements.examDialog.addEventListener('click', (event) => {
    if (event.target === elements.examDialog) closeExam();
  });

  document.querySelector('#start-exam').addEventListener('click', () => {
    resetAnswers();
    setExamPhase('questions');
  });

  elements.questionForm.addEventListener('change', (event) => {
    if (!event.target.matches('input[type="radio"]')) return;
    const questionIndex = Number(event.target.name.replace('question-', ''));
    state.answers[questionIndex] = Number(event.target.value);
    updateAnswerProgress();
  });

  elements.questionForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (Object.keys(state.answers).length !== questions.length) return;
    elements.submitExam.disabled = true;
    elements.submitExam.textContent = '正在提交…';
    window.setTimeout(() => {
      const correct = questions.reduce(
        (total, question, index) => total + (state.answers[index] === question.answer ? 1 : 0),
        0,
      );
      const score = Math.round((correct / questions.length) * 100);
      state.result = { correct, score, passed: score >= 80 };
      state.completed = state.result.passed;
      elements.submitExam.textContent = '提交答案';
      applyResult();
      updateExamNote();
      setExamPhase('submitted');
    }, 650);
  });

  document.querySelector('#view-result').addEventListener('click', () => setExamPhase('result'));
  document.querySelector('#finish-exam').addEventListener('click', () => {
    closeExam(true);
    if (!state.completed) {
      state.attempts += 1;
      updateExamNote();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && elements.examDialog.classList.contains('open')) closeExam();
  });

  renderQuestions();
  renderCourses();
  updateAnswerProgress();
})();
