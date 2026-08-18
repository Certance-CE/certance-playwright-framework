# Certance Coding Standards — Clean Code & SOLID Principles

> **Foundation**: Robert C. Martin's "Clean Code" + SOLID design principles  
> **Version**: 1.0 · Last updated 2026-03-29  
> **Applies to**: All TypeScript code in Playwright test automation frameworks

---

## 1. Clean Code principles

### Meaningful names

```typescript
// ❌ Bad - abbreviations and unclear purpose
class ULP {
  async clkBtn(id: string): Promise<void> { ... }
}

// ✅ Good - intention-revealing names
class UserLoginPage {
  async clickSubmitButton(buttonId: string): Promise<void> { ... }
}
```

**Rules:**

- Use intention-revealing names for classes, methods, variables
- Avoid abbreviations (`btn` → `button`, `usr` → `user`)
- Use searchable names (no magic numbers or single-letter variables in loops)
- Class names should be nouns (`UserPage`, `TaskManager`)
- Method names should be verbs (`createTask()`, `validateForm()`)

### Functions should do one thing

```typescript
// ❌ Bad - function does multiple things
async fillAndSubmitLoginForm(email: string, password: string): Promise<void> {
  await this.page.fill('[data-test="email"]', email);
  await this.page.fill('[data-test="password"]', password);
  await this.page.click('[data-test="submit"]');
  await this.page.waitForURL('/dashboard');
  console.log('User logged in successfully');
}

// ✅ Good - single responsibility per method
async fillEmail(email: string): Promise<void> {
  await this.page.fill('[data-test="email"]', email);
}

async fillPassword(password: string): Promise<void> {
  await this.page.fill('[data-test="password"]', password);
}

async submitForm(): Promise<void> {
  await this.page.click('[data-test="submit"]');
}

async waitForSuccessfulLogin(): Promise<void> {
  await this.page.waitForURL('/dashboard');
}
```

**Rules:**

- Functions should be small (< 20 lines ideal)
- One level of abstraction per function
- Descriptive names eliminate need for comments
- Extract 'till you drop — small functions are easier to understand

### Error handling

```typescript
// ❌ Bad - silent failures and return codes
async createTask(title: string): Promise<boolean> {
  try {
    await this.page.fill('[data-test="title"]', title);
    await this.page.click('[data-test="save"]');
    return true;
  } catch {
    return false; // Silent failure, no context
  }
}

// ✅ Good - descriptive exceptions
async createTask(title: string): Promise<void> {
  if (!title.trim()) {
    throw new Error('Task title cannot be empty');
  }

  try {
    await this.page.fill('[data-test="title"]', title);
    await this.page.click('[data-test="save"]');
    await expect(this.page.locator('[data-test="success-message"]')).toBeVisible();
  } catch (error) {
    throw new Error(`Failed to create task "${title}": ${error.message}`);
  }
}
```

**Rules:**

- Use exceptions, not error return codes
- Provide context in error messages
- Don't return null — throw exceptions or use Optional pattern
- Handle errors at the right level of abstraction

### Comments explain why, not what

```typescript
// ❌ Bad - comment explains what code does
async clickSaveButton(): Promise<void> {
  // Click the save button
  await this.page.click('[data-test="save"]');
}

// ❌ Bad - commenting obvious code
async fillTaskTitle(title: string): Promise<void> {
  // Fill the title field with the provided title
  await this.page.fill('[data-test="title"]', title);
}

// ✅ Good - comment explains business context
async clickSaveButton(): Promise<void> {
  // Save button becomes disabled after click to prevent duplicate submissions
  await this.page.click('[data-test="save"]');
}

// ✅ Even better - self-documenting code without comments
async submitFormAndPreventDuplicates(): Promise<void> {
  await this.page.click('[data-test="save"]');
  await expect(this.page.locator('[data-test="save"]')).toBeDisabled();
}

// ✅ Good - explains non-obvious business rule
async validatePassword(password: string): boolean {
  // Company policy requires 12+ chars, mixed case, special character
  const pattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
  return pattern.test(password);
}

// ✅ Good - explains workaround for specific issue
async waitForModalToClose(): Promise<void> {
  // Modal animation takes 300ms - wait for complete close to avoid flaky tests
  await expect(this.page.locator('[data-test="modal"]')).toHaveCount(0);
  await this.page.waitForTimeout(300);
}
```

**Rules:**

- Code should be self-documenting through good naming
- Comments explain **why**, not **how** or **what**
- Only comment when the **business context** isn't obvious from the code
- Comment non-obvious workarounds, business rules, or technical constraints
- Delete commented-out code — use version control instead
- TODO comments include name, date, and specific task
- Avoid redundant comments that restate what the code clearly does

---

## 2. SOLID principles

### Single Responsibility Principle (SRP)

> A class should have one, and only one, reason to change.

```typescript
// ❌ Bad - multiple responsibilities
class TaskPage {
  async createTask(title: string): Promise<void> { ... }
  async deleteTask(id: string): Promise<void> { ... }
  async validateEmail(email: string): boolean { ... } // ← Different responsibility
  async sendNotification(message: string): Promise<void> { ... } // ← Different responsibility
}

// ✅ Good - single responsibility
class TaskPage {
  async createTask(title: string): Promise<void> { ... }
  async deleteTask(id: string): Promise<void> { ... }
  async editTask(id: string, title: string): Promise<void> { ... }
}

class EmailValidator {
  validate(email: string): boolean { ... }
}

class NotificationService {
  async send(message: string): Promise<void> { ... }
}
```

### Open/Closed Principle (OCP)

> Software entities should be open for extension, but closed for modification.

```typescript
// ✅ Good - extensible without modifying existing code
abstract class BasePage {
  protected page: Page;
  constructor(page: Page) {
    this.page = page;
  }

  abstract navigate(): Promise<void>;

  protected async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }
}

class TaskListPage extends BasePage {
  async navigate(): Promise<void> {
    await this.page.goto('/tasks');
    await this.waitForPageLoad();
  }
}

class UserProfilePage extends BasePage {
  async navigate(): Promise<void> {
    await this.page.goto('/profile');
    await this.waitForPageLoad();
  }
}
```

### Liskov Substitution Principle (LSP)

> Objects of a superclass should be replaceable with objects of a subclass.

```typescript
// ✅ Good - subtypes are fully substitutable
interface FormPage {
  fillForm(data: Record<string, string>): Promise<void>;
  submitForm(): Promise<void>;
}

class LoginPage implements FormPage {
  async fillForm(data: Record<string, string>): Promise<void> {
    await this.page.fill('[data-test="email"]', data.email);
    await this.page.fill('[data-test="password"]', data.password);
  }

  async submitForm(): Promise<void> {
    await this.page.click('[data-test="login-button"]');
  }
}

class TaskCreatePage implements FormPage {
  async fillForm(data: Record<string, string>): Promise<void> {
    await this.page.fill('[data-test="title"]', data.title);
    await this.page.fill('[data-test="description"]', data.description);
  }

  async submitForm(): Promise<void> {
    await this.page.click('[data-test="create-button"]');
  }
}

// Both can be used interchangeably
async function completeForm(page: FormPage, data: Record<string, string>): Promise<void> {
  await page.fillForm(data);
  await page.submitForm();
}
```

### Interface Segregation Principle (ISP)

> Many client-specific interfaces are better than one general-purpose interface.

```typescript
// ❌ Bad - fat interface forces unnecessary dependencies
interface TaskOperations {
  create(title: string): Promise<void>;
  edit(id: string, title: string): Promise<void>;
  delete(id: string): Promise<void>;
  export(): Promise<void>;
  printReport(): Promise<void>;
}

// ✅ Good - segregated interfaces
interface TaskCreator {
  create(title: string): Promise<void>;
}

interface TaskEditor {
  edit(id: string, title: string): Promise<void>;
  delete(id: string): Promise<void>;
}

interface TaskReporter {
  export(): Promise<void>;
  printReport(): Promise<void>;
}

class BasicTaskPage implements TaskCreator, TaskEditor {
  create(title: string): Promise<void> { ... }
  edit(id: string, title: string): Promise<void> { ... }
  delete(id: string): Promise<void> { ... }
  // No need to implement export/print
}
```

### Dependency Inversion Principle (DIP)

> Depend upon abstractions, not concretions.

```typescript
// ❌ Bad - depends on concrete implementations
class TaskListPage {
  private httpClient = new AxiosClient(); // ← Concrete dependency

  async getTasks(): Promise<Task[]> {
    return this.httpClient.get('/api/tasks');
  }
}

// ✅ Good - depends on abstractions
interface HttpClient {
  get(url: string): Promise<any>;
  post(url: string, data: any): Promise<any>;
}

class TaskListPage {
  constructor(private httpClient: HttpClient) {} // ← Injected abstraction

  async getTasks(): Promise<Task[]> {
    return this.httpClient.get('/api/tasks');
  }
}

// Fixtures handle dependency injection
test.extend<{ taskListPage: TaskListPage }>({
  taskListPage: async ({ page }, use) => {
    const httpClient = new PlaywrightHttpClient(page); // Concrete implementation
    const taskListPage = new TaskListPage(httpClient);
    await use(taskListPage);
  },
});
```

---

## 3. Design patterns for test automation

### Factory pattern for test data

```typescript
// ✅ Factory pattern for flexible test data creation
class TaskDataFactory {
  static createTask(overrides: Partial<Task> = {}): Task {
    return {
      id: faker.string.uuid(),
      title: faker.lorem.sentence(),
      description: faker.lorem.paragraph(),
      status: 'pending',
      createdAt: new Date(),
      ...overrides,
    };
  }

  static createCompletedTask(): Task {
    return this.createTask({ status: 'completed' });
  }

  static createTaskWithLongTitle(): Task {
    return this.createTask({ title: faker.lorem.sentence(20) });
  }
}
```

### Strategy pattern for cross-browser compatibility

```typescript
// ✅ Strategy pattern for different locator strategies
interface LocatorStrategy {
  findSubmitButton(page: Page): Locator;
}

class ChromiumLocatorStrategy implements LocatorStrategy {
  findSubmitButton(page: Page): Locator {
    return page.getByRole('button', { name: /submit/i });
  }
}

class SafariLocatorStrategy implements LocatorStrategy {
  findSubmitButton(page: Page): Locator {
    return page.locator('[data-test="submit"], input[type="submit"]');
  }
}

class FormPage {
  constructor(
    private page: Page,
    private locatorStrategy: LocatorStrategy,
  ) {}

  async submit(): Promise<void> {
    const submitButton = this.locatorStrategy.findSubmitButton(this.page);
    await submitButton.click();
  }
}
```

### Command pattern for complex workflows

```typescript
// ✅ Command pattern for reusable workflows
abstract class Command {
  abstract execute(): Promise<void>;
  abstract undo(): Promise<void>;
}

class CreateTaskCommand extends Command {
  constructor(
    private taskPage: TaskPage,
    private taskData: Task,
  ) {
    super();
  }

  async execute(): Promise<void> {
    await this.taskPage.navigate();
    await this.taskPage.fillTaskForm(this.taskData);
    await this.taskPage.submit();
  }

  async undo(): Promise<void> {
    await this.taskPage.deleteLastCreatedTask();
  }
}

// Usage in tests
const command = new CreateTaskCommand(taskPage, taskData);
await command.execute();
// If test fails, can rollback state
await command.undo();
```

---

## 4. Enforcement and code reviews

### Pre-commit checks

- ESLint rules enforce naming conventions
- TypeScript strict mode catches type safety violations
- Prettier enforces consistent formatting
- Custom rules check for banned patterns (CSS selectors, etc.)

### Code review checklist

- [ ] **Names**: Do class and method names clearly express intent?
- [ ] **Single Responsibility**: Does each class/method do exactly one thing?
- [ ] **Error Handling**: Are failures properly handled with descriptive messages?
- [ ] **Dependencies**: Are concrete dependencies properly abstracted?
- [ ] **Test Independence**: Can this test run in isolation?
- [ ] **Locator Strategy**: Using approved locator hierarchy?

### Refactoring guidelines

- **Boy Scout Rule**: Leave code cleaner than you found it
- **No Big Refactors**: Small, incremental improvements in each PR
- **Test Coverage**: Refactor with test safety net in place
- **Backward Compatibility**: Don't break existing tests during cleanup

---

_This document is a living standard. Update it as the framework evolves. Reference Uncle Bob's "Clean Code" and Martin Fowler's "Refactoring" for deeper guidance._
