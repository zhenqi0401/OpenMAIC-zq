const toast = document.querySelector("[data-toast]");
const drawer = document.querySelector("[data-drawer]");
const backdrop = document.querySelector("[data-backdrop]");

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function setLoading(button) {
  const target = button.getAttribute("data-loading-target");
  const label = button.getAttribute("data-loading-label") || "处理中";
  const loadingState = target ? document.querySelector(`[data-loading-state="${target}"]`) : null;
  const original = button.textContent;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  button.textContent = label;
  if (loadingState) loadingState.hidden = false;
  window.setTimeout(() => {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    button.textContent = original;
    if (loadingState) loadingState.hidden = true;
  }, 650);
}

function updateFilterState(target) {
  const rows = Array.from(document.querySelectorAll(`[data-filter-row="${target}"]`));
  const empty = document.querySelector(`[data-empty-state="${target}"]`);
  if (!empty || rows.length === 0) return;
  empty.hidden = rows.some((row) => !row.hidden);
}

function applyFilters(target) {
  const search = document.querySelector(`[data-filter="${target}"]`);
  const query = search ? search.value.trim().toLowerCase() : "";
  const selects = Array.from(document.querySelectorAll(`[data-filter-select="${target}"]`));
  document.querySelectorAll(`[data-filter-row="${target}"]`).forEach((row) => {
    const text = row.textContent.toLowerCase();
    const matchesQuery = query.length === 0 || text.includes(query);
    const matchesSelects = selects.every((select) => {
      const value = select.value;
      if (!value || value.startsWith("全部")) return true;
      return row.textContent.includes(value) || row.dataset.status === value || row.dataset.range?.includes(value);
    });
    row.hidden = !(matchesQuery && matchesSelects);
  });
  updateFilterState(target);
}

function setFieldError(input, message) {
  if (!input) return;
  const errorId = input.getAttribute("aria-describedby");
  const error = errorId ? document.getElementById(errorId) : null;
  input.setAttribute("aria-invalid", "true");
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
  input.focus();
}

function clearFieldError(input) {
  if (!input) return;
  const errorId = input.getAttribute("aria-describedby");
  const error = errorId ? document.getElementById(errorId) : null;
  input.removeAttribute("aria-invalid");
  if (error) error.hidden = true;
}

function openDrawer(title, mode) {
  if (!drawer || !backdrop) return;
  const heading = drawer.querySelector("[data-drawer-title]");
  const modeField = drawer.querySelector("[data-drawer-mode]");
  if (heading) heading.textContent = title;
  if (modeField) modeField.value = mode || "";
  drawer.removeAttribute("inert");
  drawer.setAttribute("aria-hidden", "false");
  drawer.classList.add("open");
  backdrop.classList.add("open");
  const first = drawer.querySelector("input, select, textarea, button");
  if (first) first.focus();
}

function closeDrawer() {
  if (!drawer || !backdrop) return;
  drawer.querySelectorAll("[aria-invalid='true']").forEach(clearFieldError);
  drawer.classList.remove("open");
  backdrop.classList.remove("open");
  drawer.setAttribute("inert", "");
  drawer.setAttribute("aria-hidden", "true");
}

document.querySelectorAll("[data-open-drawer]").forEach((button) => {
  button.addEventListener("click", () => {
    openDrawer(button.getAttribute("data-title") || "编辑", button.getAttribute("data-open-drawer"));
  });
});

document.querySelectorAll("[data-close-drawer]").forEach((button) => {
  button.addEventListener("click", closeDrawer);
});

document.querySelectorAll("[data-toast-action]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.hasAttribute("data-loading-target")) setLoading(button);
    showToast(button.getAttribute("data-toast-action") || "操作已保存");
  });
});

document.querySelectorAll("[data-filter]").forEach((input) => {
  const target = input.getAttribute("data-filter");
  input.addEventListener("input", () => applyFilters(target));
  applyFilters(target);
});

document.querySelectorAll("[data-filter-select]").forEach((select) => {
  const target = select.getAttribute("data-filter-select");
  select.addEventListener("change", () => applyFilters(target));
});

document.querySelectorAll("[data-apply-filter]").forEach((button) => {
  const target = button.getAttribute("data-apply-filter");
  button.addEventListener("click", () => applyFilters(target));
});

document.querySelectorAll("[data-submit-drawer]").forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.getAttribute("data-submit-drawer");
    if (mode === "course") {
      const name = document.getElementById("course-name");
      if (name && name.value.trim().length === 0) {
        setFieldError(name, "请先填写课程名称。");
        return;
      }
      clearFieldError(name);
      showToast("课程草稿已创建");
      closeDrawer();
    }
  });
});

document.querySelectorAll("[aria-describedby]").forEach((input) => {
  input.addEventListener("input", () => clearFieldError(input));
});

document.querySelectorAll("[data-status-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const row = button.closest(".table-row");
    const badge = row?.querySelector(".status");
    const courseName = row?.querySelector(".cell-title strong")?.textContent || "课程";
    if (!badge) return;
    if (badge.textContent.includes("已发布")) {
      badge.textContent = "草稿";
      badge.className = "status warn";
      row.dataset.status = "草稿";
      button.title = "发布";
      button.setAttribute("aria-label", `发布${courseName}`);
      showToast("已切换为草稿状态");
    } else {
      badge.textContent = "已发布";
      badge.className = "status success";
      row.dataset.status = "已发布";
      button.title = "下架";
      button.setAttribute("aria-label", `下架${courseName}`);
      showToast("已切换为已发布状态");
    }
    const target = row?.getAttribute("data-filter-row");
    if (target) applyFilters(target);
  });
});

document.querySelectorAll("[data-range-preview]").forEach((input) => {
  const output = document.querySelector(`[data-range-output="${input.getAttribute("data-range-preview")}"]`);
  input.addEventListener("input", () => {
    if (output) output.textContent = `${input.value}%`;
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDrawer();
});
