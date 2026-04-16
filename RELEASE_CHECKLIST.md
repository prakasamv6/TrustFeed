# Release Checklist

Use this checklist before promoting changes to main and triggering deployment.

## 1. Scope and change control

- Confirm release scope and impacted areas (SurveyApp, AugmentedDoing, CI, docs).
- Confirm no unrelated files are included.
- Confirm rollback approach is documented for risky changes.

## 2. Required validation

- Run SurveyApp smoke check:
  - npm --prefix SurveyApp run smoke
- If CI parsing behavior changed, also run:
  - npm --prefix SurveyApp run smoke:json
- Verify smoke output includes SMOKE_RESULT_JSON marker when JSON mode is used.
- Verify server tests pass:
  - npm --prefix SurveyApp/server test

## 3. Dataset contract verification

- Confirm dataset readiness endpoint returns ready true.
- Confirm content endpoint returns 14 items when count is 14.
- Confirm balanced AI and human representation is preserved.
- Confirm continent metadata and dataset source labels are present.

## 4. Governance and review

- Confirm pull request template checklist is completed.
- Confirm required CI status check passes:
  - SurveyApp Smoke Check / smoke
- Confirm code owner approval is present:
  - .github/CODEOWNERS maps ownership to @prakasamv6

## 5. Deployment readiness

- Confirm deployment variables are set for target environment.
- Confirm database connectivity expectation is understood for the target environment.
- Confirm post-deploy health checks are prepared.

## 6. Post-deploy verification

- Check API health endpoint.
- Check dataset health endpoint.
- Open SurveyApp landing screen and verify dataset readiness indicator.
- Start a survey session and verify content loads with expected metadata.
- Confirm CI workflow status is green for the deployed commit.

## 7. Record keeping

- Document release date, commit SHA, and environment.
- Document any manual interventions.
- Document any follow-up actions.
