# SurveyApp

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 17.3.17.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Smoke check (API + dataset readiness)

Run `npm run smoke` from the `SurveyApp` folder.

For CI parsing, run `npm run smoke:json`.
The script emits a machine-readable line prefixed with `SMOKE_RESULT_JSON:` that includes pass/fail, step status, and endpoint summaries.

GitHub Actions workflow: `.github/workflows/survey-smoke.yml`
- Runs on pull requests and pushes that touch `SurveyApp/**`.
- Executes `npm run smoke:json` and fails if `ok` is false in the emitted JSON.

## Recommended branch protection (main)

In GitHub: `Settings > Branches > Add rule` for `main`.

Enable:
- Require a pull request before merging
- Require approvals (at least 1)
- Require status checks to pass before merging
- Require branches to be up to date before merging

Under required status checks, select:
- `SurveyApp Smoke Check / smoke`

Contributor checklist template: `.github/pull_request_template.md`
Code owners: `.github/CODEOWNERS` assigns all repository paths to `@prakasamv6`.
Repository contribution guide: `CONTRIBUTING.md`

This ensures no PR can merge to `main` unless the dataset readiness smoke contract passes in CI.

This command will:
- Run backend tests in `server`.
- Start the API on an isolated local port.
- Verify `/api/health`, `/api/dataset-health`, and `/api/content/fetch?count=14` contracts.
- Assert dataset-backed items include required metadata (continent, source, content type, ground truth).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
