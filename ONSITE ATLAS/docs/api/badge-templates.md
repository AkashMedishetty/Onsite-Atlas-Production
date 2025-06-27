# Badge Template API

Two route files exist:
1. `/api/badge-templates` (newer plural route)
2. `/api/badgeTemplate` (legacy singular)

Both expose largely the same CRUD; prefer the plural version.

Auth: Bearer JWT – roles `admin`, `staff`.

---

## Endpoints (plural route)

| Method | Path | Purpose |
|---|---|---|
| GET | `/badge-templates` | List templates (`eventId?` query to filter) |
| POST | `/badge-templates` | Create `{ name, eventId, svg, width, height, fields }` |
| GET | `/badge-templates/:id` | Get single template |
| PUT | `/badge-templates/:id` | Update fields |
| DELETE | `/badge-templates/:id` | Remove |
| POST | `/badge-templates/:id/duplicate` | Clone template |
| POST | `/badge-templates/:eventId/:templateId/set-default` | Mark as default for event |
| GET | `/badge-templates/test` | Health-check endpoint for debug |

Legacy routes follow the same pattern under `/api/badgeTemplate`.

---

### Template object (top-level)

```json
{
  "_id": "…",
  "name": "Standard A6",
  "event": "60a…",
  "svg": "<svg…>",
  "width": 105,
  "height": 148,
  "fields": [
    { "key": "firstName", "x": 10, "y": 20, "fontSize": 18 },
    { "key": "qrCode", "x": 60, "y": 90, "size": 40 }
  ],
  "isDefault": false,
  "createdAt": "…",
  "updatedAt": "…"
}
``` 