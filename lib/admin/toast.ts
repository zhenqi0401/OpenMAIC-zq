import type { MessageInstance } from 'antd/es/message/interface';

/**
 * Admin toast facade backed by the Ant Design App context message.
 *
 * The app renders a single `<AntApp>` boundary; components that need toasts
 * must be inside it. Because `message` is only reachable through
 * `App.useApp()`, the provider registers the instance here once mounted —
 * module-level call sites keep their existing `adminToast.x(message)` shape.
 */
let messageApi: MessageInstance | null = null;

export function bindAdminMessageApi(api: MessageInstance | null) {
  messageApi = api;
}

export const adminToast = {
  success(message: string) {
    messageApi?.success(message);
  },
  error(message: string) {
    messageApi?.error(message);
  },
  info(message: string) {
    messageApi?.info(message);
  },
  warning(message: string) {
    messageApi?.warning(message);
  },
};

export function adminErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
