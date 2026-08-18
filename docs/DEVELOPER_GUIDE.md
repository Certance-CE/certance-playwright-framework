# Developer Guide — Clean Code Playwright Framework

> **Quick Start**: Read this guide before writing your first test  
> **Reference**: Bookmark this for daily development decisions  
> **Foundation**: Clean Code + SOLID + Design Patterns

---

## 1. Before You Code — Essential Reads

1. **[CODING_STANDARDS.md](./CODING_STANDARDS.md)** — Clean Code & SOLID principles with examples
2. **[ADR-004](./decisions/ADR-004-clean-code-solid-principles.md)** — Foundation principles decision
3. **[ADR-005](./decisions/ADR-005-design-patterns-test-automation.md)** — Design patterns for test automation
4. **[skills/SKILL.md](../skills/SKILL.md)** — Framework-specific rules and conventions

---

## 2. Development Workflow

### New Feature Workflow

```bash
# 1. Understand the requirement
Read feature specification, identify Page Objects needed

# 2. Design before coding
- Which SOLID principles apply?
- What design patterns solve this problem?
- How does this fit existing abstractions?

# 3. Write tests first (TDD)
Create .feature file or .spec.ts with failing tests

# 4. Implement with clean code
Follow naming conventions, single responsibility, error handling

# 5. Refactor and review
Apply Boy Scout Rule, ensure SOLID compliance
```

### Code Review Checklist

```markdown
## Clean Code Principles

- [ ] **Meaningful Names**: Classes, methods, variables express clear intent
- [ ] **Single Responsibility**: Each function/class has one reason to change
- [ ] **Error Handling**: Exceptions provide context, no silent failures
- [ ] **Comments**: Explain WHY, not WHAT (code should be self-documenting)

## SOLID Principles

- [ ] **SRP**: One responsibility per class/method
- [ ] **OCP**: New behavior added via extension, not modification
- [ ] **LSP**: Subtypes are interchangeable with their base types
- [ ] **ISP**: No client forced to depend on unused methods
- [ ] **DIP**: Dependencies injected via abstractions

## Design Patterns

- [ ] **Factory Pattern**: Used for test data creation
- [ ] **Strategy Pattern**: Applied for browser/environment variations
- [ ] **Command Pattern**: Complex workflows encapsulated as objects
- [ ] **Page Object Model**: UI interactions properly abstracted

## Framework Rules

- [ ] **Locator Hierarchy**: getByRole() > getByLabel() > getByTestId()
- [ ] **Fixtures**: Page Objects injected, never instantiated with 'new'
- [ ] **Test Independence**: Can run in isolation, no shared state
- [ ] **Application Agnostic**: No client specifics in core framework files
```

---

## 3. Common Patterns and Examples

### Creating a New Page Object

```typescript
// ✅ Follows Clean Code + SOLID principles
export class TaskListPage {
  constructor(private readonly page: Page) {}

  // Intention-revealing names (Clean Code)
  async navigateToTaskList(): Promise<void> {
    await this.page.goto('/tasks');
    await this.waitForPageReady();
  }

  // Single responsibility (SRP)
  async createNewTask(title: string): Promise<void> {
    if (!title.trim()) {
      throw new Error('Task title cannot be empty');
    }

    await this.clickCreateButton();
    await this.fillTaskTitle(title);
    await this.submitForm();
  }

  // Strategy pattern for cross-browser compatibility
  private getCreateButtonLocator(): Locator {
    return this.page.getByRole('button', { name: /create task/i });
  }

  // Error handling with context
  private async submitForm(): Promise<void> {
    try {
      await this.page.getByRole('button', { name: /save/i }).click();
      await expect(this.page.getByText('Task created')).toBeVisible();
    } catch (error) {
      throw new Error(`Failed to submit task form: ${error.message}`);
    }
  }

  // Helper methods - single responsibility
  private async waitForPageReady(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: /tasks/i })).toBeVisible();
  }

  private async clickCreateButton(): Promise<void> {
    await this.getCreateButtonLocator().click();
  }

  private async fillTaskTitle(title: string): Promise<void> {
    await this.page.getByLabel(/task title/i).fill(title);
  }
}
```

### Test Data Factory Pattern

```typescript
// ✅ Factory pattern + Builder pattern for complex data
export class TaskDataFactory {
  // Simple factory method
  static create(overrides: Partial<Task> = {}): Task {
    return {
      id: faker.string.uuid(),
      title: faker.lorem.sentence(),
      description: faker.lorem.paragraph(),
      priority: 'medium',
      status: 'pending',
      createdAt: new Date(),
      assignee: faker.person.fullName(),
      ...overrides, // Clean override pattern
    };
  }

  // Specialized factory methods (intention-revealing)
  static createHighPriorityTask(): Task {
    return this.create({ priority: 'high' });
  }

  static createCompletedTask(): Task {
    return this.create({
      status: 'completed',
      completedAt: new Date(),
    });
  }

  // Builder pattern for complex scenarios
  static builder(): TaskBuilder {
    return new TaskBuilder();
  }
}

class TaskBuilder {
  private task: Partial<Task> = {};

  withTitle(title: string): this {
    this.task.title = title;
    return this;
  }

  withPriority(priority: 'low' | 'medium' | 'high'): this {
    this.task.priority = priority;
    return this;
  }

  withAssignee(assignee: string): this {
    this.task.assignee = assignee;
    return this;
  }

  build(): Task {
    return TaskDataFactory.create(this.task);
  }
}

// Usage in tests
const urgentTask = TaskDataFactory.builder()
  .withTitle('Fix production bug')
  .withPriority('high')
  .withAssignee('John Doe')
  .build();
```

### Fixture with Dependency Injection

```typescript
// ✅ Dependency Inversion Principle - injected abstractions
interface HttpClient {
  get(url: string): Promise<any>;
  post(url: string, data: any): Promise<any>;
}

// Concrete implementation for Playwright
class PlaywrightHttpClient implements HttpClient {
  constructor(private page: Page) {}

  async get(url: string): Promise<any> {
    const response = await this.page.request.get(url);
    return response.json();
  }

  async post(url: string, data: any): Promise<any> {
    const response = await this.page.request.post(url, { data });
    return response.json();
  }
}

// Page Object depends on abstraction (DIP)
export class TaskListPage {
  constructor(
    private readonly page: Page,
    private readonly apiClient: HttpClient,
  ) {}

  async getTasksViaApi(): Promise<Task[]> {
    return this.apiClient.get('/api/tasks');
  }
}

// Fixture handles dependency injection
export const pageObjectFixtures = test.extend<{
  taskListPage: TaskListPage;
}>({
  taskListPage: async ({ page }, use) => {
    const httpClient = new PlaywrightHttpClient(page);
    const taskListPage = new TaskListPage(page, httpClient);
    await use(taskListPage);
  },
});
```

### Command Pattern for Complex Workflows

```typescript
// ✅ Command pattern for reusable, undoable workflows
abstract class Command {
  abstract execute(): Promise<void>;
  abstract undo(): Promise<void>;
  abstract getDescription(): string;
}

class CompleteTaskWorkflow extends Command {
  constructor(
    private taskPage: TaskPage,
    private taskId: string,
    private completionNotes?: string,
  ) {
    super();
  }

  async execute(): Promise<void> {
    await this.taskPage.openTask(this.taskId);
    await this.taskPage.markAsCompleted();

    if (this.completionNotes) {
      await this.taskPage.addCompletionNotes(this.completionNotes);
    }

    await this.taskPage.saveChanges();
  }

  async undo(): Promise<void> {
    await this.taskPage.openTask(this.taskId);
    await this.taskPage.markAsPending();
    await this.taskPage.clearCompletionNotes();
    await this.taskPage.saveChanges();
  }

  getDescription(): string {
    return `Complete task ${this.taskId}`;
  }
}

// Usage in tests with error recovery
const workflow = new CompleteTaskWorkflow(taskPage, 'task-123', 'Finished early');
try {
  await workflow.execute();
  // Verify success state
} catch (error) {
  await workflow.undo(); // Clean up on failure
  throw error;
}
```

---

## 4. Anti-Patterns to Avoid

### ❌ Violates Clean Code

```typescript
// Bad: unclear names, multiple responsibilities
class UP {
  async doit(e: string, p: string): Promise<boolean> {
    try {
      await this.page.fill('#email', e);
      await this.page.fill('#pwd', p);
      await this.page.click('.btn');
      await this.page.waitForURL('/dashboard');
      console.log('ok');
      return true;
    } catch {
      return false; // Silent failure
    }
  }
}
```

### ❌ Violates SOLID Principles

```typescript
// Bad: violates SRP, OCP, DIP
class TaskManager {
  // Multiple responsibilities (SRP violation)
  async createTask(title: string): Promise<void> { ... }
  async sendEmail(to: string, subject: string): Promise<void> { ... }
  async generateReport(): Promise<void> { ... }

  // Hard to extend without modification (OCP violation)
  async handleBrowser(type: string): Promise<void> {
    if (type === 'chrome') { /* chrome logic */ }
    else if (type === 'firefox') { /* firefox logic */ }
    // Need to modify this method for new browsers
  }

  // Depends on concrete implementation (DIP violation)
  private httpClient = new AxiosClient(); // Hard dependency
}
```

### ❌ Poor Test Structure

```typescript
// Bad: test does multiple things, unclear intent
test('user stuff', async ({ page }) => {
  // No Page Objects, raw page interactions
  await page.goto('/login');
  await page.fill('#email', 'test@example.com');
  await page.fill('#password', 'password123');
  await page.click('[data-test="login"]');

  // Multiple scenarios in one test
  await page.click('[data-test="create-task"]');
  await page.fill('#title', 'Test task');
  await page.click('[data-test="save"]');

  // Also testing logout in same test
  await page.click('[data-test="logout"]');

  // No proper error handling or assertions
});
```

---

## 5. Tools and Automation

### ESLint Rules for Clean Code

```json
{
  "rules": {
    "@typescript-eslint/naming-convention": [
      "error",
      {
        "selector": "class",
        "format": ["PascalCase"],
        "suffix": ["Page", "Modal", "Component", "Factory", "Command"]
      },
      {
        "selector": "method",
        "format": ["camelCase"],
        "leadingUnderscore": "forbid"
      }
    ],
    "max-lines-per-function": ["error", 20],
    "complexity": ["error", 10],
    "max-depth": ["error", 3],
    "prefer-const": "error",
    "no-magic-numbers": ["error", { "ignore": [0, 1] }]
  }
}
```

### TypeScript Strict Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### Pre-commit Hooks

```bash
#!/bin/sh
# Enforce coding standards before commit
npm run lint:fix
npm run type-check
npm run test:unit
```

---

## 6. Resources and References

### Essential Reading

- **Clean Code** by Robert C. Martin — fundamental principles
- **Design Patterns** by Gang of Four — architectural patterns
- **Refactoring** by Martin Fowler — improving existing code
- **Test Driven Development** by Kent Beck — TDD practices

### Framework Documentation

- [CODING_STANDARDS.md](./CODING_STANDARDS.md) — detailed examples and rules
- [ARCHITECTURE.md](./ARCHITECTURE.md) — high-level framework overview
- [skills/SKILL.md](../skills/SKILL.md) — Playwright-specific conventions

### ADR References

- [ADR-004: Clean Code & SOLID Principles](./decisions/ADR-004-clean-code-solid-principles.md)
- [ADR-005: Design Patterns for Test Automation](./decisions/ADR-005-design-patterns-test-automation.md)
- [ADR-002: Page Object Model](./decisions/ADR-002-page-object-model.md)

---

_Remember: These principles guide decisions, they don't replace thinking. When in doubt, prioritize readability and simplicity over clever solutions._
