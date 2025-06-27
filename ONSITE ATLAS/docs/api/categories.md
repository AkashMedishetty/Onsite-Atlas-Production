# Categories API

Categories classify registrations/abstracts per event.

Base paths:
1. `/api/categories` – global listing (all events)
2. `/api/categories/event/:eventId` – CRUD within event scope

---

## 1. Global list

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/categories` | List categories across events (public) | Public |

---

## 2. Event-scoped CRUD

| Method | Path | Notes | Auth |
|---|---|---|---|
| GET | `/categories/event/:eventId` | List categories for event | `admin`, `staff` |
| POST | `/categories/event/:eventId` | Create `{ name, color }` | `admin`, `staff` |
| PUT | `/categories/event/:eventId` | Bulk update array of categories | `admin`, `staff` |
| DELETE | `/categories/event/:eventId` | Bulk delete by IDs (body) | `admin` |

---

## 3. Individual category by ID

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/categories/:id` | Fetch category | `admin`, `staff` |
| PUT | `/categories/:id` | Update `{ name, color }` | `admin`, `staff` |
| DELETE | `/categories/:id` | Remove | `admin` |

---

## 4. Category permissions

`PUT /categories/:id/permissions` – Body `{ allowedRoles: ['registrant','author',…] }` – determines who can pick this category during form filling.  
Auth: `admin`.

---

### Category object (top-level)

```json
{
  "_id": "…",
  "name": "Orthopaedics",
  "color": "#ff9900",
  "event": "60a…",
  "createdAt": "…",
  "updatedAt": "…"
}
``` 