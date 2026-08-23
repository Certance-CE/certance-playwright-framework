import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * ProjectPage — the task list inside a project in the demo application.
 *
 * Every locator is role- or label-based. Two of them are worth explaining, because
 * they are the cases where a real application stops being convenient and a lesser
 * suite reaches for CSS.
 */
export class ProjectPage extends BasePage {
  /** The List view of a project. View 1 is the list; 2/3/4 are Gantt, Table, Kanban. */
  async open(projectId: number) {
    await this.goto(`/projects/${projectId}/1`);
    await expect(this.page.getByRole('button', { name: /FILTERS/i })).toBeVisible();
  }

  private newTaskField() {
    return this.page.getByRole('textbox', { name: /Add a task/i });
  }

  /**
   * The completion control is an `<input type="checkbox" class="is-sr-only">` inside a
   * styled `<label>` — visually hidden, present for assistive technology. The checkbox
   * itself therefore cannot be clicked: Playwright reports "element is outside of the
   * viewport" and times out.
   *
   * It is still the right locator. Its accessible name carries the task title, which is
   * exactly the stable, user-perceivable hook the locator rules ask for.
   */
  private completionToggle(title: string) {
    return this.page.getByRole('checkbox', { name: `Mark '${title}' as done` });
  }

  private taskLink(title: string) {
    return this.page.getByRole('link', { name: title, exact: true });
  }

  async addTask(title: string) {
    await this.newTaskField().fill(title);
    await this.page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(this.taskLink(title)).toBeVisible();
  }

  /**
   * Complete a task from the keyboard.
   *
   * `check()` fails on the screen-reader-only input, and `check({ force: true })` would
   * "fix" it by switching off the actionability checks this framework exists to enforce
   * — a habit that eventually hides a genuinely unclickable control. Focus and Space is
   * how a keyboard or screen-reader user completes the task, so it exercises a path a
   * real person uses rather than a synthetic one.
   */
  async completeTask(title: string) {
    await this.completionToggle(title).focus();
    await this.page.keyboard.press('Space');
    await expect(this.completionToggle(title)).toBeChecked();
  }

  async expectTaskListed(title: string) {
    await expect(this.taskLink(title)).toBeVisible();
  }

  async expectTaskNotListed(title: string) {
    await expect(this.taskLink(title)).toHaveCount(0);
  }

  async expectTaskCount(count: number) {
    await expect(this.page.getByRole('checkbox', { name: /as done$/ })).toHaveCount(count);
  }
}
