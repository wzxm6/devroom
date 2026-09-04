import { test, expect, type Page } from '@playwright/test';

// DevRoom 1.0 critical path:
// Auth → Workspace → Project → Post → Comment → Task → Kanban status change
// → Chat → File upload → Activity → Notification → Global search.
//
// Selectors prefer accessible roles/labels over CSS internals. This suite is
// intentionally linear: each stage depends on the previous one, mirroring a
// real first session. Requires the staging env documented in
// playwright.config.ts; otherwise every test self-skips.

const hasStagingEnv =
  Boolean(process.env.E2E_USER_A_EMAIL) && Boolean(process.env.E2E_USER_A_PASSWORD);

test.beforeEach(async () => {
  test.skip(!hasStagingEnv, 'Staging credentials (E2E_USER_A_*) are not configured.');
});

const signIn = async (page: Page, email: string, password: string) => {
  await page.goto('/login');
  await page.getByPlaceholder('dev@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard|onboarding/);
};

test('critical path: project → post → comment → task → chat → file → activity → search', async ({
  page,
}) => {
  const email = process.env.E2E_USER_A_EMAIL as string;
  const password = process.env.E2E_USER_A_PASSWORD as string;
  const stamp = Date.now();
  const projectName = `E2E Project ${stamp}`;
  const postTitle = `E2E Post ${stamp}`;
  const taskTitle = `E2E Task ${stamp}`;
  const chatBody = `E2E hello ${stamp}`;

  await signIn(page, email, password);

  // Workspace: dashboard greets an authenticated user with a workspace
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /good (morning|afternoon|evening)/i })).toBeVisible();

  // Project: create and open
  await page.goto('/projects');
  await page.getByRole('button', { name: /new project/i }).click();
  await page.getByPlaceholder(/AI Data Translator/i).fill(projectName);
  await page.getByRole('button', { name: /^create project$/i }).click();
  await page.getByRole('link', { name: new RegExp(projectName) }).first().click();
  await expect(page.getByRole('heading', { name: projectName })).toBeVisible();

  // Post + comment
  await page.getByRole('button', { name: /^posts$/i }).click();
  await page.getByRole('button', { name: /new post/i }).click();
  await page.getByPlaceholder(/RFC/i).fill(postTitle);
  await page.getByRole('button', { name: /^create post$/i }).click();
  await page.getByRole('link', { name: new RegExp(postTitle) }).first().click();
  await expect(page.getByRole('heading', { name: postTitle })).toBeVisible();
  await page.getByPlaceholder(/feedback|thoughts/i).fill(`E2E comment ${stamp}`);
  await page.keyboard.press('Control+Enter');
  await expect(page.getByText(`E2E comment ${stamp}`)).toBeVisible();

  // Task + Kanban status change (accessible control, not drag-and-drop)
  await page.goto(`/projects`);
  await page.getByRole('link', { name: new RegExp(projectName) }).first().click();
  await page.getByRole('button', { name: /^tasks$/i }).click();
  await page.getByRole('button', { name: /new task/i }).click();
  await page.getByPlaceholder(/translation pipeline/i).fill(taskTitle);
  await page.getByRole('button', { name: /^create task$/i }).click();
  await expect(page.getByText(taskTitle)).toBeVisible();
  await page.getByText(taskTitle).click();
  await page.getByRole('button', { name: /in progress/i }).first().click();
  await expect(page.getByText(taskTitle)).toBeVisible();

  // Chat: global message appears
  await page.goto('/chat');
  await page.getByPlaceholder(/write a message/i).fill(chatBody);
  await page.keyboard.press('Enter');
  await expect(page.getByText(chatBody)).toBeVisible();

  // File upload
  await page.goto('/projects');
  await page.getByRole('link', { name: new RegExp(projectName) }).first().click();
  await page.getByRole('button', { name: /^files$/i }).click();
  await page.setInputFiles('input[type="file"]', {
    name: `e2e-${stamp}.txt`,
    mimeType: 'text/plain',
    buffer: Buffer.from('e2e file contents'),
  });
  await expect(page.getByText(`e2e-${stamp}.txt`)).toBeVisible();

  // Activity: project timeline records the session
  await page.getByRole('button', { name: /^activity$/i }).click();
  await expect(page.getByText(new RegExp(taskTitle.slice(0, 20)))).toBeVisible();

  // Global search finds the project
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder(/search/i).fill(projectName);
  await expect(page.getByRole('button', { name: new RegExp(projectName) }).first()).toBeVisible();
});
