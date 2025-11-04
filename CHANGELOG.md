# Changelog

**Purpose:** Track completed features, bug fixes, and changes across all development sessions.

**Format:** Follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- Initial project documentation structure
  - PROJECT_SPEC.md - Complete architecture specification
  - AGENT_GUIDELINES.md - Behavioral rules and quality standards
  - TOOLS_AND_EXTENSIONS.md - Required tooling and verification
  - ARCHITECTURE_DECISIONS.md - Technical decision records (10 ADRs)
  - DEVELOPMENT_WORKFLOW.md - Git workflow and deployment procedures
  - CHANGELOG.md - This file
  - PROGRESS.md - Phase tracking and status
  - .cursorrules - Cursor IDE configuration

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

---

## How to Update This File

At the end of every development session, add your changes under the `[Unreleased]` section using these categories:

### Categories

- **Added** - New features, files, or capabilities
- **Changed** - Changes to existing functionality
- **Deprecated** - Features that will be removed in future versions
- **Removed** - Removed features or files
- **Fixed** - Bug fixes
- **Security** - Security improvements or vulnerability fixes

### Format

```markdown
### Added
- Description of what was added (with references if applicable)

### Fixed
- Description of bug fix (Closes #issue-number)
```

### Example Entry

```markdown
## [Unreleased]

### Added
- Shopify orders sync via Bulk Operations API (refs: PROJECT_SPEC.md section 6)
  - Implemented `apps/worker/src/integrations/shopify.ts`
  - Added `staging_ingest.shopify_orders_raw` table
  - Added transform to `core_warehouse.orders`

### Fixed
- ETL cursor not advancing on successful sync (Closes #23)
  - Updated `apps/worker/src/jobs/complete.ts` to only advance cursor on SUCCEEDED status
```

---

## Version Release Process

When releasing a version (e.g., after completing a phase):

1. Move items from `[Unreleased]` to a new version section:

```markdown
## [0.1.0] - 2025-01-10

### Added
- Database schema (Phase 1 complete)
- All staging_ingest, core_warehouse, and reporting tables
- Migrations applied to production

[Link to release](https://github.com/yourorg/yourrepo/releases/tag/v0.1.0)
```

2. Update version number in relevant files:
   - `apps/web/package.json`
   - `apps/worker/package.json`
   - `PROJECT_SPEC.md` (version at top)

3. Create Git tag:
```bash
git tag -a v0.1.0 -m "Release: Phase 1 - Database Schema Complete"
git push origin v0.1.0
```

---

## Version History

(Versions will be added here as phases complete)

### Phase Completion Milestones

- **v0.1.0** - Phase 1: Database Schema & Migrations (Target: TBD)
- **v0.2.0** - Phase 2: Edge Function - /sync API (Target: TBD)
- **v0.3.0** - Phase 3: Worker Foundation (Target: TBD)
- **v0.4.0** - Phase 4: Shopify Integration (Target: TBD)
- **v0.5.0** - Phase 5: Marketing Integrations (Target: TBD)
- **v0.6.0** - Phase 6: Frontend - Next.js Dashboard (Target: TBD)
- **v0.7.0** - Phase 7: Deployment & CI/CD (Target: TBD)
- **v1.0.0** - Phase 8: Production Hardening (Target: TBD)

---

## References

- [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
- [Semantic Versioning](https://semver.org/)
- [PROJECT_SPEC.md](./PROJECT_SPEC.md)
- [PROGRESS.md](./PROGRESS.md)

---

**End of CHANGELOG.md**
