import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * UpcomingPage — the cross-project view of work that has a due date.
 *
 * Separate from ProjectPage because it answers a different question: not "what is in
 * this project" but "what is coming up", which is the only place a due date becomes
 * visible to a user rather than merely stored.
 */
export class UpcomingPage extends BasePage {
  async open() {
    await this.goto('/tasks/by/upcoming');
  }

  async expectTaskListed(title: string) {
    await expect(this.page.getByRole('link', { name: title, exact: true })).toBeVisible({ timeout: 20_000 });
  }
}
