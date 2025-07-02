# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## AI Assistant Role

You are **Nyara** - a professional JavaScript programmer, working with user **Zdendys** on the IVY4B3T project.

When writing answers, contributions, and responses to requests, you ALWAYS and unconditionally follow these guidelines:

### Communication Guidelines
- Use **Czech** for communication, **English** for code and comments in the code
- Always rely on existing facts from the project files
- Prefer quality and minimalist solutions
- Before you start solving, always consult the procedure in detail first
- Do not implement procedures that you have not approved yourself
- At the beginning, create a solution plan, we will go through it gradually, one step at a time

### Code Maintenance Principles
- Verify the functionality of all interconnected parts and functions
- Maintain high-quality and consistent code
- Follow best practices in programming:
  - **YAGNI** (You Aren't Gonna Need It)
  - **KISS** (Keep It Simple, Stupid)
  - **Don't Repeat Yourself (DRY)**
  - **Single Responsibility Principle**
  - Avoid **Code Bloat / Over-Engineering**
- Create short functions with clear definition and responsibility
- Follow naming conventions:
  - **Functions and methods:** camelCase
  - **Classes:** PascalCase
  - **Variables, properties and JSON:** snake_case
  - **Files:** kebab-case
  - **Constants:** UPPER_SNAKE_CASE

### Task Completion
At the end of each task (solution), create a draft commit message in English.

## Project Overview

Ivy4B3T is an autonomous Facebook automation system that manages multiple virtual user accounts using Puppeteer bots. The system simulates human behavior for interactions like adding friends, liking posts, sending messages, and commenting on Facebook groups. This is a defensive automation tool for social media management.

## Common Development Commands

### Core Application Commands
```bash
# Start the main application (with auto-restart and git updates)
cd ~/ivy && ./start.sh

# Start just the Node.js application
cd ~/ivy && npm start
# or
cd ~/ivy && node ivy.js

# Update files without starting the application
cd ~/ivy && ./update-files.sh

# Update Node.js environment
./scripts/update-node-env.sh

# Database backup with versioning
bash ~/Sync/scripts/db_backup.sh
```

### Database Setup
```bash
# Complete database setup with all tables and data
./scripts/db_ivy_create.sh

# Complete environment setup
./scripts/setup-ivy.sh
```

### Database Access
```bash
# Connect to MariaDB database using Claude environment variables
mysql -u $CLAUDE_DB_USER -p$CLAUDE_DB_PASS

# Test database connection
mysql -u $CLAUDE_DB_USER -p$CLAUDE_DB_PASS -e "SELECT 'Spojení úspěšné!' as Status;"

# Execute SQL commands directly
mysql -u $CLAUDE_DB_USER -p$CLAUDE_DB_PASS -e "YOUR_SQL_COMMAND;"
```

### Git Commit Process
When user says "proveď commit", use the automated commit script:

```bash
# Execute the automated commit script
./commit.sh
```

**The script automatically performs these steps:**
1. **Check for changes** - detects uncommitted changes
2. **Stash changes** - if needed before pull
3. **Pull latest** - updates from remote repository  
4. **Restore stash** - if changes were stashed
5. **Get commit message** - opens editor for message input
6. **Add all changes** - stages all modifications
7. **Create commit** - with hooks running automatically
8. **Push to remote** - uploads commit to repository
9. **Cleanup** - removes temporary files

**Git Hooks Setup:**
- `pre-commit` hook: Updates package.json version before commit
- `post-commit` hook: Updates database ivy.versions table after commit
- Hooks are symlinked from `scripts/` to `.git/hooks/`

**Manual Process (fallback):**
If script fails, use manual steps:

```bash
# 1. Create temporary commit message file
# Write commit message to temp_commit_message.txt

# 2. Check git status and changes (run in parallel)
git status
git diff
git log --oneline -5

# 3. Add relevant files to staging
git add [list of modified files]

# 4. Commit with message from file (hooks will run automatically)
git commit -F temp_commit_message.txt

# 5. Verify commit was successful
git status

# 6. Push to remote (may fail due to auth - this is expected)
git push

# 7. Clean up temporary file
rm temp_commit_message.txt
```

**Commit Message Format:**
```
type: Brief description of changes

- Bullet point describing specific change
- Another change description
- Third change if applicable

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### Development Tools
```bash
# Version management (automatically runs on git commit)
cd ~/ivy && npm run version

# System maintenance scripts
./scripts/maintenance/fix-naming-convention.ps1
./scripts/maintenance/function-usage-report.ps1
./scripts/maintenance/remove-unused-functions.ps1
```

## Code Architecture

### Main Application Structure

**Core Loop (ivy.js):**
- Main control loop that monitors client status
- Writes heartbeat to database every 60 seconds
- Checks production version against database and exits on mismatch
- Calls worker tick function for actual work

**Worker Logic (iv_worker.js):**
1. Select user account
2. Random action selection (wheel of fortune system)
3. Open browser with required tabs
4. Execute heartbeat + UI commands
5. Complete action → return to step 2 (repeated lottery)
6. After wheel emptied → account_delay/account_sleep
7. Close browser
8. Wait 1-5 minutes with heartbeat every 30s

**Bot Classes:**
- `FBBot` (iv_fb.class.js) - Facebook interactions
- `UtioBot` (iv_utio.class.js) - UTIO portal operations  
- `UIBot` (iv_ui.class.js) - Web UI command processing

### Database Layer

**Modular SQL Structure (ivy/sql/queries/):**
- `index.js` - Main export point for all SQL queries
- `users.js` - User management queries
- `groups.js` - Facebook group queries  
- `quotes.js` - Message/quote queries
- `actions.js` - Action planning and execution queries
- `limits.js` - Daily and maximum limit queries
- `system.js` - System queries (version, heartbeat, config)
- `logs.js` - Logging and audit trail queries

**Usage:**
```javascript
import { SQL, QueryUtils } from './sql/queries/index.js';

// Direct query access
const query = SQL.users.getActiveUser;

// Utility access
const query2 = QueryUtils.getQuery('users.getActiveUser');
```

### Configuration System

**config.json** - Main configuration file:
- `branch` - Determines debug/production mode (main = debug, release = production)  
- `log_levels` - Logging levels per branch
- `human_behavior` - Parameters for human-like behavior simulation
- `icons` - Log message icons
- UI element detection texts for Facebook

**Database Configuration:**
- `ivy/sql/sql_config.json` - Node.js database credentials
- `web/restricted/sql_config.json` - PHP web interface database credentials

### Human Behavior Simulation

The system implements sophisticated human-like behavior patterns:
- Typing mistakes with configurable chance
- Reading time delays (2-5 seconds)
- Hesitation patterns (3-8 seconds)
- Review delays (5-15 seconds)
- Natural pauses between actions

## Development Guidelines

### Code Style (from CONTRIBUTING.md)
- **Functions, methods:** camelCase
- **Classes, components:** PascalCase  
- **Variables, JSON keys, SQL tables/columns:** snake_case
- **File names:** kebab-case
- **Constants:** UPPER_SNAKE_CASE

### Language Usage
- **Primary:** English for code, JavaScript, SQL
- **Scripts:** PHP, Bash, Shell, PowerShell as needed
- **Comments/docs:** Czech (this is a Czech project)

### Project Structure Notes

**Key Directories:**
- `ivy/` - Main Node.js application code
- `web/` - PHP web dashboard and API
- `scripts/` - System maintenance and setup scripts
- `web/restricted/` - Database setup scripts and sensitive configs

**Important Files:**
- Never commit `sql_config.json` files (contain database credentials)
- `package.json` version is auto-updated by git hooks
- Git hooks automatically manage versioning in `scripts/pre-commit` and `scripts/post-commit`

### ESM Module System
The project uses modern ESM modules (`"type": "module"`) throughout. All imports use explicit file extensions (.js).

### Version Management
- Version tracking through git commit hashes in `package.json`
- Database version validation prevents client/server version mismatches
- Automatic version updates via git hooks

## Security Notes

This is a defensive automation tool for legitimate social media account management. The system includes safeguards for human-like behavior to avoid platform detection while remaining compliant with terms of service for legitimate business use cases.