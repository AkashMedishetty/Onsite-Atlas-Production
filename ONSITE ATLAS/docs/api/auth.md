# Authentication & User Management API

All paths below are mounted under `/api/auth`.

## 1. Register a new user

| | |
|---|---|
| **Method** | `POST /register` |
| **Auth** | Public |
| **Request Body** | JSON object |
| **Top-level fields** |
| &nbsp;&nbsp;`name` | *string* – Full name *(required)* |
| &nbsp;&nbsp;`email` | *string* – Unique e-mail *(required)* |
| &nbsp;&nbsp;`password` | *string* – Plaintext password *(required)* |
| &nbsp;&nbsp;`role` | *string* – Role (`admin`\|`staff`\|`manager`...) *(optional, default `staff`)* |
| **Success (201)** | `{ success: true, data: { user, token, refreshToken } }` |

---

## 2. Login

| | |
|---|---|
| **Method** | `POST /login` |
| **Auth** | Public |
| **Request Body** |
| &nbsp;&nbsp;`email` – *string* (required) |
| &nbsp;&nbsp;`password` – *string* (required) |
| **Success (200)** | `{ success: true, token, user }`.<br/>Token also sent as `HttpOnly` cookie `token`. |
| **Error (401)** | `{ success: false, message: 'Invalid credentials' }` |

---

## 3. Refresh JWT

| | |
|---|---|
| **Method** | `POST /refresh-token` |
| **Auth** | Public |
| **Request Body** | `refreshToken` (string, required) |
| **Success (200)** | `{ success: true, data: { token, refreshToken } }` |

---

## 4. Get current user (profile)

| | |
|---|---|
| **Method** | `GET /me` |
| **Auth** | Bearer JWT |
| **Success (200)** | `{ success: true, data: user }` |

---

## 5. Logout

| | |
|---|---|
| **Method** | `POST /logout` |
| **Auth** | Bearer JWT |
| **Response** | `{ success: true, message: 'Logged out' }` |

---

## 6. List all users

| | |
|---|---|
| **Method** | `GET /users` |
| **Auth** | Bearer JWT – *requires* role `admin` or `manager` *(see RBAC middleware)* |
| **Query Params** | `role?`, `status?`, pagination params handled in controller |
| **Success (200)** | `{ success: true, data: [ …users ] }` |

---

## 7. Create a user (Admin)

| | |
|---|---|
| **Method** | `POST /users` |
| **Auth** | Bearer JWT (`admin` role) |
| **Request Body** |
| &nbsp;&nbsp;`name`, `email`, `password`, `role` |
| **Success (201)** | `{ success: true, data: user }` |

---

## 8. Get user by ID

| | |
|---|---|
| **Method** | `GET /users/:id` |
| **Auth** | Bearer JWT (`admin` or `manager`) |
| **Success (200)** | `{ success: true, data: user }` |
| **404** | User not found |

---

## 9. Update user status (activate / deactivate)

| | |
|---|---|
| **Method** | `PATCH /users/:id/status` |
| **Auth** | Bearer JWT (`admin`) |
| **Request Body** | `isActive` (*boolean*, required) |
| **Success (200)** | `{ success: true, data: updatedUser }` |

---

## 10. Get available roles

| | |
|---|---|
| **Method** | `GET /roles` |
| **Auth** | Bearer JWT (`admin`) |
| **Success** | `{ success: true, data: [ 'admin', 'staff', … ] }` |

---

### Standard Error Envelope
All endpoints return the standard error wrapper on failure:

```json
{
  "success": false,
  "message": "Human-readable error message"
}
```

*Generated automatically; double-check nested fields in controller for additional keys (e.g., `meta` for paginated responses).* 