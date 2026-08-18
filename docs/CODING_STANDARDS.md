# Certance Coding Standards — Clean Code & SOLID Principles

> **Foundation**: Robert C. Martin's "Clean Code" + SOLID design principles  
> **Version**: 1.0 · Last updated 2026-03-29  
> **Applies to**: All TypeScript code in Playwright test automation frameworks

---

## 1. Clean Code principles

### Meaningful names

```typescript
// ❌ Bad - abbreviations and unclear purpose
class TP {
  async clkChk(t: string): Promise<void> { ... }
}

// ✅ Good - intention-revealing names
class TodoPage {
  async clickToggleCheckbox(todoTitle: string): Promise<void> { ... }
}
```

**Rules:**

- Use intention-revealing names for classes, methods, variables
- Avoid abbreviations (`btn` → `button`, `usr` → `user`)
- Use searchable names (no magic numbers or single-letter variables in loops)
- Class names should be nouns (`TodoPage`, `TodoManager`)
- Method names should be verbs (`addTodo()`, `validateForm()`)

### Functions should do one thing

```typescript
// ❌ Bad - function does multiple things
async fillAndSubmitTodo(title: string): Promise<void> {
  await this.page.getByPlaceholder('What needs to be done?').fill(title);
  await this.page.getByPlaceholder('What needs to be done?').press('Enter');
  await expect(this.page.getByTestId('todo-item')).toBeVisible();
  console.log('Todo added successfully');
}

// ✅ Good - single responsibility per method
async fillNewTodo(title: string): Promise<void> {
  await this.page.getByPlaceholder('What needs to be done?').fill(title);
}

async submitNewTodo(): Promise<void> {
  await this.page.getByPlaceholder('What needs to be done?').press('Enter');
}

async expectTodoVisible(title: string): Promise<void> {
  await expect(this.page.getByTestId('todo-item').filter({ hasText: title })).toBeVisible();
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
async addTodo(title: string): Promise<boolean> {
  try {
    await this.page.getByPlaceholder('What needs to be done?').fill(title);
    await this.page.getByPlaceholder('What needs to be done?').press('Enter');
    return true;
  } catch {
    return false; // Silent failure, no context
  }
}

// ✅ Good - descriptive exceptions
async addTodo(title: string): Promise<void> {
  if (!title.trim()) {
    throw new Error('Todo title cannot be empty');
  }

  try {
    await this.page.getByPlaceholder('What needs to be done?').fill(title);
    await this.page.getByPlaceholder('What needs to be done?').press('Enter');
    await expect(this.page.getByTestId('todo-item').filter({ hasText: title })).toBeVisible();
  } catch (error) {
    throw new Error(`Failed to add todo "${title}": ${error.message}`);
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
async toggleTodo(title: string): Promise<void> {
  // Click the toggle checkbox
  await this.page.getByTestId('todo-item').filter({ hasText: title }).getByRole('checkbox').click();
}

// ❌ Bad - commenting obvious code
async fillNewTodo(title: string): Promise<void> {
  // Fill the input with the title
  await this.page.getByPlaceholder('What needs to be done?').fill(title);
}

// ✅ Good - self-documenting code, assertion doubles as documentation
async submitAndClearInput(title: string): Promise<void> {
  await this.page.getByPlaceholder('What needs to be done?').press('Enter');
  // TodoMVC clears the input on Enter — assert it before adding the next item.
  await expect(this.page.getByPlaceholder('What needs to be done?')).toHaveValue('');
}

// ✅ Good - explains non-obvious business rule
isValidTitle(title: string): boolean {
  // Product rule: titles are capped at 120 chars to fit a single list row on mobile
  return title.trim().length > 0 && title.length <= 120;
}

// ✅ Good - explains a non-obvious workaround with a web-first assertion (no sleeps)
async waitForClearCompletedToVanish(): Promise<void> {
  // The "Clear completed" control is removed (not hidden) once nothing is completed,
  // so assert on count rather than visibility to avoid a flaky race.
  await expect(this.page.getByRole('button', { name: 'Clear completed' })).toHaveCount(0);
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
class TodoPage {
  async addTodo(title: string): Promise<void> { ... }
  async removeTodo(title: string): Promise<void> { ... }
  async validateEmail(email: string): boolean { ... } // ← Different responsibility
  async sendNotification(message: string): Promise<void> { ... } // ← Different responsibility
}

// ✅ Good - single responsibility
class TodoPage {
  async addTodo(title: string): Promise<void> { ... }
  async removeTodo(title: string): Promise<void> { ... }
  async renameTodo(oldTitle: string, newTitle: string): Promise<void> { ... }
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

  abstract open(): Promise<void>;

  protected async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }
}

// The shipped reference Page Object (TodoMVC demo)...
class TodoPage extends BasePage {
  async open(): Promise<void> {
    await this.page.goto('/todomvc/');
    await this.waitForPageLoad();
  }
}

// ...and any new page you add later extends the same base — no edits to BasePage.
class AnotherPage extends BasePage {
  async open(): Promise<void> {
    await this.page.goto('/another/');
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

class TodoAddPage implements FormPage {
  async fillForm(data: Record<string, string>): Promise<void> {
    await this.page.getByPlaceholder('What needs to be done?').fill(data.title);
  }

  async submitForm(): Promise<void> {
    await this.page.getByPlaceholder('What needs to be done?').press('Enter');
  }
}

class TodoEditPage implements FormPage {
  async fillForm(data: Record<string, string>): Promise<void> {
    await this.page.getByRole('textbox', { name: 'Edit' }).fill(data.title);
  }

  async submitForm(): Promise<void> {
    await this.page.getByRole('textbox', { name: 'Edit' }).press('Enter');
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
interface TodoOperations {
  create(title: string): Promise<void>;
  edit(oldTitle: string, newTitle: string): Promise<void>;
  remove(title: string): Promise<void>;
  export(): Promise<void>;
  printReport(): Promise<void>;
}

// ✅ Good - segregated interfaces
interface TodoCreator {
  create(title: string): Promise<void>;
}

interface TodoEditor {
  edit(oldTitle: string, newTitle: string): Promise<void>;
  remove(title: string): Promise<void>;
}

interface TodoReporter {
  export(): Promise<void>;
  printReport(): Promise<void>;
}

class BasicTodoPage implements TodoCreator, TodoEditor {
  create(title: string): Promise<void> { ... }
  edit(oldTitle: string, newTitle: string): Promise<void> { ... }
  remove(title: string): Promise<void> { ... }
  // No need to implement export/print
}
```

### Dependency Inversion Principle (DIP)

> Depend upon abstractions, not concretions.

```typescript
// ❌ Bad - depends on concrete implementations
class TodoPage {
  private httpClient = new AxiosClient(); // ← Concrete dependency

  async getTodos(): Promise<Todo[]> {
    return this.httpClient.get('/api/todos');
  }
}

// ✅ Good - depends on abstractions
interface HttpClient {
  get(url: string): Promise<any>;
  post(url: string, data: any): Promise<any>;
}

class TodoPage {
  constructor(private httpClient: HttpClient) {} // ← Injected abstraction

  async getTodos(): Promise<Todo[]> {
    return this.httpClient.get('/api/todos');
  }
}

// Fixtures handle dependency injection (see fixtures/pages.fixture.ts)
test.extend<{ todoPage: TodoPage }>({
  todoPage: async ({ page }, use) => {
    const httpClient = new PlaywrightHttpClient(page); // Concrete implementation
    const todoPage = new TodoPage(httpClient);
    await use(todoPage);
  },
});
```

---

## 3. Design patterns for test automation

### Factory pattern for test data

```typescript
// ✅ Factory pattern for flexible test data creation.
// The shipped `data` fixture (fixtures/data.fixture.ts) is the real provider;
// this shows the pattern behind it.
class TodoDataFactory {
  static createTodo(overrides: Partial<Todo> = {}): Todo {
    return {
      id: faker.string.uuid(),
      title: faker.lorem.sentence(),
      completed: false,
      createdAt: new Date(),
      ...overrides,
    };
  }

  static createCompletedTodo(): Todo {
    return this.createTodo({ completed: true });
  }

  static createTodoWithLongTitle(): Todo {
    return this.createTodo({ title: faker.lorem.sentence(20) });
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

class AddTodoCommand extends Command {
  constructor(
    private todoPage: TodoPage,
    private title: string,
  ) {
    super();
  }

  async execute(): Promise<void> {
    await this.todoPage.open();
    await this.todoPage.addTodo(this.title);
  }

  async undo(): Promise<void> {
    await this.todoPage.removeTodo(this.title);
  }
}

// Usage in tests
const command = new AddTodoCommand(todoPage, 'Buy milk');
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
