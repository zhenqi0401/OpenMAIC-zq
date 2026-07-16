import { test as base } from '@playwright/test';
import { MockApi } from './mock-api';

type Fixtures = {
  mockApi: MockApi;
};

export const test = base.extend<Fixtures>({
  mockApi: [
    async ({ page }, use) => {
      const mockApi = new MockApi(page);
      // Legacy authoring tests predate enterprise auth. Give them an admin
      // session by default; auth and learner suites override this route locally.
      await mockApi.mockAdminSession();
      await mockApi.mockAdminCategories();
      await mockApi.mockEmptyCourseCatalog();
      await mockApi.mockCourseDraftPersistence();
      // Always mock server-providers — called on every page load by root layout
      await mockApi.mockServerProviders();
      await use(mockApi);
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
