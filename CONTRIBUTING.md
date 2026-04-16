# Contributing Guide

## Repository ownership

- Code owner: @prakasamv6
- CODEOWNERS file: .github/CODEOWNERS
- Pull requests should be reviewed and approved by the code owner before merge.

## Pull request workflow

1. Create a feature branch from main.
2. Make focused changes and include docs updates when behavior or policy changes.
3. Run validation locally before opening a PR.
4. Open a PR and complete all checklist items in .github/pull_request_template.md.
5. Wait for CI checks and code owner approval.

## Required local validation for SurveyApp changes

Run from repository root:

- npm --prefix SurveyApp run smoke
- npm --prefix SurveyApp run smoke:json (required when CI parsing or smoke JSON behavior changes)

Expected smoke JSON marker in output:

- SMOKE_RESULT_JSON:{...}

## Required CI check before merge to main

- Workflow: .github/workflows/survey-smoke.yml
- Required status check: SurveyApp Smoke Check / smoke

## Branch protection recommendation for main

Enable the following in GitHub branch rules:

- Require a pull request before merging
- Require approvals (at least 1)
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Require review from Code Owners

## Commit guidance

- Keep commits small and scoped.
- Use descriptive commit messages that explain intent.
- Avoid mixing unrelated refactors with functional fixes.

## Release preparation

- Before final merge and deployment, run the root release checklist in RELEASE_CHECKLIST.md.
- For tracked releases, open a GitHub issue using .github/ISSUE_TEMPLATE/release-preparation.yml.
