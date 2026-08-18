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
- [ ] **Application Agnostic**: No app-specific details in core framework files
```

---

## 3. Common Patterns and Examples

### Creating a New Page Object

```typescript
// ✅ Follows Clean Code + SOLID principles
// This mirrors the shipped reference Page Object (pages/TodoPage.ts, TodoMVC demo).
export class TodoPage extends BasePage {
  // Intention-revealing names (Clean Code)
  async open(): Promise<void> {
    // baseURL is the app origin; the TodoMVC demo lives under /todomvc/.
    await this.goto('/todomvc/');
    await this.waitForPageReady();
  }

  // Single responsibility (SRP)
  async addTodo(title: string): Promise<void> {
    if (!title.trim()) {
      throw new Error('Todo title cannot be empty');
    }

    await this.fillNewTodo(title);
    await this.submitNewTodo();
  }

  // Locator hierarchy: role/placeholder/testid only — no CSS/XPath
  private newTodoInput(): Locator {
    return this.page.getByPlaceholder('What needs to be done?');
  }

  // Error handling with context
  private async submitNewTodo(): Promise<void> {
    try {
      await this.newTodoInput().press('Enter');
      await expect(this.page.getByTestId('todo-item').last()).toBeVisible();
    } catch (error) {
      throw new Error(`Failed to add todo: ${error.message}`);
    }
  }

  // Helper methods - single responsibility
  private async waitForPageReady(): Promise<void> {
    await expect(this.page.getByRole('heading', { name: /todos/i })).toBeVisible();
  }

  private async fillNewTodo(title: string): Promise<void> {
    await this.newTodoInput().fill(title);
  }
}
```

### Test Data Factory Pattern

```typescript
// ✅ Factory pattern + Builder pattern for complex data.
// In this framework the shipped `data` fixture already provides synthetic data
// (data.*, data.realistic.*, data.edge.*, see fixtures/data.fixture.ts); the
// pattern below shows how such a provider is built.
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: Date;
}

export class TodoDataFactory {
  // Simple factory method
  static create(overrides: Partial<Todo> = {}): Todo {
    return {
      id: faker.string.uuid(),
      title: faker.lorem.sentence(),
      completed: false,
      createdAt: new Date(),
      ...overrides, // Clean override pattern
    };
  }

  // Specialized factory methods (intention-revealing)
  static createCompleted(): Todo {
    return this.create({ completed: true });
  }

  static createWithLongTitle(): Todo {
    return this.create({ title: faker.lorem.sentence(20) });
  }

  // Builder pattern for complex scenarios
  static builder(): TodoBuilder {
    return new TodoBuilder();
  }
}

class TodoBuilder {
  private todo: Partial<Todo> = {};

  withTitle(title: string): this {
    this.todo.title = title;
    return this;
  }

  completed(): this {
    this.todo.completed = true;
    return this;
  }

  build(): Todo {
    return TodoDataFactory.create(this.todo);
  }
}

// Usage in tests
const doneTodo = TodoDataFactory.builder().withTitle('Buy milk').completed().build();
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
export class TodoPage {
  constructor(
    private readonly page: Page,
    private readonly apiClient: HttpClient,
  ) {}

  async getTodosViaApi(): Promise<Todo[]> {
    return this.apiClient.get('/api/todos');
  }
}

// Fixture handles dependency injection (see fixtures/pages.fixture.ts)
export const pageObjectFixtures = test.extend<{
  todoPage: TodoPage;
}>({
  todoPage: async ({ page }, use) => {
    const httpClient = new PlaywrightHttpClient(page);
    const todoPage = new TodoPage(page, httpClient);
    await use(todoPage);
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

class CompleteTodoWorkflow extends Command {
  constructor(
    private todoPage: TodoPage,
    private todoTitle: string,
  ) {
    super();
  }

  async execute(): Promise<void> {
    await this.todoPage.open();
    await this.todoPage.toggle(this.todoTitle);
    await this.todoPage.expectCompleted(this.todoTitle);
  }

  async undo(): Promise<void> {
    // Toggling again returns the todo to its active state.
    await this.todoPage.toggle(this.todoTitle);
  }

  getDescription(): string {
    return `Complete todo "${this.todoTitle}"`;
  }
}

// Usage in tests with error recovery
const workflow = new CompleteTodoWorkflow(todoPage, 'Write tests');
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
// Bad: unclear names, multiple responsibilities, raw CSS selectors
class TP {
  async doit(t: string): Promise<boolean> {
    try {
      await this.page.fill('.new-todo', t);
      await this.page.keyboard.press('Enter');
      await this.page.waitForSelector('.todo-list li');
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
class TodoManager {
  // Multiple responsibilities (SRP violation)
  async addTodo(title: string): Promise<void> { ... }
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
test('todo stuff', async ({ page }) => {
  // No Page Objects, raw CSS selectors
  await page.goto('https://demo.playwright.dev/todomvc/');
  await page.fill('.new-todo', 'Test todo');
  await page.keyboard.press('Enter');

  // Multiple scenarios crammed into one test
  await page.click('.todo-list li .toggle');
  await page.click('.clear-completed');

  // No proper Page Object, no web-first assertions, multiple concerns
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
npm run typecheck
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
