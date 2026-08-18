# Migrating from Selenium WebDriver

Load this guide when: migrating an existing Selenium Java/Python/JavaScript
test suite to the Certance Playwright framework.

---

## Key conceptual shifts

| Selenium concept                       | Playwright equivalent                          |
| -------------------------------------- | ---------------------------------------------- |
| `WebDriver` instance                   | `page` object (per test, auto-injected)        |
| `driver.findElement(By.id(...))`       | `page.getByRole()` / `page.getByTestId()`      |
| `WebElement.click()`                   | `locator.click()` (auto-waits)                 |
| `WebDriverWait` + `ExpectedConditions` | Built into all Playwright actions + `expect()` |
| `@Before` / `@After` (JUnit)           | Playwright fixtures                            |
| `PageFactory` / `@FindBy`              | Page Object class with `page.*` locators       |
| `Actions` class (hover, drag)          | `locator.hover()`, `page.mouse.move()`         |
| RemoteWebDriver / Selenium Grid        | Playwright `--project` matrix + CI matrix      |

---

## Migration strategy

### Phase 1: Parallel run (weeks 1–2)

- Keep Selenium suite running
- Set up Playwright framework alongside it
- Run Planner agent to generate test plans

### Phase 2: Feature-by-feature migration (weeks 3–6)

- Migrate one feature area at a time using the Generator agent
- Compare Selenium + Playwright results for each migrated area
- Decommission Selenium tests once Playwright coverage is confirmed

### Phase 3: Decommission Selenium (week 7+)

- Remove Selenium dependencies
- CI runs Playwright only
- Archive Selenium test code in a git branch

---

## Common migration patterns

### Waits — replace all explicit waits

```java
// Selenium — brittle
WebDriverWait wait = new WebDriverWait(driver, 10);
wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("submit")));
```

```typescript
// Playwright — auto-waiting is built in
await page.getByRole('button', { name: 'Submit' }).click();
// No explicit wait needed — click() auto-waits for the element to be actionable
```

### Page Objects — simplify

```java
// Selenium — verbose, manual waits
public class LoginPage {
  @FindBy(id = "email") private WebElement emailInput;
  public void enterEmail(String email) {
    new WebDriverWait(driver, 10)
      .until(ExpectedConditions.visibilityOf(emailInput));
    emailInput.sendKeys(email);
  }
}
```

```typescript
// Playwright — clean, auto-waiting
export class LoginPage extends BasePage {
  async fillEmail(email: string) {
    await this.page.getByLabel('Email').fill(email);
  }
}
```

---

## What to do with your existing Selenium test coverage

1. Run the Planner agent — it will map coverage equivalent to your existing suite
2. Use the Generator agent to rewrite one feature area
3. Validate coverage parity using the HTML report
4. Repeat until all feature areas are migrated
