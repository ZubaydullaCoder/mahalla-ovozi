# Data Retention Policy

**System:** Mahalla Ovozi
**Target:** Epic 9 contextual topic pipeline
**Effective date:** 18 July 2026
**Audience:** Owner, developer, operator

## 1. Principles

- Retain only what the approved topic and repair flows require.
- Use Telegram timestamp for evidence-age rules.
- Keep resident content out of logs and pipeline events.
- Permit irrelevant-message promotion only during its 24-hour text window.
- Regenerate topic-derived state when evidence expires.
- Do not let backups silently extend approved retention.
- Require action-time confirmation for destructive test-data reset.

## 2. Retention Schedule

| Data | Retention |
|---|---:|
| Attached topic evidence | 90 days from Telegram timestamp |
| Irrelevant message full text | 24 hours from final disposition |
| Irrelevant content-free metadata | 14 days |
| Dead-lettered captured message | 7 days after dead-lettering |
| Content-free pipeline events | 14 days |
| Triage/batch health metrics | 60 days |
| Topic and summary | Until final retained evidence expires |
| Sessions | Existing 7-day store TTL |
| Hokim keyword registry | Until manually disabled or deleted |
| District, mahalla, and user master data | Until authorized administrative deletion |

Legacy `raw_messages` and `signal_messages` remain historical implementation
data during additive Epic 9 foundation stories. Their test-only cleanup occurs
only at the approved Story 9.10 cutover.

## 3. Irrelevant Promotion Window

An irrelevant message may retain full text for 24 hours so a later explicit
reply or follow-up can clarify it.

Promotion must:

- occur before text expiry;
- use same-district and same-mahalla context;
- attach atomically;
- preserve source identity;
- record content-free audit metadata.

If no clarification arrives, purge the text after 24 hours. The remaining
metadata must not permit reconstruction of resident content.

## 4. Evidence Purge

Evidence purge is application-domain logic, not blind independent SQL.

For each expired attached message:

1. remove the evidence membership and resident content;
2. regenerate the topic summary from remaining evidence;
3. regenerate equal categories;
4. regenerate distinct-resident attribution;
5. choose the latest self-contained remaining anchor;
6. recalculate the Hokim flag from active retained keyword evidence;
7. update first/latest activity where needed;
8. remove the topic when no retained evidence remains.

The operation must be transactional or safely resumable and idempotent.

## 5. Daily Maintenance

Run retention after the nightly backup has completed and been verified.
Recommended schedule: 03:00 deployment-local time.

The maintenance job reports content-free counts:

- irrelevant texts purged;
- irrelevant metadata purged;
- dead letters purged;
- evidence rows purged;
- topics regenerated;
- topics removed;
- events and metrics purged;
- failures and duration.

Do not emit source text, summaries, sender names, prompts, or provider output in
maintenance logs.

## 6. Backup Alignment

Backup retention must be no longer than the data windows above unless the owner
explicitly approves a documented exception.

Required controls:

- encrypt backup storage;
- restrict access;
- expire daily backups within seven days;
- avoid indefinite weekly archives containing resident evidence;
- document whether a pre-migration snapshot contains resident data;
- delete expired snapshots after the recovery need ends;
- verify off-site copies follow the same lifecycle.

A restore may reintroduce expired data. Before reopening the application after
restore, run migrations and the retention job against the restored state.

## 7. Administrative Deletion

Mahalla or user deletion must cascade through:

- captured messages;
- topic memberships;
- topics that lose final evidence;
- applicable pipeline and health metadata;
- sessions and account data where authorized.

Before manual deletion:

1. identify the exact district/mahalla/user scope;
2. preview affected counts;
3. determine whether a backup is appropriate and permitted;
4. obtain action-time confirmation;
5. execute one scoped transaction;
6. verify resulting counts and derived topic state.

Do not use a broad database reset.

## 8. Review

Review this policy:

- before pilot activation;
- after schema changes affecting retained content;
- after a legal or owner policy change;
- after restore or retention failure;
- at least every six months.
