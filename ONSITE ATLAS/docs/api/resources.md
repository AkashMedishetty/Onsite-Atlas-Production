# Resource & Certificate API

Endpoints under `/api/resources` (general), and nested resource-usage under `/api/events/:eventId/registrations/:registrationId/resources`.

---

## 1. Resource settings (global)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/settings` | Fetch barcode/QR resource global settings | Public |
| PUT | `/settings` | Update settings (`scanWindow`, `allowDuplicate`, etc.) | `admin` |

---

## 2. Live validation & recording

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/validate-scan` | Validate a QR scan **without** recording usage. Body `{ code, eventId }`. | Any logged-in |
| POST | `/record-usage` | Validate **and** record usage. Body `{ code, eventId, registrationId }` | Any |
| GET  | `/recent-scans` | Last 50 scans for the user (for kiosk) | Any |
| GET  | `/statistics/:eventId/:resourceType` | Aggregate totals for drinks / meals etc. | `admin`, `staff` |

---

## 3. Resources CRUD

| Method | Path | Notes | Auth |
|---|---|---|---|
| GET | `/` | List resources (filter by `eventId`, `type`) | `admin`, `staff` |
| POST | `/` | Create resource `{ name, type, quota, event }` | `admin`, `staff` |

---

## 4. Certificate templates & generation

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/certificate-template/upload` | Upload PDF template file (`multipart/form-data`→`file`) | `admin`, `staff` |
| GET | `/events/:eventId/certificate-templates/:templateId/registrations/:registrationId/generate-pdf` | Generate & stream PDF certificate for registrant | `admin`, `staff` or self-service kiosk |

---

## 5. Registration-specific resource usage

Nested router mounted at `/events/:eventId/registrations/:registrationId/resources`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List resource usages for this registrant |
| POST | `/` | Record usage `{ resourceId }` |
| POST | `/:resourceUsageId/void` | Void a usage record (admin only) |

Auth inherits from parent (`admin`, `staff`).

---

### Resource object (top-level)

```json
{
  "_id": "…",
  "name": "Lunch Coupon",
  "type": "meal", // or drink, badge, certificate
  "event": "60a…",
  "quota": 1,
  "createdAt": "…"
}
```

### ResourceUsage object

```json
{
  "_id": "…",
  "registration": "60b…",
  "resource": "60c…",
  "usedAt": "…",
  "void": false,
  "voidedBy": null
}
``` 