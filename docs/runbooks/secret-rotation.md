# Secret Rotation Runbook

**System:** Mahalla Ovozi  
**Scope:** All application secrets in `.env`  
**Audience:** Operator / system administrator  

> [!CAUTION]
> Rotating a secret requires updating the `.env` file and restarting the application.
> Some rotations (e.g. `SESSION_SECRET`) will invalidate all active user sessions.
> Plan rotations during low-activity windows.

---

## 1. Secret Inventory

| Variable | Description | Rotation Frequency | Invalidation Impact |
|---|---|---|---|
| `SESSION_SECRET` | Signs and encrypts session cookies | 90 days | All users logged out |
| `BOT_TOKEN` | Telegram bot authentication | As needed / compromised | Bot stops receiving messages |
| `TELEGRAM_WEBHOOK_SECRET` | Validates incoming Telegram webhook requests | 90 days | Must re-register webhook |
| `AI_API_KEY` | Gemini / OpenAI-compatible API key | Per provider policy | Classification pauses |
| `DATABASE_URL` (password) | PostgreSQL password | 180 days | App cannot connect to DB |
| `OPS_SECRET` | Ops Console tunnel protection passphrase | 30 days (if in use) | Ops Console access blocked until updated |

---

## 2. General Rotation Procedure

For any secret:

1. Generate a new value (see generation commands below).
2. Update `.env` on the server (keep the old value temporarily if graceful handover is needed).
3. Restart the application.
4. Verify the application is functional.
5. If the secret was shared with a third party (e.g. Telegram webhook), update it there too.

---

## 3. Secret Generation Commands

```bash
# SESSION_SECRET — 32-byte hex string
openssl rand -hex 32

# TELEGRAM_WEBHOOK_SECRET — 32-byte alphanumeric (Telegram allows 1–256 printable ASCII)
openssl rand -base64 24 | tr -d '=/+'

# OPS_SECRET — strong passphrase
openssl rand -base64 32

# Database password — alphanumeric only to avoid shell quoting issues
openssl rand -base64 18 | tr -d '=/+'
```

---

## 4. Rotating `SESSION_SECRET`

> [!IMPORTANT]
> Changing `SESSION_SECRET` logs out **all active users** immediately.

1. Generate a new value:
   ```bash
   openssl rand -hex 32
   ```
2. Update `.env`:
   ```env
   SESSION_SECRET=<new-value>
   ```
3. Restart the application:
   ```bash
   pm2 restart mahalla-ovozi
   # or
   systemctl restart mahalla-ovozi
   ```
4. Notify operators that they will need to log in again.

---

## 5. Rotating `BOT_TOKEN`

> [!WARNING]
> The bot will stop receiving Telegram messages during this rotation.
> Complete all steps quickly to minimize downtime.

1. In Telegram, message @BotFather: `/revoke` → select your bot → confirm.
2. BotFather issues a new token. Copy it.
3. Update `.env`:
   ```env
   BOT_TOKEN=<new-token>
   ```
4. Re-register the webhook with the new token (see Step 5 in [pilot-deployment-runbook.md](./pilot-deployment-runbook.md)):
   ```bash
   curl -X POST "https://api.telegram.org/bot<NEW_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://<your-domain>/webhook",
       "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
     }'
   ```
5. Restart the application:
   ```bash
   pm2 restart mahalla-ovozi
   ```
6. Verify: send a test message to the bot group and confirm it appears in the raw queue.

---

## 6. Rotating `TELEGRAM_WEBHOOK_SECRET`

1. Generate a new value:
   ```bash
   openssl rand -base64 24 | tr -d '=/+'
   ```
2. Update `.env`:
   ```env
   TELEGRAM_WEBHOOK_SECRET=<new-value>
   ```
3. Restart the application (so the server validates incoming requests with the new secret).
4. Re-register the webhook with the new secret:
   ```bash
   curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{
       "url": "https://<your-domain>/webhook",
       "secret_token": "<new-TELEGRAM_WEBHOOK_SECRET>"
     }'
   ```
5. Verify: confirm `getWebhookInfo` returns no errors and a test message is received.

---

## 7. Rotating `AI_API_KEY`

1. Generate a new API key in your AI provider's console (Google AI Studio, etc.).
2. Update `.env`:
   ```env
   AI_API_KEY=<new-key>
   ```
3. Restart the application:
   ```bash
   pm2 restart mahalla-ovozi
   ```
4. Trigger a test classification (send a test message via the Ops Console simulator or a real group message).
5. Revoke the old key in the provider's console.

---

## 8. Rotating the Database Password

> [!CAUTION]
> The app will fail to connect to the database between step 1 and step 4 if done without a brief
> downtime window. Rotate during low-traffic periods.

1. Stop the application:
   ```bash
   pm2 stop mahalla-ovozi
   ```
2. Change the PostgreSQL user password:
   ```bash
   psql -U postgres -c "ALTER USER mahalla WITH PASSWORD '<new-password>';"
   ```
3. Update `DATABASE_URL` in `.env`:
   ```env
   DATABASE_URL=postgresql://mahalla:<new-password>@localhost:5432/mahalla_ovozi
   ```
4. Restart the application:
   ```bash
   pm2 start mahalla-ovozi
   ```
5. Run a health check: `curl -f https://<your-domain>/readyz`.

---

## 9. Rotating `OPS_SECRET`

1. Generate a new value:
   ```bash
   openssl rand -base64 32
   ```
2. Update `.env`:
   ```env
   OPS_SECRET=<new-value>
   ```
3. Distribute the new secret to authorized operators.
4. Restart the application:
   ```bash
   pm2 restart mahalla-ovozi
   ```
5. Verify Ops Console access with the new secret.

---

## 10. Post-Rotation Verification

After any secret rotation:

- [ ] Application readiness check passes: `curl -f https://<your-domain>/readyz`
- [ ] Login flow works end-to-end
- [ ] Bot receives a test message and it appears in the Ops Console raw queue
- [ ] Classifier processes the test message and produces a signal (or `ignore`)
- [ ] No error logs related to the rotated secret: `pm2 logs mahalla-ovozi | grep -i error`

---

## 11. Secret Storage Recommendations

- Store `.env` with restricted file permissions: `chmod 600 .env`
- Do not commit `.env` to version control (`.gitignore` already excludes it).
- For team deployments, use a secrets manager (e.g. HashiCorp Vault, AWS Secrets Manager, or Doppler) rather than plaintext `.env` files.
- Rotate immediately if you suspect compromise — do not wait for the scheduled rotation window.
