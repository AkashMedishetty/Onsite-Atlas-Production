# Abstracts API

This file covers all endpoints under:

1. `/api/events/:eventId/abstracts` (bulk & event-scoped)
2. `/api/events/:eventId/abstracts/*` admin helpers (download, assign reviewers, etc.)
3. `/api/events/:eventId/abstract-authors` (summary data)

Standard envelope & error format as described in `auth.md` applies.

---

## 1. Create / list your abstracts (Registrant / Author)

| | |
|---|---|
| **POST** | `/events/:eventId/abstracts` |
| **Auth** | Registrant JWT •OR• Author JWT |
| **Body (top-level)** |
| &nbsp;&nbsp;`registration` – ObjectId (registrant flow only) |
| &nbsp;&nbsp;`title` – string (≤200 chars) |
| &nbsp;&nbsp;`authors` – string *(comma-separated or JSON array)* |
| &nbsp;&nbsp;`affiliations` – string *(optional)* |
| &nbsp;&nbsp;`category` – ObjectId (required) |
| &nbsp;&nbsp;`content` – string (≤5000 chars) |
| **201** | `{ success, data: abstract }` |
|  |  |
| **GET** | `/events/:eventId/abstracts` |
| **Auth** | Registrant / Author JWT |
| **Query** | `page`, `limit` pagination |
| **200** | Paginated list of own abstracts |

---

## 2. Admin / Staff – all abstracts for an event

| Method | Path | Purpose |
|---|---|---|
| GET | `/events/:eventId/abstracts/all-event-abstracts` | Full list (admin/staff) |
| GET | `/events/:eventId/abstracts/statistics` | Aggregate counts & averages |
| GET | `/events/:eventId/abstracts/pending-review-progress` | Reviewer progress dashboard |
| GET | `/events/:eventId/abstracts/download?exportMode=excel-single|excel-multi` | Bulk export of PDF / Excel (supports `category`, `topic`, `minScore`, `maxScore`, `reviewer` query params) |
| POST | `/events/:eventId/abstracts/assign-reviewers` | Auto / bulk assign reviewers; body { `method`: "round-robin" \| "manual", `reviewerIds`: [] } |

Auth: Bearer JWT with role `admin` or `staff`.

---

## 3. CRUD on a specific abstract (owner OR admin)

Base path: `/events/:eventId/abstracts/:id`

| Method | Auth | Notes |
|---|---|---|
| GET | Owner, Admin | Fetch single abstract |
| PUT | Owner (registrant/author) | Update (same body fields as create, all optional) |
| DELETE | Owner | Remove before submission cut-off |

Additional file routes:

* `POST /:id/file` – Upload main PDF (`multipart/form-data` → `file` field).
* `GET /:id/download-attachment` – Download uploaded file.
* `POST /:id/final-file` – Author uploads camera-ready version (after proof verification).

---

## 4. Review workflow (Admin / Reviewer)

| Endpoint | Role | Body / Params |
|---|---|---|
| `PUT /:id/status` | Admin, Reviewer | `{ status: "accepted"|"rejected"|"revision" }` |
| `POST /:id/comments` | Admin, Reviewer | `{ text, visibility: "reviewer"|"public" }` |
| `POST /:id/review`  | Admin, Reviewer | `{ scores: { originality, relevance, … }, comment }` |
| `POST /:id/assign-reviewer` | Admin | `{ reviewerId }` |
| `PUT /:id/approve`  | Admin, Staff | Accept without further review |
| `PUT /:id/reject`   | Admin, Staff | Reject abstract |
| `PUT /:id/request-revision` | Admin, Staff | Ask author to revise |
| `POST /:id/resubmit-revision` | Author | Re-upload revised content |

---

## 5. Registration proof & verification

| Endpoint | Role | Purpose |
|---|---|---|
| `POST /:id/registration-proof` | Author | Upload proof of event registration (file) |
| `PUT  /:id/verify-registration` | Admin, Staff | Mark proof as verified |

---

## 6. Miscellaneous helpers

| Endpoint | Notes |
|---|---|
| `POST /auto-assign-reviewers` | Admin utility to evenly distribute abstracts across reviewers |
| `GET  /by-registration/:registrationId` | Admin/Staff – fetch all abstracts created by a given registration |

---

## 7. Abstract Authors summary

`GET /events/:eventId/abstract-authors` → returns list of **unique authors** with counts of submissions.  
Auth: `admin`, `staff`.

---

### Abstract object (top-level)

```json
{
  "_id": "…",
  "title": "…",
  "authors": "John Doe; Jane Roe",
  "affiliations": "Univ. of X",
  "category": "60ba…",
  "content": "<HTML or plain text>",
  "status": "submitted", // or accepted/rejected/revision
  "score": 3.5,
  "registration": "60bb…", // registrant link
  "event": "60a…",
  "createdAt": "…",
  "updatedAt": "…"
}
```

*Nested arrays for scores, comments, reviewer assignments are omitted here.* 