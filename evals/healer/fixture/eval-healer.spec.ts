import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { EvalTodoPage } from '../pages/EvalTodoPage';

// The eval case's test: copied to framework-tests/ in a throwaway worktree, beside the case's app.
test.use({ actionTimeout: 3_000 });

test('a task added once appears once in the list', async ({ page }) => {
  await page.setContent(readFileSync(path.join(__dirname, 'eval-app.html'), 'utf8'));
  const todo = new EvalTodoPage(page);
  await todo.add('Buy milk');
  await expect(todo.items).toHaveCount(1);
  await expect(todo.items.first()).toHaveText('Buy milk');
});
