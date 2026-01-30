# CLAUDE.md - AI Assistant Guidelines

This document provides context and guidelines for AI assistants working with this repository.

## Repository Overview

**Repository**: testclaude
**Status**: New/Empty repository (initialized January 2026)
**Primary Language**: To be determined

This repository is newly initialized and awaiting its first implementation. This CLAUDE.md file serves as the foundational documentation for AI assistants.

## Project Structure

```
testclaude/
├── CLAUDE.md          # AI assistant guidelines (this file)
└── .git/              # Git version control
```

*As the project grows, update this structure to reflect new directories and key files.*

## Development Workflow

### Branch Strategy

- **Main branch**: Production-ready code
- **Feature branches**: Use `claude/` prefix for AI-assisted development
- Always create pull requests for code review before merging

### Commit Guidelines

1. Write clear, descriptive commit messages
2. Use conventional commit format when applicable:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `refactor:` for code refactoring
   - `test:` for adding/modifying tests
3. Keep commits atomic and focused on single changes

### Code Style

*Define language-specific style guides as the project develops:*

- Linting rules: TBD
- Formatting: TBD
- Testing framework: TBD

## AI Assistant Instructions

### When Working on This Repository

1. **Read before modifying**: Always read existing files before making changes
2. **Prefer edits over new files**: Modify existing code rather than creating new files when possible
3. **Keep changes minimal**: Only make changes directly related to the task
4. **Avoid over-engineering**: Implement the simplest solution that meets requirements
5. **Security first**: Never introduce vulnerabilities (XSS, SQL injection, etc.)

### Before Making Changes

- Understand the existing codebase structure
- Check for existing patterns and conventions
- Review related tests if they exist
- Verify dependencies are properly managed

### After Making Changes

- Ensure all tests pass (when tests exist)
- Verify no lint errors are introduced
- Confirm the build succeeds (when applicable)
- Write clear commit messages explaining the "why"

## Testing

*Testing strategy to be defined as the project develops.*

```bash
# Placeholder for test commands
# npm test
# pytest
# go test ./...
```

## Build & Deployment

*Build and deployment processes to be defined.*

```bash
# Placeholder for build commands
# npm run build
# make build
```

## Dependencies

*List key dependencies as they are added to the project.*

## Environment Setup

*Document environment setup steps as the project develops:*

1. Clone the repository
2. Install dependencies
3. Configure environment variables
4. Run development server

## Key Files Reference

| File | Purpose |
|------|---------|
| `CLAUDE.md` | AI assistant guidelines and project documentation |

*Add entries as significant files are created.*

## Common Tasks

### Adding a New Feature

1. Create a feature branch from main
2. Implement the feature with tests
3. Update documentation if needed
4. Submit a pull request

### Fixing a Bug

1. Reproduce the issue
2. Write a failing test (when applicable)
3. Implement the fix
4. Verify the fix and tests pass
5. Submit a pull request

## Notes for AI Assistants

- This is a new repository - help establish good patterns from the start
- When adding new technologies, update this CLAUDE.md file accordingly
- Document any architectural decisions made
- Keep this file updated as the project evolves

---

*Last updated: January 2026*
