# Tools and Extensions

**Version:** 1.0.0
**Last Updated:** 2025-01-04
**Purpose:** Complete inventory of required CLI tools, extensions, and verification commands

---

## Pre-Flight Checklist

Before starting ANY development work, verify ALL tools are installed and working:

- [ ] Node.js (v18+)
- [ ] Package manager (pnpm/yarn/npm)
- [ ] Git CLI
- [ ] Supabase CLI
- [ ] Vercel CLI
- [ ] Railway CLI
- [ ] TypeScript
- [ ] PostgreSQL client (psql) - optional but recommended
- [ ] curl or similar HTTP client

**Verification Command:** Run the commands in the "Quick Verify" section below.

---

## Required CLI Tools

### 1. Node.js

**Purpose:** JavaScript/TypeScript runtime for all apps

**Minimum Version:** 18.x (LTS recommended: 20.x)

**Install:**
- Windows: Download from [nodejs.org](https://nodejs.org/) or use `winget install OpenJS.NodeJS.LTS`
- macOS: `brew install node`
- Linux: `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs`

**Verify:**
```bash
node --version
# Expected: v18.x.x or higher
```

---

### 2. Package Manager (pnpm recommended)

**Purpose:** Install and manage JavaScript dependencies

**Recommended:** pnpm (faster, more efficient than npm/yarn)

**Install:**
```bash
npm install -g pnpm
```

**Alternatives:**
- npm (comes with Node.js): `npm --version`
- yarn: `npm install -g yarn`

**Verify:**
```bash
pnpm --version
# Expected: 8.x.x or higher
```

---

### 3. Git CLI

**Purpose:** Version control

**Minimum Version:** 2.x

**Install:**
- Windows: Download from [git-scm.com](https://git-scm.com/) or use `winget install Git.Git`
- macOS: `brew install git`
- Linux: `sudo apt-get install git`

**Verify:**
```bash
git --version
# Expected: git version 2.x.x
```

**Configuration (first-time setup):**
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

### 4. Supabase CLI

**Purpose:** Local development, migrations, Edge Functions, database management

**Minimum Version:** 1.x

**Install:**
- Windows: `scoop install supabase` or download from [GitHub Releases](https://github.com/supabase/cli/releases)
- macOS: `brew install supabase/tap/supabase`
- Linux: `curl -fsSL https://github.com/supabase/cli/releases/download/v1.x.x/supabase_linux_amd64.tar.gz | tar -xz -C /usr/local/bin`

**Verify:**
```bash
supabase --version
# Expected: 1.x.x or higher
```

**Login (one-time):**
```bash
supabase login
# Opens browser for authentication
```

**Key Commands:**
- `supabase start` - Start local Supabase stack (Postgres, Realtime, etc.)
- `supabase stop` - Stop local stack
- `supabase migration new <name>` - Create new migration file
- `supabase db push` - Apply migrations to remote
- `supabase functions new <name>` - Create new Edge Function
- `supabase functions deploy <name>` - Deploy Edge Function
- `supabase link --project-ref <ref>` - Link to remote project

**Documentation:** [Supabase CLI Docs](https://supabase.com/docs/guides/cli)

---

### 5. Vercel CLI

**Purpose:** Deploy frontend (apps/web), manage environment variables, logs, DNS

**Minimum Version:** Latest

**Install:**
```bash
npm install -g vercel
```

**Verify:**
```bash
vercel --version
# Expected: Vercel CLI x.x.x
```

**Login (one-time):**
```bash
vercel login
# Opens browser for authentication
```

**Key Commands:**
- `vercel` - Deploy current directory
- `vercel dev` - Run local development server with Vercel environment
- `vercel env ls` - List environment variables
- `vercel env add <name>` - Add environment variable
- `vercel logs <deployment-url>` - View logs
- `vercel link` - Link local directory to Vercel project

**Documentation:** [Vercel CLI Docs](https://vercel.com/docs/cli)

---

### 6. Railway CLI

**Purpose:** Deploy worker (apps/worker), manage cron jobs, logs, environment variables

**Minimum Version:** Latest

**Install:**
```bash
npm install -g @railway/cli
```

OR

```bash
# macOS/Linux
curl -fsSL https://railway.app/install.sh | sh

# Windows
iwr https://railway.app/install.ps1 | iex
```

**Verify:**
```bash
railway --version
# Expected: railway version x.x.x
```

**Login (one-time):**
```bash
railway login
# Opens browser for authentication
```

**Key Commands:**
- `railway init` - Initialize Railway project
- `railway link` - Link local directory to Railway project
- `railway up` - Deploy current directory
- `railway run <command>` - Run command with Railway environment
- `railway logs` - View logs
- `railway variables` - Manage environment variables
- `railway status` - Check deployment status

**Documentation:** [Railway CLI Docs](https://docs.railway.app/develop/cli)

---

### 7. TypeScript

**Purpose:** Type-safe JavaScript for all code

**Minimum Version:** 5.x

**Install:**
```bash
npm install -g typescript
```

**Verify:**
```bash
tsc --version
# Expected: Version 5.x.x
```

**Note:** TypeScript is typically installed per-project (not globally), but global install is useful for CLI access.

---

### 8. PostgreSQL Client (psql) - Optional

**Purpose:** Direct database access for debugging, manual queries

**Minimum Version:** 14.x

**Install:**
- Windows: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
- macOS: `brew install postgresql`
- Linux: `sudo apt-get install postgresql-client`

**Verify:**
```bash
psql --version
# Expected: psql (PostgreSQL) 14.x or higher
```

**Connect to Supabase:**
```bash
psql "postgresql://postgres.[region].supabase.co:5432/postgres?sslmode=require" -U postgres
# Password: from Supabase dashboard
```

---

### 9. curl or HTTP Client

**Purpose:** Test APIs, Edge Functions, webhooks

**Verify:**
```bash
curl --version
# Expected: curl x.x.x
```

**Alternatives:**
- HTTPie: `brew install httpie` / `pip install httpie`
- Postman (GUI)
- Thunder Client (VS Code extension)
- Insomnia (GUI)

---

## Optional but Recommended

### GitHub CLI (gh)

**Purpose:** Manage pull requests, issues, repos from terminal

**Install:**
- Windows: `winget install GitHub.cli`
- macOS: `brew install gh`
- Linux: [GitHub CLI Installation](https://github.com/cli/cli#installation)

**Verify:**
```bash
gh --version
# Expected: gh version x.x.x
```

**Login:**
```bash
gh auth login
```

**Key Commands:**
- `gh pr create` - Create pull request
- `gh pr list` - List pull requests
- `gh pr view <number>` - View PR details
- `gh repo view` - View repo info

---

### jq (JSON processor)

**Purpose:** Parse and filter JSON in terminal (useful for API responses)

**Install:**
- Windows: `winget install jqlang.jq`
- macOS: `brew install jq`
- Linux: `sudo apt-get install jq`

**Verify:**
```bash
jq --version
# Expected: jq-x.x
```

**Example:**
```bash
curl https://api.example.com/data | jq '.results[] | {id, name}'
```

---

## VS Code Extensions (if using VS Code)

**Recommended extensions for this project:**

1. **ESLint** (`dbaeumer.vscode-eslint`)
   - Linting for JavaScript/TypeScript

2. **Prettier** (`esbenp.prettier-vscode`)
   - Code formatting

3. **Supabase** (`supabase.supabase-vscode`)
   - Supabase integration (snippets, SQL highlighting)

4. **PostgreSQL** (`ckolkman.vscode-postgres`)
   - SQL syntax highlighting and execution

5. **Thunder Client** (`rangav.vscode-thunder-client`)
   - API testing within VS Code

6. **GitLens** (`eamodio.gitlens`)
   - Enhanced Git integration

7. **Error Lens** (`usernamehw.errorlens`)
   - Inline error highlighting

**Install all:**
```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension supabase.supabase-vscode
code --install-extension ckolkman.vscode-postgres
code --install-extension rangav.vscode-thunder-client
code --install-extension eamodio.gitlens
code --install-extension usernamehw.errorlens
```

---

## Cursor IDE Specific

If using Cursor IDE (recommended for this project):

1. **Set up `.cursorrules`** (see [.cursorrules](./.cursorrules) file)
2. **Enable TypeScript strict mode** in settings
3. **Configure Prettier as default formatter**
4. **Install Supabase extension** for SQL syntax highlighting

---

## Quick Verify (Run All Checks)

Copy and paste this script to verify all tools:

```bash
echo "Checking Node.js..." && node --version
echo "Checking pnpm..." && pnpm --version
echo "Checking Git..." && git --version
echo "Checking Supabase CLI..." && supabase --version
echo "Checking Vercel CLI..." && vercel --version
echo "Checking Railway CLI..." && railway --version
echo "Checking TypeScript..." && tsc --version
echo "Checking curl..." && curl --version
echo "Checking psql (optional)..." && psql --version
echo "Checking GitHub CLI (optional)..." && gh --version
echo "Checking jq (optional)..." && jq --version
echo "All checks complete!"
```

**Expected Output:**
```
Checking Node.js...
v20.x.x

Checking pnpm...
8.x.x

Checking Git...
git version 2.x.x

Checking Supabase CLI...
1.x.x

Checking Vercel CLI...
Vercel CLI x.x.x

Checking Railway CLI...
railway version x.x.x

Checking TypeScript...
Version 5.x.x

Checking curl...
curl x.x.x

Checking psql (optional)...
psql (PostgreSQL) 14.x

Checking GitHub CLI (optional)...
gh version x.x.x

Checking jq (optional)...
jq-x.x

All checks complete!
```

---

## Troubleshooting

### Tool not found after installation

**Problem:** Command not found after installing (e.g., `supabase: command not found`)

**Solution:**
1. Close and reopen terminal (PATH may need to reload)
2. Check installation path is in PATH: `echo $PATH` (macOS/Linux) or `echo %PATH%` (Windows)
3. Reinstall tool or add to PATH manually

### Permission denied (macOS/Linux)

**Problem:** `Permission denied` when running command

**Solution:**
```bash
# Make executable
chmod +x /path/to/command

# Or use sudo (if appropriate)
sudo <command>
```

### Node version mismatch

**Problem:** Project requires Node 18+ but system has older version

**Solution:** Use `nvm` (Node Version Manager)
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node 20
nvm install 20
nvm use 20
```

### Supabase CLI not starting local stack

**Problem:** `supabase start` fails with Docker errors

**Solution:**
1. Ensure Docker is installed and running
2. Check Docker has sufficient resources (at least 4GB RAM)
3. Run `supabase stop` then `supabase start` again

---

## Environment Setup Checklist

Before starting development:

- [ ] All required tools installed and verified
- [ ] Git configured with name and email
- [ ] Supabase CLI logged in (`supabase login`)
- [ ] Vercel CLI logged in (`vercel login`)
- [ ] Railway CLI logged in (`railway login`)
- [ ] VS Code/Cursor extensions installed
- [ ] `.env.local` file created (see PROJECT_SPEC.md section 9)
- [ ] Supabase project created and linked (`supabase link`)

---

## Documentation Links

- [Node.js Download](https://nodejs.org/)
- [pnpm Installation](https://pnpm.io/installation)
- [Git Installation](https://git-scm.com/downloads)
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Vercel CLI Docs](https://vercel.com/docs/cli)
- [Railway CLI Docs](https://docs.railway.app/develop/cli)
- [TypeScript Docs](https://www.typescriptlang.org/docs/)
- [PostgreSQL Downloads](https://www.postgresql.org/download/)

---

**End of TOOLS_AND_EXTENSIONS.md**
