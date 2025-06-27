# API Endpoints – Part 2
All paths are mounted under the `/api` prefix (see `server/src/app.js`).

## payments

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| GET | /:id | src\routes\payments.routes.js |
| GET | /:id/invoice | src\routes\payments.routes.js |
| GET | /:id/receipt | src\routes\payments.routes.js |
| POST | /:id/refund | src\routes\payments.routes.js |
| DELETE | /gateways | src\routes\payments.routes.js |
| PATCH | /gateways | src\routes\payments.routes.js |
| POST | /gateways | src\routes\payments.routes.js |
| GET | /gateways | src\routes\payments.routes.js |
| POST | /gateways/:id | src\routes\payments.routes.js |
| GET | /gateways/:id | src\routes\payments.routes.js |
| DELETE | /gateways/:id | src\routes\payments.routes.js |
| PATCH | /gateways/:id | src\routes\payments.routes.js |
| DELETE | /invoice-templates | src\routes\payments.routes.js |
| PATCH | /invoice-templates | src\routes\payments.routes.js |
| POST | /invoice-templates | src\routes\payments.routes.js |
| GET | /invoice-templates | src\routes\payments.routes.js |
| POST | /invoice-templates/:id | src\routes\payments.routes.js |
| GET | /invoice-templates/:id | src\routes\payments.routes.js |
| DELETE | /invoice-templates/:id | src\routes\payments.routes.js |
| PATCH | /invoice-templates/:id | src\routes\payments.routes.js |
| POST | /process | src\routes\payments.routes.js |
| POST | /verify | src\routes\payments.routes.js |

## public

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| GET | /events/:slug/landing | src\routes\public.routes.js |
| GET | /go/:shortCode | src\routes\public.routes.js |

## registrantPortal

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| POST | /abstracts | src\routes\registrantPortal.routes.js |
| GET | /abstracts | src\routes\registrantPortal.routes.js |
| DELETE | /abstracts/:abstractId | src\routes\registrantPortal.routes.js |
| PUT | /abstracts/:abstractId | src\routes\registrantPortal.routes.js |
| GET | /abstracts/:abstractId | src\routes\registrantPortal.routes.js |
| GET | /abstracts/:abstractId/download | src\routes\registrantPortal.routes.js |
| GET | /dashboard | src\routes\registrantPortal.routes.js |
| GET | /events/:eventId/abstracts | src\routes\registrantPortal.routes.js |
| GET | /events/current | src\routes\registrantPortal.routes.js |
| POST | /forgot-password | src\routes\registrantPortal.routes.js |
| POST | /login | src\routes\registrantPortal.routes.js |
| PUT | /profile | src\routes\registrantPortal.routes.js |
| GET | /profile | src\routes\registrantPortal.routes.js |
| PUT | /reset-password/:resettoken | src\routes\registrantPortal.routes.js |

## registrantPortalRoutes

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| GET | /announcements | src\routes\registrantPortalRoutes.js |
| GET | /certificates | src\routes\registrantPortalRoutes.js |
| GET | /certificates/:id | src\routes\registrantPortalRoutes.js |
| GET | /dashboard | src\routes\registrantPortalRoutes.js |
| GET | /events/:eventId | src\routes\registrantPortalRoutes.js |
| POST | /events/:eventId/abstracts | src\routes\registrantPortalRoutes.js |
| GET | /events/:eventId/abstracts | src\routes\registrantPortalRoutes.js |
| PUT | /events/:eventId/abstracts/:abstractId | src\routes\registrantPortalRoutes.js |
| GET | /events/:eventId/abstracts/:abstractId | src\routes\registrantPortalRoutes.js |
| GET | /events/:eventId/registrants/:registrantId/badge | src\routes\registrantPortalRoutes.js |
| POST | /forgot-password | src\routes\registrantPortalRoutes.js |
| POST | /login | src\routes\registrantPortalRoutes.js |
| GET | /payments | src\routes\registrantPortalRoutes.js |
| GET | /payments/:id/invoice | src\routes\registrantPortalRoutes.js |
| PUT | /profile | src\routes\registrantPortalRoutes.js |
| GET | /profile | src\routes\registrantPortalRoutes.js |
| POST | /register | src\routes\registrantPortalRoutes.js |
| GET | /registration | src\routes\registrantPortalRoutes.js |
| POST | /reset-password | src\routes\registrantPortalRoutes.js |
| GET | /resources | src\routes\registrantPortalRoutes.js |
| GET | /resources/:id | src\routes\registrantPortalRoutes.js |
| POST | /verify | src\routes\registrantPortalRoutes.js |
| GET | /workshops | src\routes\registrantPortalRoutes.js |
| POST | /workshops/:id/register | src\routes\registrantPortalRoutes.js |

## registration

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| DELETE | / | src\routes\registration.routes.js |
| PUT | / | src\routes\registration.routes.js |
| POST | / | src\routes\registration.routes.js |
| GET | / | src\routes\registration.routes.js |
| POST | /:registrationId | src\routes\registration.routes.js |
| DELETE | /:registrationId | src\routes\registration.routes.js |
| PUT | /:registrationId | src\routes\registration.routes.js |
| GET | /:registrationId | src\routes\registration.routes.js |
| GET | /:registrationId/check-in | src\routes\registration.routes.js |
| POST | /:registrationId/check-in | src\routes\registration.routes.js |
| POST | /count | src\routes\registration.routes.js |
| DELETE | /count | src\routes\registration.routes.js |
| PUT | /count | src\routes\registration.routes.js |
| GET | /count | src\routes\registration.routes.js |
| POST | /event/:eventId | src\routes\registration.routes.js |
| GET | /event/:eventId | src\routes\registration.routes.js |
| POST | /event/:eventId/count | src\routes\registration.routes.js |
| GET | /event/:eventId/count | src\routes\registration.routes.js |
| DELETE | /export | src\routes\registration.routes.js |
| PUT | /export | src\routes\registration.routes.js |
| POST | /export | src\routes\registration.routes.js |
| GET | /export | src\routes\registration.routes.js |
| DELETE | /import | src\routes\registration.routes.js |
| PUT | /import | src\routes\registration.routes.js |
| GET | /import | src\routes\registration.routes.js |
| POST | /import | src\routes\registration.routes.js |

## registrationResource

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| DELETE | / | src\routes\registrationResource.routes.js |
| PUT | / | src\routes\registrationResource.routes.js |
| POST | / | src\routes\registrationResource.routes.js |
| GET | / | src\routes\registrationResource.routes.js |
| GET | /:eventId/registrations/:registrationId/resource-stats | src\routes\registrationResource.routes.js |
| GET | /:eventId/registrations/:registrationId/resources | src\routes\registrationResource.routes.js |
| PATCH | /:eventId/registrations/:registrationId/resources/:resourceId | src\routes\registrationResource.routes.js |
| PUT | /:eventId/registrations/:registrationId/resources/:resourceUsageId/void | src\routes\registrationResource.routes.js |
| POST | /:eventId/registrations/:registrationId/send-certificate | src\routes\registrationResource.routes.js |
| DELETE | /:id | src\routes\registrationResource.routes.js |
| PUT | /:id | src\routes\registrationResource.routes.js |
| GET | /:id | src\routes\registrationResource.routes.js |

## registrationResourceModal

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| GET | /events/:eventId/registrations/:registrationId/resource-usage-modal | src\routes\registrationResourceModal.routes.js |

## registrations

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| PATCH | / | src\routes\registrations.routes.js |
| DELETE | / | src\routes\registrations.routes.js |
| PUT | / | src\routes\registrations.routes.js |
| POST | / | src\routes\registrations.routes.js |
| GET | / | src\routes\registrations.routes.js |
| PATCH | /:registrationId | src\routes\registrations.routes.js |
| DELETE | /:registrationId | src\routes\registrations.routes.js |
| PUT | /:registrationId | src\routes\registrations.routes.js |
| GET | /:registrationId | src\routes\registrations.routes.js |
| PATCH | /:registrationId/check-in | src\routes\registrations.routes.js |
| PATCH | /export | src\routes\registrations.routes.js |
| DELETE | /export | src\routes\registrations.routes.js |
| PUT | /export | src\routes\registrations.routes.js |
| POST | /export | src\routes\registrations.routes.js |
| GET | /export | src\routes\registrations.routes.js |
| PATCH | /import | src\routes\registrations.routes.js |
| DELETE | /import | src\routes\registrations.routes.js |
| PUT | /import | src\routes\registrations.routes.js |
| GET | /import | src\routes\registrations.routes.js |
| POST | /import | src\routes\registrations.routes.js |
| PATCH | /scan | src\routes\registrations.routes.js |
| DELETE | /scan | src\routes\registrations.routes.js |
| PUT | /scan | src\routes\registrations.routes.js |
| GET | /scan | src\routes\registrations.routes.js |
| POST | /scan | src\routes\registrations.routes.js |
| PATCH | /statistics | src\routes\registrations.routes.js |
| DELETE | /statistics | src\routes\registrations.routes.js |
| PUT | /statistics | src\routes\registrations.routes.js |
| POST | /statistics | src\routes\registrations.routes.js |
| GET | /statistics | src\routes\registrations.routes.js |

## report

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| GET | /:eventId | src\routes\report.routes.js |
| POST | /:eventId | src\routes\report.routes.js |
| DELETE | /:eventId/:reportId | src\routes\report.routes.js |
| PUT | /:eventId/:reportId | src\routes\report.routes.js |
| GET | /:eventId/:reportId | src\routes\report.routes.js |
| GET | /:eventId/:reportId/export | src\routes\report.routes.js |
| POST | /:eventId/:reportId/generate | src\routes\report.routes.js |
| POST | /:eventId/:reportId/schedule | src\routes\report.routes.js |

## resource

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| DELETE | / | src\routes\resource.routes.js |
| PUT | / | src\routes\resource.routes.js |
| POST | / | src\routes\resource.routes.js |
| GET | / | src\routes\resource.routes.js |
| DELETE | /:resourceId | src\routes\resource.routes.js |
| PUT | /:resourceId | src\routes\resource.routes.js |
| GET | /:resourceId | src\routes\resource.routes.js |
| GET | /stats | src\routes\resource.routes.js |

## resources

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| POST | / | src\routes\resources.routes.js |
| GET | / | src\routes\resources.routes.js |
| POST | /certificate-template/upload | src\routes\resources.routes.js |
| GET | /events/:eventId/certificate-templates/:templateId/registrations/:registrationId/generate-pdf | src\routes\resources.routes.js |
| POST | /recent-scans | src\routes\resources.routes.js |
| GET | /recent-scans | src\routes\resources.routes.js |
| GET | /record-usage | src\routes\resources.routes.js |
| POST | /record-usage | src\routes\resources.routes.js |
| POST | /settings | src\routes\resources.routes.js |
| PUT | /settings | src\routes\resources.routes.js |
| GET | /settings | src\routes\resources.routes.js |
| GET | /statistics/:eventId/:resourceType | src\routes\resources.routes.js |
| GET | /validate-scan | src\routes\resources.routes.js |
| POST | /validate-scan | src\routes\resources.routes.js |

## schedule

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| DELETE | /admin/events/:eventId/schedule | src\routes\schedule.routes.js |
| PUT | /admin/events/:eventId/schedule | src\routes\schedule.routes.js |
| POST | /admin/events/:eventId/schedule | src\routes\schedule.routes.js |
| GET | /events/:eventId/schedule | src\routes\schedule.routes.js |
| GET | /events/current/schedule | src\routes\schedule.routes.js |

## sponsor

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| DELETE | / | src\routes\sponsor.routes.js |
| PUT | / | src\routes\sponsor.routes.js |
| GET | / | src\routes\sponsor.routes.js |
| POST | / | src\routes\sponsor.routes.js |
| DELETE | /:sponsorDbId | src\routes\sponsor.routes.js |
| PUT | /:sponsorDbId | src\routes\sponsor.routes.js |
| GET | /:sponsorDbId | src\routes\sponsor.routes.js |
| GET | /by-custom-id/:sponsorCustomId | src\routes\sponsor.routes.js |

## sponsorAuth

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| POST | /:eventId/sponsors/login | src\routes\sponsorAuth.routes.js |
| POST | /events/:eventId/login | src\routes\sponsorAuth.routes.js |
| GET | /me | src\routes\sponsorAuth.routes.js |
| GET | /me/registrants | src\routes\sponsorAuth.routes.js |

## sponsorPortal

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| GET | /me/categories | src\routes\sponsorPortal.routes.js |
| GET | /me/dashboard | src\routes\sponsorPortal.routes.js |
| POST | /me/registrants | src\routes\sponsorPortal.routes.js |
| GET | /me/registrants | src\routes\sponsorPortal.routes.js |
| DELETE | /me/registrants/:id | src\routes\sponsorPortal.routes.js |
| PUT | /me/registrants/:id | src\routes\sponsorPortal.routes.js |
| POST | /me/registrants/bulk-import | src\routes\sponsorPortal.routes.js |
| GET | /me/registrants/export | src\routes\sponsorPortal.routes.js |

## systemLogs

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| GET | / | src\routes\systemLogs.routes.js |
| GET | /download | src\routes\systemLogs.routes.js |

## systemSettings

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| PUT | / | src\routes\systemSettings.routes.js |
| GET | / | src\routes\systemSettings.routes.js |

## timeline

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| GET | / | src\routes\timeline.routes.js |

## user

| Method | Path (relative to /api) | Source Route File |
| ------ | ----------------------- | ----------------- |
| DELETE | / | src\routes\user.routes.js |
| PUT | / | src\routes\user.routes.js |
| POST | / | src\routes\user.routes.js |
| GET | / | src\routes\user.routes.js |
| DELETE | /:id | src\routes\user.routes.js |
| PUT | /:id | src\routes\user.routes.js |
| GET | /:id | src\routes\user.routes.js |
| GET | /me/reviewer/assigned-abstracts | src\routes\user.routes.js |
| GET | /me/reviewer/events/:eventId/download-assigned-files | src\routes\user.routes.js |
| GET | /me/reviewer/events/:eventId/export-assigned-details | src\routes\user.routes.js |
