# Database

WO-001 only prepares the PostgreSQL migration framework.

Expected development database:

```text
pandao_browser
```

Set `DATABASE_URL` in the local environment before running migrations. Do not commit real credentials.

Common scripts:

```powershell
npm run migrate -w server
npm run migrate:create -w server -- migration_name
```
