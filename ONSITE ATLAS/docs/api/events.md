# Events API

All paths are mounted under `/api/events` unless otherwise noted.

> NOTE: For brevity only **top-level** request/response fields are shown. All responses follow the common envelope:
>
> ```json
> {
>   "success": true,
>   "message": "…",
>   "data": { … },
>   "meta": { … }
> }
> ```

## 1. List / create events

| | |
|---|---|
| **Method** | `GET /` |
| **Auth** | Public (listing) |
| **Query** | `search?`, `page?`, `limit?` (server-side pagination) |
| **Success (200)** | Array of event objects |
|  |  |
| **Method** | `POST /` |
| **Auth** | Bearer JWT (`admin`, `staff`) |
| **Body** |
| &nbsp;&nbsp;`name` – string (required) |
| &nbsp;&nbsp;`startDate`, `endDate` – ISO date strings |
| &nbsp;&nbsp;`location` – string |
| &nbsp;&nbsp;`logo` – URL string |
| **Success (201)** | Newly created event |

---

## 2. Single event – get / update / delete

| | |
|---|---|
| **Method** | `GET /:id` |
| **Auth** | Public |
| **Success** | Event object |
|  |  |
| **Method** | `PUT /:id` |
| **Auth** | Bearer JWT (`admin`, `staff`) |
| **Body** | Any top-level field of the event schema |
| **Success (200)** | Updated event |
|  |  |
| **Method** | `DELETE /:id` |
| **Auth** | Bearer JWT (`admin`) |
| **Success (204)** | No body |

---

## 3. Event dashboard & stats

| | |
|---|---|
| **GET /:id/dashboard** | Returns widget data (registrations today, revenue, etc.) |
| **GET /:id/stats** | Aggregated counters (registrations, abstracts, sponsors) |
| **Auth** | Bearer JWT (`admin`, `staff`) for both |

---

## 4. Abstract-workflow helpers

| Endpoint | Purpose | Auth |
|---|---|---|
| `GET /:eventId/abstract-workflow/reviewers` | List users who can review abstracts for this event | `admin`, `staff` |
| `PUT /:id/abstract-settings` | Update abstract rules (max words, allowed file types, etc.) | `admin`, `staff` |
| `GET /:id/abstract-settings` | Fetch current abstract settings | `admin`, `staff`, *reviewer* (read-only) |

---

## 5. Badge settings

| | |
|---|---|
| **GET /:id/badge-settings** | Retrieve badge layout & fields | `admin`, `staff` |
| **PUT /:id/badge-settings** | Save badge settings | `admin`, `staff` |

---

## 6. Registration counts by category

`GET /:eventId/registrations/counts-by-category` ⟶ `{ success, data: { <categoryId>: <count>, … } }`

Auth: `admin`, `staff`

---

## 7. Resource config

| | |
|---|---|
| **GET /:id/resource-config** | Get QR-resource settings & quotas |
| **Auth** | `admin`, `staff` |

---

## 8. Event users

`GET /:eventId/users` → list of users assigned to this event (organisers, reviewers, etc.)  
Auth: `admin`, `manager`, `staff`

---

## 9. Publish / Unpublish placeholders

`PUT /:id/publish` and `PUT /:id/unpublish` are currently **501 Not Implemented** – the API reserves these routes for future use.

---

### Event object (top-level fields)

```json
{
  "_id": "…",
  "name": "Annual Conference",
  "startDate": "2025-06-01T00:00:00.000Z",
  "endDate": "2025-06-03T23:59:59.000Z",
  "location": "New York",
  "logo": "https://…/logo.png",
  "abstractSettings": { … },
  "badgeSettings": { … },
  "createdAt": "…",
  "updatedAt": "…"
}
```

---

Errors follow the standard envelope; 404 for unknown IDs, 400 for validation errors, 401/403 for auth issues. 