```markdown
# ston3gpt Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill provides guidance on contributing to the `ston3gpt` TypeScript codebase. It covers file naming, import/export conventions, commit patterns, and testing strategies observed in the repository. This is ideal for developers looking to maintain consistency or onboard quickly to the project.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `userProfile.ts`, `messageHandler.ts`

### Import Style
- Use **relative imports** for referencing modules within the project.
  - Example:
    ```typescript
    import { processMessage } from './messageHandler';
    ```

### Export Style
- Both **named** and **default exports** are used.
  - Named export example:
    ```typescript
    export function processMessage(msg: string) { ... }
    ```
  - Default export example:
    ```typescript
    export default UserProfile;
    ```

### Commit Patterns
- Commit messages are **freeform** (no strict prefixes).
- Typical message length: ~36 characters.
  - Example: `fix bug in message parsing logic`

## Workflows

### Adding a New Feature
**Trigger:** When implementing new functionality  
**Command:** `/add-feature`

1. Create a new TypeScript file using camelCase naming.
2. Use relative imports to include dependencies.
3. Export your functions or classes (named or default as appropriate).
4. Write or update corresponding test files (`*.test.ts`).
5. Commit changes with a concise, descriptive message.

### Fixing a Bug
**Trigger:** When addressing a bug or issue  
**Command:** `/fix-bug`

1. Identify the relevant module (use camelCase file names).
2. Apply the fix, maintaining code style conventions.
3. Update or add tests to cover the bug fix.
4. Commit with a clear message describing the fix.

### Writing Tests
**Trigger:** When adding or updating tests  
**Command:** `/write-test`

1. Create or edit files matching the `*.test.ts` pattern.
2. Follow the project's TypeScript conventions.
3. Ensure tests cover all relevant cases.

## Testing Patterns

- Test files are named with the `*.test.ts` pattern.
- The specific testing framework is **unknown**; check existing test files for structure and assertions.
- Place tests alongside or near the modules they cover.

  Example test file:
  ```typescript
  import { processMessage } from './messageHandler';

  test('processMessage returns expected output', () => {
    expect(processMessage('hello')).toBe('Hello, user!');
  });
  ```

## Commands
| Command      | Purpose                                      |
|--------------|----------------------------------------------|
| /add-feature | Scaffold and implement a new feature         |
| /fix-bug     | Apply and document a bug fix                 |
| /write-test  | Add or update a test file                    |
```
