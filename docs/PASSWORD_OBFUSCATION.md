# Password Obfuscation

Simple obfuscation mechanism for test credentials in `.env` files.

## Overview

**Purpose**: Prevent casual viewing of passwords in `.env` files  
**Method**: Base64 encoding with `OBF:` prefix  
**Security**: This is obfuscation, not encryption — use proper secret management for production

## Usage

### Obfuscate a new password

```bash
node scripts/obfuscate.js "my-secret-password"
# Output: OBF:bXktc2VjcmV0LXBhc3N3b3Jk
```

### Update .env file

```dotenv
# Replace the plain password with obfuscated version
TEST_USER_PASSWORD=OBF:bXktc2VjcmV0LXBhc3N3b3Jk
```

### In application code

```typescript
import { env } from '../utils/env';

// Automatically deobfuscated
const password = env.testUserPassword; // Returns original plain text
```

## How it works

1. **Encoding**: [utils/obfuscation.ts](../utils/obfuscation.ts) provides `obfuscate()` function
2. **Decoding**: [utils/env.ts](../utils/env.ts) automatically calls `deobfuscate()`
3. **Backward compatible**: Plain passwords still work (gradual migration)

## CI/CD Integration

GitHub Actions secrets should contain the **obfuscated** version:

```yaml
env:
  TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }} # Contains OBF:xxxxx
```

The framework automatically deobfuscates during test execution.

## Security Notes

- `.env` files are still excluded from version control via `.gitignore`
- This prevents accidental exposure in code reviews, screenshots, logs
- **Not cryptographically secure** — dedicated secret management recommended for production
- Obfuscated values are easily reversible with Base64 decoding
