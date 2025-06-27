# Analytics API

All endpoints are under `/api/analytics/:eventId/*` and require Bearer JWT (`admin` or `manager` roles).

---

| Endpoint | Returns |
|---|---|
| `GET /registration` | Registration metrics – totals, daily counts, breakdowns by category/type |
| `GET /financial`    | Revenue figures – paid vs pending, totals per item |
| `GET /workshops`    | Workshop attendance counts |
| `GET /abstracts`    | Abstract submission stats (per status, per category, average score) |
| `GET /sponsors`     | Sponsor packages sold, amount pledged/paid |
| `GET /export/:type` | CSV/Excel export of the above metrics (`type` = `registration`\|`financial`\|`abstracts`\|…) |

---

## Sample response – registration analytics

```json
{
  "success": true,
  "data": {
    "total": 1320,
    "paid": 1240,
    "checkedIn": 850,
    "today": 44,
    "byCategory": {
      "orthopaedics": 320,
      "neurology": 210
    },
    "trend": [
      { "date": "2025-06-01", "count": 120 },
      { "date": "2025-06-02", "count": 95 }
    ]
  }
}
```

Validation is handled by Joi schemas in `server/src/validations/analytics.validation.js`; they enforce the `eventId` path param and `type` enum for exports.

```

</rewritten_file>