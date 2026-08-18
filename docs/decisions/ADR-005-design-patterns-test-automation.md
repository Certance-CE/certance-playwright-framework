# ADR-005 — Design Patterns for Test Automation Architecture

**Date:** 2026-03-29  
**Status:** Accepted  
**Deciders:** Certance Advisory architecture team

---

## Context

Test automation code often becomes unwieldy without proper architectural
patterns. Common problems include:

- Duplicate test data creation logic across specs
- Tightly coupled test steps that can't be reused
- Browser-specific code scattered throughout Page Objects
- Complex user workflows that are difficult to maintain
- Lack of error recovery in multi-step operations

We need established design patterns specifically chosen for test automation
challenges while adhering to our Clean Code and SOLID principles foundation.

---

## Decision

We adopt the following **Gang of Four design patterns** as standard solutions
for common test automation architectural problems:

### 1. Factory Pattern — Test Data Creation

**Problem**: Inconsistent test data across specs, hardcoded values, setup duplication  
**Solution**: Centralized data factories with sensible defaults and override capabilities

```typescript
class TaskDataFactory {
  static create(overrides: Partial<Task> = {}): Task {
    return { /* defaults with faker */ ...overrides };
  }

  static createCompleted(): Task {
    /* specialized factory method */
  }
}
```

**Usage**: All test data creation must go through factory methods in `test-data/factories/`

### 2. Strategy Pattern — Cross-Browser Compatibility

**Problem**: Different locator strategies needed per browser or application version  
**Solution**: Pluggable locator strategies injected into Page Objects

```typescript
interface LocatorStrategy {
  findElement(page: Page, selector: string): Locator;
}

class ChromiumStrategy implements LocatorStrategy {
  /* */
}
class SafariStrategy implements LocatorStrategy {
  /* */
}
```

**Usage**: Browser-specific behavior encapsulated in strategy classes

### 3. Command Pattern — Complex Workflows

**Problem**: Multi-step user workflows that need rollback, logging, or retry capabilities  
**Solution**: Encapsulate workflows as executable command objects

```typescript
abstract class Command {
  abstract execute(): Promise<void>;
  abstract undo(): Promise<void>;
}

class CreateTaskWorkflow extends Command {
  /* */
}
```

**Usage**: Business workflows longer than 3 steps should be Commands

### 4. Null Object Pattern — Graceful Degradation

**Problem**: Tests breaking when optional elements are missing  
**Solution**: Null objects that provide safe default behavior

```typescript
class NotificationBanner {
  static readonly NULL = new NullNotificationBanner();
}

class NullNotificationBanner extends NotificationBanner {
  async isVisible(): Promise<boolean> {
    return false;
  }
  async dismiss(): Promise<void> {
    /* no-op */
  }
}
```

**Usage**: Optional UI elements should have Null Object implementations

### 5. Builder Pattern — Complex Object Construction

**Problem**: Page Objects with many optional configuration parameters  
**Solution**: Fluent builder interface for optional configurations

```typescript
class TaskPageBuilder {
  withFilter(filter: string): this {
    /* */
  }
  withSort(field: string): this {
    /* */
  }
  build(): TaskPage {
    /* */
  }
}

// Usage: new TaskPageBuilder().withFilter('completed').withSort('date').build()
```

**Usage**: Page Objects with > 3 configuration options should use Builder pattern

---

## Implementation Guidelines

### Pattern Selection Criteria

- **Factory**: When creating test data or Page Object instances
- **Strategy**: When behavior varies by browser, environment, or app version
- **Command**: When workflow needs undo, retry, or complex error handling
- **Null Object**: When optional elements might not exist in certain conditions
- **Builder**: When objects have multiple optional configuration parameters

### Code Organization

```
utils/patterns/
├── factories/
│   ├── TaskDataFactory.ts
│   └── UserDataFactory.ts
├── strategies/
│   ├── LocatorStrategy.ts
│   └── BrowserSpecificStrategies.ts
├── commands/
│   ├── Command.ts
│   └── WorkflowCommands.ts
└── builders/
    └── PageBuilders.ts
```

### Forbidden Anti-Patterns

- ❌ **God Objects**: Classes that do everything
- ❌ **Spaghetti Code**: Procedural code in Object-Oriented design
- ❌ **Copy-Paste Programming**: Duplicate logic instead of abstraction
- ❌ **Magic Numbers/Strings**: Hardcoded values without constants
- ❌ **Swiss Army Knife**: Interfaces with unrelated methods

---

## Consequences

### Positive

- **Reusability** — patterns provide proven solutions to common problems
- **Maintainability** — clear separation of concerns and responsibilities
- **Testability** — looser coupling makes unit testing easier
- **Flexibility** — strategy and command patterns enable runtime behavior changes
- **Consistency** — team uses same solutions for same problems

### Negative

- **Learning curve** — developers must understand when and how to apply patterns
- **Over-engineering risk** — applying patterns where simple solutions suffice
- **Initial complexity** — more classes and interfaces to maintain

### Technical Debt Management

- Patterns should emerge naturally from refactoring, not be forced upfront
- Start with simple solutions, apply patterns when complexity warrants them
- Document pattern usage decisions in code comments
- Regular architecture reviews to prevent pattern misuse

---

## Compliance

**Required**: New code must use these patterns for the identified scenarios  
**Refactoring**: Existing code should be gradually refactored to use patterns during maintenance  
**Reviews**: Code reviews must verify appropriate pattern usage and flag anti-patterns

**Success Metrics**:

- Reduced code duplication (measured by static analysis)
- Improved test reliability (fewer flaky failures)
- Faster feature development (reusable components)
- Developer satisfaction with codebase maintainability
