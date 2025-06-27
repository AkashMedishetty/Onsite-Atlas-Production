# Registrations API

Covers:
1. `/api/events/:eventId/registrations` (event-scoped CRUD & utilities)
2. `/api/registrations` (global admin routes; none currently but table may grow)

Standard wrapper `{ success, message, data?, meta? }` on success; errors follow `{ success:false, message }`.

---

## 1. List & create registrations (per event)

| | |
|---|---|
| **GET** | `/events/:eventId/registrations` |
| **Auth** | Bearer JWT (`admin`, `staff`) |
| **Query** |
| &nbsp;&nbsp;`categoryId?` – filter by category |
| &nbsp;&nbsp;`status?` – `pending`\|`paid`\|`checked-in` … |
| &nbsp;&nbsp;`search?` – fuzzy search on name/email/registrationId |
| &nbsp;&nbsp;`page`, `limit` – pagination |
| **200** | Paginated list of registrations (populated with `event`, `category`) |
|  |  |
| **POST** | `/events/:eventId/registrations` |
| **Auth** | `admin`, `staff` |
| **Body (top-level)** |
| &nbsp;&nbsp;`personalInfo` – object `{ firstName, lastName, email, phone, organization }` |
| &nbsp;&nbsp;`category` – ObjectId |
| &nbsp;&nbsp;`registrationType` – string |
| &nbsp;&nbsp;`status` – string (`pending` by default) |
| &nbsp;&nbsp;`customFields` – object (key/value) |
| **201** | Newly created registration |

---

## 2. Import / export utilities

| Method | Path | Purpose |
|---|---|---|
| POST | `/events/:eventId/registrations/import` | Upload Excel/CSV (`multipart/form-data` → `file`) -> queues background job |
| GET  | `/events/:eventId/registrations/export` | Download Excel of all regs (same filters as list) |

*Bulk import response gives `jobId`, which can be polled via `/api/import-jobs/:jobId/status`.*

---

## 3. Statistics & quick lookup

| Endpoint | Notes |
|---|---|
| `GET /events/:eventId/registrations/count` | Returns `{ total, checkedIn, today, categoryCounts }` |
| `GET /events/:eventId/registrations/statistics` | Same as above (alias) |
| `POST /events/:eventId/registrations/scan` | QR-code scan lookup → returns matching registration or 404 |

---

## 4. Single registration operations

Base: `/events/:eventId/registrations/:registrationId`

| Method | Purpose | Auth |
|---|---|---|
| GET | Fetch details | `admin`, `staff` |
| PUT | Update any top-level fields (same as create) | `admin`, `staff` |
| DELETE | Remove registration | `admin` |
| PATCH `/check-in` | Mark as checked-in | `admin`, `staff` |

Nested resources:

* `/resources` – SEE **Resource Usage API** for details (void usage, etc.)

---

### Registration object (top-level)

```json
{
  "_id": "…",
  "registrationId": "REG12345",
  "event": "60a…",
  "category": "60b…",
  "personalInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1…",
    "organization": "ACME"
  },
  "registrationType": "delegate",
  "status": "pending",
  "badgePrinted": false,
  "customFields": { … },
  "createdAt": "…",
  "updatedAt": "…"
}
``` 