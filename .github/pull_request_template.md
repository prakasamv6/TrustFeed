## Summary

Describe the problem and the approach used in this PR.

## Validation Checklist

- [ ] I ran relevant local tests for changed areas.
- [ ] If SurveyApp code was changed, I ran `npm --prefix SurveyApp run smoke`.
- [ ] If CI parsing behavior was changed, I ran `npm --prefix SurveyApp run smoke:json` and confirmed `SMOKE_RESULT_JSON` output.
- [ ] I verified dataset-backed survey behavior remains intact (continent metadata, source labels, and AI/human balancing).
- [ ] I updated docs for any command, workflow, or policy changes.

## Scope

- [ ] `SurveyApp`
- [ ] `AugmentedDoing`
- [ ] `Deployment / CI`
- [ ] `Docs only`

## Risk Notes

List any behavior changes, migration concerns, or rollback notes.
