# API Endpoints – Part 1
All paths are mounted under the `/api` prefix (see `server/src/app.js`).

## abstract

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| GET | /events/:eventId/abstracts/:id | src\routes\abstract.routes.js |
| GET | /events/:eventId/abstracts/all-event-abstracts | src\routes\abstract.routes.js |
| POST | /events/:eventId/abstracts/assign-reviewers | src\routes\abstract.routes.js |
| GET | /events/:eventId/abstracts/download | src\routes\abstract.routes.js |

## abstractAuthors

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| GET | /events/:eventId/abstract-authors | src\routes\abstractAuthors.routes.js |

## abstracts

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| DELETE | / | src\routes\abstracts.routes.js |
| PUT | / | src\routes\abstracts.routes.js |
| GET | / | src\routes\abstracts.routes.js |
| POST | / | src\routes\abstracts.routes.js |
| POST | /:id | src\routes\abstracts.routes.js |
| DELETE | /:id | src\routes\abstracts.routes.js |
| PUT | /:id | src\routes\abstracts.routes.js |
| GET | /:id | src\routes\abstracts.routes.js |
| DELETE | /:id/approve | src\routes\abstracts.routes.js |
| GET | /:id/approve | src\routes\abstracts.routes.js |
| POST | /:id/approve | src\routes\abstracts.routes.js |
| PUT | /:id/approve | src\routes\abstracts.routes.js |
| DELETE | /:id/assign-reviewer | src\routes\abstracts.routes.js |
| GET | /:id/assign-reviewer | src\routes\abstracts.routes.js |
| PUT | /:id/assign-reviewer | src\routes\abstracts.routes.js |
| POST | /:id/assign-reviewer | src\routes\abstracts.routes.js |
| DELETE | /:id/comments | src\routes\abstracts.routes.js |
| GET | /:id/comments | src\routes\abstracts.routes.js |
| PUT | /:id/comments | src\routes\abstracts.routes.js |
| POST | /:id/comments | src\routes\abstracts.routes.js |
| PUT | /:id/download-attachment | src\routes\abstracts.routes.js |
| POST | /:id/download-attachment | src\routes\abstracts.routes.js |
| GET | /:id/download-attachment | src\routes\abstracts.routes.js |
| PUT | /:id/file | src\routes\abstracts.routes.js |
| POST | /:id/file | src\routes\abstracts.routes.js |
| POST | /:id/final-file | src\routes\abstracts.routes.js |
| PUT | /:id/registration-proof | src\routes\abstracts.routes.js |
| POST | /:id/registration-proof | src\routes\abstracts.routes.js |
| DELETE | /:id/reject | src\routes\abstracts.routes.js |
| GET | /:id/reject | src\routes\abstracts.routes.js |
| POST | /:id/reject | src\routes\abstracts.routes.js |
| PUT | /:id/reject | src\routes\abstracts.routes.js |
| DELETE | /:id/request-revision | src\routes\abstracts.routes.js |
| GET | /:id/request-revision | src\routes\abstracts.routes.js |
| POST | /:id/request-revision | src\routes\abstracts.routes.js |
| PUT | /:id/request-revision | src\routes\abstracts.routes.js |
| DELETE | /:id/resubmit-revision | src\routes\abstracts.routes.js |
| PUT | /:id/resubmit-revision | src\routes\abstracts.routes.js |
| GET | /:id/resubmit-revision | src\routes\abstracts.routes.js |
| POST | /:id/resubmit-revision | src\routes\abstracts.routes.js |
| DELETE | /:id/review | src\routes\abstracts.routes.js |
| GET | /:id/review | src\routes\abstracts.routes.js |
| PUT | /:id/review | src\routes\abstracts.routes.js |
| POST | /:id/review | src\routes\abstracts.routes.js |
| DELETE | /:id/reviews | src\routes\abstracts.routes.js |
| GET | /:id/reviews | src\routes\abstracts.routes.js |
| PUT | /:id/reviews | src\routes\abstracts.routes.js |
| POST | /:id/reviews | src\routes\abstracts.routes.js |
| DELETE | /:id/status | src\routes\abstracts.routes.js |
| GET | /:id/status | src\routes\abstracts.routes.js |
| POST | /:id/status | src\routes\abstracts.routes.js |
| PUT | /:id/status | src\routes\abstracts.routes.js |
| POST | /:id/verify-registration | src\routes\abstracts.routes.js |
| PUT | /:id/verify-registration | src\routes\abstracts.routes.js |
| DELETE | /all-event-abstracts | src\routes\abstracts.routes.js |
| POST | /all-event-abstracts | src\routes\abstracts.routes.js |
| PUT | /all-event-abstracts | src\routes\abstracts.routes.js |
| GET | /all-event-abstracts | src\routes\abstracts.routes.js |
| POST | /auto-assign-reviewers | src\routes\abstracts.routes.js |
| DELETE | /by-registration/:registrationId | src\routes\abstracts.routes.js |
| PUT | /by-registration/:registrationId | src\routes\abstracts.routes.js |
| POST | /by-registration/:registrationId | src\routes\abstracts.routes.js |
| GET | /by-registration/:registrationId | src\routes\abstracts.routes.js |
| DELETE | /download | src\routes\abstracts.routes.js |
| POST | /download | src\routes\abstracts.routes.js |
| PUT | /download | src\routes\abstracts.routes.js |
| GET | /download | src\routes\abstracts.routes.js |
| DELETE | /pending-review-progress | src\routes\abstracts.routes.js |
| POST | /pending-review-progress | src\routes\abstracts.routes.js |
| PUT | /pending-review-progress | src\routes\abstracts.routes.js |
| GET | /pending-review-progress | src\routes\abstracts.routes.js |
| DELETE | /statistics | src\routes\abstracts.routes.js |
| POST | /statistics | src\routes\abstracts.routes.js |
| PUT | /statistics | src\routes\abstracts.routes.js |
| GET | /statistics | src\routes\abstracts.routes.js |

## adminSettings

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| PUT | / | src\routes\adminSettings.routes.js |
| GET | / | src\routes\adminSettings.routes.js |
| PUT | /event-settings/:eventId/:tab | src\routes\adminSettings.routes.js |
| GET | /event-settings/:eventId/:tab | src\routes\adminSettings.routes.js |
| GET | /event-settings/:eventId/tabs | src\routes\adminSettings.routes.js |
| POST | /sponsor-admin | src\routes\adminSettings.routes.js |
| PUT | /user-permissions/:userId | src\routes\adminSettings.routes.js |

## analytics

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| GET | /:eventId/abstracts | src\routes\analytics.routes.js |
| GET | /:eventId/export/:type | src\routes\analytics.routes.js |
| GET | /:eventId/financial | src\routes\analytics.routes.js |
| GET | /:eventId/registration | src\routes\analytics.routes.js |
| GET | /:eventId/sponsors | src\routes\analytics.routes.js |
| GET | /:eventId/workshops | src\routes\analytics.routes.js |

## announcementRoutes

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| DELETE | / | src\routes\announcementRoutes.js |
| PUT | / | src\routes\announcementRoutes.js |
| GET | / | src\routes\announcementRoutes.js |
| POST | / | src\routes\announcementRoutes.js |
| DELETE | /:announcementId | src\routes\announcementRoutes.js |
| PUT | /:announcementId | src\routes\announcementRoutes.js |
| GET | /:announcementId | src\routes\announcementRoutes.js |

## auth

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| POST | /login | src\routes\auth.routes.js |
| POST | /logout | src\routes\auth.routes.js |
| GET | /me | src\routes\auth.routes.js |
| POST | /refresh-token | src\routes\auth.routes.js |
| POST | /register | src\routes\auth.routes.js |
| GET | /roles | src\routes\auth.routes.js |
| POST | /users | src\routes\auth.routes.js |
| GET | /users | src\routes\auth.routes.js |
| GET | /users/:id | src\routes\auth.routes.js |
| PATCH | /users/:id/status | src\routes\auth.routes.js |

## authorAuth

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| POST | /login | src\routes\authorAuth.routes.js |
| POST | /signup | src\routes\authorAuth.routes.js |

## backup

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| POST | / | src\routes\backup.routes.js |
| GET | / | src\routes\backup.routes.js |

## badge-templates

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| DELETE | / | src\routes\badge-templates.routes.js |
| PUT | / | src\routes\badge-templates.routes.js |
| POST | / | src\routes\badge-templates.routes.js |
| GET | / | src\routes\badge-templates.routes.js |
| POST | /:eventId/:templateId/set-default | src\routes\badge-templates.routes.js |
| POST | /:id | src\routes\badge-templates.routes.js |
| DELETE | /:id | src\routes\badge-templates.routes.js |
| PUT | /:id | src\routes\badge-templates.routes.js |
| GET | /:id | src\routes\badge-templates.routes.js |
| POST | /:id/duplicate | src\routes\badge-templates.routes.js |
| GET | /test | src\routes\badge-templates.routes.js |

## badgeTemplate

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| DELETE | / | src\routes\badgeTemplate.routes.js |
| PUT | / | src\routes\badgeTemplate.routes.js |
| POST | / | src\routes\badgeTemplate.routes.js |
| GET | / | src\routes\badgeTemplate.routes.js |
| POST | /:id | src\routes\badgeTemplate.routes.js |
| DELETE | /:id | src\routes\badgeTemplate.routes.js |
| PUT | /:id | src\routes\badgeTemplate.routes.js |
| GET | /:id | src\routes\badgeTemplate.routes.js |
| POST | /:id/duplicate | src\routes\badgeTemplate.routes.js |

## categories

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| GET | / | src\routes\categories.routes.js |
| DELETE | /:id | src\routes\categories.routes.js |
| PUT | /:id | src\routes\categories.routes.js |
| GET | /:id | src\routes\categories.routes.js |
| PUT | /:id/permissions | src\routes\categories.routes.js |
| DELETE | /event/:eventId | src\routes\categories.routes.js |
| PUT | /event/:eventId | src\routes\categories.routes.js |
| POST | /event/:eventId | src\routes\categories.routes.js |
| GET | /event/:eventId | src\routes\categories.routes.js |

## clientBulkImport

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| GET | /import-jobs/:jobId/status | src\routes\clientBulkImport.routes.js |
| POST | /registrants | src\routes\clientBulkImport.routes.js |

## clientPortal

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| POST | /admin/event-clients | src\routes\clientPortal.routes.js |
| GET | /admin/event-clients | src\routes\clientPortal.routes.js |
| DELETE | /admin/event-clients/:id | src\routes\clientPortal.routes.js |
| PUT | /admin/event-clients/:id | src\routes\clientPortal.routes.js |
| POST | /admin/event-clients/:id/reset-password | src\routes\clientPortal.routes.js |
| POST | /auth/login | src\routes\clientPortal.routes.js |
| POST | /auth/logout | src\routes\clientPortal.routes.js |
| GET | /me/abstracts | src\routes\clientPortal.routes.js |
| GET | /me/analytics | src\routes\clientPortal.routes.js |
| GET | /me/categories | src\routes\clientPortal.routes.js |
| GET | /me/dashboard | src\routes\clientPortal.routes.js |
| GET | /me/payments | src\routes\clientPortal.routes.js |
| GET | /me/recent | src\routes\clientPortal.routes.js |
| POST | /me/registrants | src\routes\clientPortal.routes.js |
| GET | /me/registrants | src\routes\clientPortal.routes.js |
| POST | /me/registrants/bulk-import | src\routes\clientPortal.routes.js |
| GET | /me/registrants/export | src\routes\clientPortal.routes.js |
| GET | /me/reports | src\routes\clientPortal.routes.js |
| GET | /me/reports/export | src\routes\clientPortal.routes.js |
| GET | /me/sponsors | src\routes\clientPortal.routes.js |
| GET | /me/workshops | src\routes\clientPortal.routes.js |

## customField

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| POST | / | src\routes\v1\customField.routes.js |
| DELETE | / | src\routes\customField.routes.js |
| PUT | / | src\routes\customField.routes.js |
| POST | / | src\routes\customField.routes.js |
| GET | / | src\routes\customField.routes.js |
| DELETE | /:id | src\routes\v1\customField.routes.js |
| PUT | /:id | src\routes\v1\customField.routes.js |
| GET | /:id | src\routes\v1\customField.routes.js |
| DELETE | /:id | src\routes\customField.routes.js |
| PUT | /:id | src\routes\customField.routes.js |
| GET | /:id | src\routes\customField.routes.js |
| GET | /event/:eventId | src\routes\v1\customField.routes.js |

## dashboard

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| PUT | /events/:eventId | src\routes\dashboard.routes.js |
| GET | /events/:eventId | src\routes\dashboard.routes.js |
| GET | /events/:eventId/widgets | src\routes\dashboard.routes.js |
| GET | /events/:eventId/widgets/:widgetId/data | src\routes\dashboard.routes.js |
| GET | /events/:id/dashboard | src\routes\dashboard.routes.js |

## debug

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| GET | /env | src\routes\debug.routes.js |
| GET | /health | src\routes\debug.routes.js |

## email

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| POST | /brochure | src\routes\email.routes.js |
| POST | /certificate-template | src\routes\email.routes.js |
| GET | /certificates/validate/:certificateId | src\routes\email.routes.js |
| GET | /history | src\routes\email.routes.js |
| GET | /history-debug | src\routes\email.routes.js |
| POST | /preview | src\routes\email.routes.js |
| POST | /recipients | src\routes\email.routes.js |
| POST | /send | src\routes\email.routes.js |
| PUT | /smtp-settings | src\routes\email.routes.js |
| GET | /templates | src\routes\email.routes.js |
| PUT | /templates/:templateKey | src\routes\email.routes.js |
| POST | /test-smtp | src\routes\email.routes.js |

## event

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| DELETE | / | src\routes\event.routes.js |
| PUT | / | src\routes\event.routes.js |
| POST | / | src\routes\event.routes.js |
| GET | / | src\routes\event.routes.js |
| GET | /:eventId/abstract-workflow/reviewers | src\routes\event.routes.js |
| PUT | /:eventId/registrations/counts-by-category | src\routes\event.routes.js |
| GET | /:eventId/registrations/counts-by-category | src\routes\event.routes.js |
| GET | /:eventId/users | src\routes\event.routes.js |
| DELETE | /:id | src\routes\event.routes.js |
| PUT | /:id | src\routes\event.routes.js |
| GET | /:id | src\routes\event.routes.js |
| DELETE | /:id/abstract-settings | src\routes\event.routes.js |
| POST | /:id/abstract-settings | src\routes\event.routes.js |
| GET | /:id/abstract-settings | src\routes\event.routes.js |
| PUT | /:id/abstract-settings | src\routes\event.routes.js |
| PUT | /:id/badge-settings | src\routes\event.routes.js |
| GET | /:id/badge-settings | src\routes\event.routes.js |
| PUT | /:id/dashboard | src\routes\event.routes.js |
| GET | /:id/dashboard | src\routes\event.routes.js |
| GET | /:id/publish | src\routes\event.routes.js |
| PUT | /:id/publish | src\routes\event.routes.js |
| GET | /:id/resource-config | src\routes\event.routes.js |
| PUT | /:id/stats | src\routes\event.routes.js |
| GET | /:id/stats | src\routes\event.routes.js |
| GET | /:id/unpublish | src\routes\event.routes.js |
| PUT | /:id/unpublish | src\routes\event.routes.js |

## events

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| DELETE | / | src\routes\events.routes.js |
| PUT | / | src\routes\events.routes.js |
| POST | / | src\routes\events.routes.js |
| GET | / | src\routes\events.routes.js |
| GET | /:eventId/abstract-authors | src\routes\events.routes.js |
| GET | /:eventId/abstract-authors/export | src\routes\events.routes.js |
| GET | /:eventId/public-registrations | src\routes\events.routes.js |
| POST | /:eventId/public-registrations | src\routes\events.routes.js |
| POST | /:id | src\routes\events.routes.js |
| DELETE | /:id | src\routes\events.routes.js |
| PUT | /:id | src\routes\events.routes.js |
| GET | /:id | src\routes\events.routes.js |
| POST | /:id/abstract-settings | src\routes\events.routes.js |
| PUT | /:id/abstract-settings | src\routes\events.routes.js |
| GET | /:id/abstract-settings | src\routes\events.routes.js |
| POST | /:id/badge-settings | src\routes\events.routes.js |
| PUT | /:id/badge-settings | src\routes\events.routes.js |
| GET | /:id/badge-settings | src\routes\events.routes.js |
| PUT | /:id/categories | src\routes\events.routes.js |
| POST | /:id/categories | src\routes\events.routes.js |
| GET | /:id/categories | src\routes\events.routes.js |
| PUT | /:id/dashboard | src\routes\events.routes.js |
| POST | /:id/dashboard | src\routes\events.routes.js |
| GET | /:id/dashboard | src\routes\events.routes.js |
| POST | /:id/email-settings | src\routes\events.routes.js |
| PUT | /:id/email-settings | src\routes\events.routes.js |
| GET | /:id/email-settings | src\routes\events.routes.js |
| POST | /:id/portal-settings | src\routes\events.routes.js |
| PUT | /:id/portal-settings | src\routes\events.routes.js |
| GET | /:id/portal-settings | src\routes\events.routes.js |
| POST | /:id/public-categories | src\routes\events.routes.js |
| GET | /:id/public-categories | src\routes\events.routes.js |
| PUT | /:id/resource-config | src\routes\events.routes.js |
| POST | /:id/resource-config | src\routes\events.routes.js |
| GET | /:id/resource-config | src\routes\events.routes.js |
| GET | /:id/resources/export | src\routes\events.routes.js |
| GET | /:id/resources/statistics | src\routes\events.routes.js |
| PUT | /:id/stats | src\routes\events.routes.js |
| POST | /:id/stats | src\routes\events.routes.js |
| GET | /:id/stats | src\routes\events.routes.js |

## importJob

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| GET | /:jobId/status | src\routes\importJob.routes.js |

## landingPages

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| DELETE | / | src\routes\landingPages.routes.js |
| PATCH | / | src\routes\landingPages.routes.js |
| POST | / | src\routes\landingPages.routes.js |
| GET | / | src\routes\landingPages.routes.js |
| POST | /:id | src\routes\landingPages.routes.js |
| DELETE | /:id | src\routes\landingPages.routes.js |
| PATCH | /:id | src\routes\landingPages.routes.js |
| GET | /:id | src\routes\landingPages.routes.js |
| GET | /:id/preview | src\routes\landingPages.routes.js |
| POST | /:id/publish | src\routes\landingPages.routes.js |
| POST | /:id/restore/:versionId | src\routes\landingPages.routes.js |
| POST | /import-html | src\routes\landingPages.routes.js |
