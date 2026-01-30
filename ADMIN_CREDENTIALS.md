# Admin Credentials

## Login Information

**Application URL:** https://renovatemysite-vibe.web.app/

**Admin Credentials:**
- Email: `admin@renovatemysite.com`
- Password: `Admin123!@#`

## Features Enabled

- ✅ Admin role with custom claims
- ✅ Vibe Editor enabled
- ✅ Email verified
- ✅ Firestore user document created

## Security Notes

1. **Change password after first login**
2. This is a temporary password for initial setup
3. Admin has access to:
   - All vibe editor functions
   - Admin dashboard
   - User management
   - Metrics and error logs

## Firestore User Document

The admin user has the following properties:
```json
{
  "email": "admin@renovatemysite.com",
  "displayName": "Admin User",
  "role": "admin",
  "isAdmin": true,
  "vibeEditorEnabled": true,
  "createdAt": "<server timestamp>"
}
```

## Custom Claims

```json
{
  "admin": true,
  "role": "admin"
}
```

## Setup Function

The `setupAdmin` function has been deployed and can be called again if needed:

```bash
curl "https://us-central1-renovatemysite-vibe.cloudfunctions.net/setupAdmin?secret=setup-admin-vibe-2024"
```

⚠️ **Important:** This function should be deleted or secured after initial setup to prevent unauthorized admin creation.

---

**Created:** January 30, 2026
**Project:** renovatemysite-vibe
