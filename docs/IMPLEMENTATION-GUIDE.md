# LeadVoice — Implementation Guide

## Replicating the System for New Clients

This guide covers everything needed to deploy a new LeadVoice instance for a different company.

---

## 1. Prerequisites

| Item | Details |
|------|---------|
| VPS | Minimum 2GB RAM, 2 vCPU (recommend Hostinger) |
| Domain | Configured with DNS A records |
| GitHub | Repository access |
| Twilio | Paid account (not trial) |
| VAPI | Account with credits |
| OpenAI | API key with GPT-4o-mini access |
| Google Cloud | Project for Sheets OAuth (optional: Calendar) |
| N8N | Self-hosted instance |

---

## 2. Infrastructure Setup

### 2.1 Install EasyPanel

```bash
curl -sSL https://get.easypanel.io | sh
```

Access at `http://SERVER_IP:3000`

### 2.2 Create Project

Create a new project in EasyPanel (e.g., "clientname")

### 2.3 Required Services

| Service | Type | Notes |
|---------|------|-------|
| PostgreSQL | Database | Default port 5432 |
| Redis | Database | Default port 6379 |
| leadvoice-api | App (Docker) | Dockerfile: `docker/Dockerfile.api` |
| leadvoice-web | App (Docker) | Dockerfile: `docker/Dockerfile.web` |
| n8n | App | Docker image: `n8nio/n8n` |

### 2.4 Domain Structure

Configure DNS A records pointing to the VPS IP:

| Subdomain | Service |
|-----------|---------|
| `api.domain.com` | leadvoice-api |
| `app.domain.com` | leadvoice-web |
| `workflow.domain.com` | n8n (panel) |
| `webhook.domain.com` | n8n (webhooks) |

Enable SSL (Let's Encrypt) for all domains in EasyPanel.

---

## 3. Database Setup

### 3.1 Connection String

```
DATABASE_URL=postgres://postgres:GENERATED_PASSWORD@projectname_postgres:5432/dbname?sslmode=disable
```

### 3.2 Run Migrations

```bash
# Inside the API container or locally
pnpm --filter @leadvoice/database exec prisma migrate deploy
```

### 3.3 Seed Admin User

```bash
pnpm db:seed
# Creates: admin@leadvoice.com / admin123
```

> **Important**: Change the admin password after first login.

---

## 4. VAPI Configuration

### 4.1 Create Assistant

1. Go to VAPI dashboard → Assistants → Create
2. Name: e.g., "SunnyBee" (or client-specific name)
3. Voice: OpenAI "shimmer" (recommended)
4. Model: GPT-4o-mini
5. Server URL: `https://api.{domain}/api/webhooks/vapi`

### 4.2 Customize the Prompt

Edit `apps/api/src/config/vapi/sunnybee-prompt.md`:

- Company name and description
- Services offered (cleaning types, pricing)
- Service areas (cities, states)
- Available schedule
- Special offers or promotions
- Tone and personality

### 4.3 Phone Number

1. Purchase a US phone number in Twilio
2. Import the number into VAPI (Settings → Phone Numbers → Import from Twilio)
3. Assign the number to the assistant

### 4.4 Note the IDs

- `VAPI_API_KEY` — from VAPI Settings → API Keys
- `VAPI_ASSISTANT_ID` — from the assistant page URL
- `VAPI_PHONE_NUMBER_ID` — from the phone number settings

---

## 5. Twilio Setup

### 5.1 Phone Number

- Purchase a US local number (area code matching the client's region)
- Import to VAPI for voice calls

### 5.2 A2P 10DLC Registration (Required for SMS)

1. **Customer Profile**: Business name, EIN, address, contact
2. **Register Brand**: Company details, website
3. **Create Campaign**:
   - Use case: "Customer Care"
   - Sample messages (2 required)
   - Opt-in description
   - Privacy Policy URL: `https://app.{domain}/privacy`
   - Terms URL: `https://app.{domain}/terms`
4. **Link Phone Number**: After campaign approval (2-3 weeks)

### 5.3 Environment Variables

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
```

---

## 6. Environment Variables

### API Service (`leadvoice-api`)

```env
# Database
DATABASE_URL=postgres://postgres:PASSWORD@project_postgres:5432/dbname?sslmode=disable
REDIS_URL=redis://default:PASSWORD@project_redis:6379

# Auth
JWT_SECRET=generate-a-strong-random-string

# VAPI
VAPI_API_KEY=your-vapi-api-key
VAPI_PHONE_NUMBER_ID=your-phone-number-id
VAPI_ASSISTANT_ID=your-assistant-id

# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX

# N8N Webhooks
N8N_WEBHOOK_URL=https://webhook.{domain}/webhook/call-completed
N8N_SMS_WEBHOOK_URL=https://webhook.{domain}/webhook/sms-alert

# CORS
CORS_ORIGIN=https://app.{domain}
```

### Web Service (`leadvoice-web`)

```env
# IMPORTANT: This is baked at BUILD time, not runtime
NEXT_PUBLIC_API_URL=https://api.{domain}
```

---

## 7. N8N Workflows Setup

### 7.1 Workflow 1: Call Completed

- **Trigger**: Webhook at `/webhook/call-completed`
- **Actions**:
  1. Append row to Google Sheets (lead name, phone, service, outcome, summary)
  2. Send email notification to owner (Gmail node)

### 7.2 Workflow 2: SMS Alert

- **Trigger**: Webhook at `/webhook/sms-alert`
- **Actions**:
  1. Send SMS to owner via Twilio
  2. Send email notification via Gmail

### 7.3 Workflow 3: Daily Summary

- **Trigger**: Schedule (daily at 8 PM client timezone)
- **Actions**:
  1. HTTP request to `https://api.{domain}/api/public/dashboard/leads-today`
  2. Code node: Format summary text
  3. Send email with daily report

### 7.4 Google Sheets OAuth

1. Create Google Cloud project
2. Enable Google Sheets API
3. Create OAuth credentials (Web application)
4. Add redirect URI: `https://workflow.{domain}/rest/oauth2-credential/callback`
5. Connect in N8N: Credentials → Google Sheets OAuth2

### 7.5 Data Path Reference

The API sends webhook data wrapped as:
```json
{
  "event": "call_completed",
  "data": {
    "structuredData": { "firstName": "...", "phone": "...", ... },
    "outcome": "INTERESTED",
    "summary": "..."
  },
  "timestamp": "..."
}
```

In N8N, access fields via: `$json.body.data.structuredData.firstName`

---

## 8. Customization Checklist for New Client

### Branding

- [ ] Update sidebar logo (`components/layout/sidebar.tsx` — Image src)
- [ ] Update login page logo and branding (`app/(auth)/login/page.tsx`)
- [ ] Update color scheme in `app/globals.css`:
  - `--primary`: Main button/link color
  - `--sidebar`: Sidebar background
  - `--accent`: Accent color
- [ ] Update company name in Settings page
- [ ] Update Privacy Policy and Terms pages content

### Business Logic

- [ ] Customize SunnyBee prompt (`apps/api/src/config/vapi/sunnybee-prompt.md`)
- [ ] Update SMS templates in Messages page if needed
- [ ] Update CRM stage labels if needed (currently cleaning-focused)
- [ ] Adjust calling window defaults for client timezone

### Notifications

- [ ] Update N8N workflow email recipients
- [ ] Update N8N workflow SMS recipient number
- [ ] Create new Google Sheets spreadsheet for the client
- [ ] Update Sheets ID in N8N workflow

---

## 9. Docker Deployment

### API Dockerfile (`docker/Dockerfile.api`)

Key points:
- Runs `prisma migrate deploy` before starting
- Uses `bcryptjs` (NOT `bcrypt`) — native bcrypt fails on Alpine
- Starts with `node dist/server.js`

### Web Dockerfile (`docker/Dockerfile.web`)

Key points:
- `NEXT_PUBLIC_API_URL` is **baked at build time** (set as build arg)
- Uses Next.js standalone output
- Serves on port 3000

### Container Names

In Docker Swarm (EasyPanel), containers are named:
```
projectname_servicename.1.HASH
```

To access logs:
```bash
docker logs projectname_leadvoice-api.1.$(docker ps -q -f name=projectname_leadvoice-api)
```

---

## 10. Post-Deployment Testing

### Core Functionality

- [ ] Login works with admin credentials
- [ ] Dashboard loads with stats (all zeros initially)
- [ ] Can create a lead manually (Add Lead button)
- [ ] Can import CSV leads (Import CSV button)
- [ ] Can create a campaign and add leads

### AI Calling

- [ ] Make a test call via VAPI dashboard ("Talk" button)
- [ ] Verify webhook receives call data (check API logs)
- [ ] Confirm lead profile updates with extracted data
- [ ] Verify call summary is generated

### Notifications

- [ ] Google Sheets updates after call
- [ ] Email notification arrives
- [ ] SMS notification arrives
- [ ] Daily summary fires at scheduled time

### Messaging

- [ ] Send SMS to a lead from Messages page
- [ ] Send SMS to a manual phone number
- [ ] Verify delivery status updates

---

## 11. Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| `bcrypt` fails on Alpine | Use `bcryptjs` instead |
| VAPI doesn't send `structuredData` | Extract from transcript via OpenAI |
| VAPI sends `durationSeconds` not `duration` | Use `durationSeconds` field |
| IPv6 issues with Supabase | Use local PostgreSQL in EasyPanel |
| Container name unknown | Format: `project_service.1.HASH` |
| `NEXT_PUBLIC_API_URL` not working | Must be set at BUILD time, not runtime |
| Google OAuth "access blocked" | Publish OAuth app or add test users |
| N8N data paths wrong | Data is under `$json.body.data.structuredData.*` |
| SMS not delivering | Check A2P 10DLC registration status |
| OpenAI returns null fields | Check `!== null` not just truthy |

---

## 12. Monthly Cost Estimate

| Service | Cost |
|---------|------|
| VPS (Hostinger 2GB) | ~$10-15/month |
| Twilio phone number | ~$1/month |
| Twilio voice | ~$0.013/min |
| Twilio SMS | ~$0.0079/message |
| VAPI AI calls | ~$0.05/min |
| OpenAI GPT-4o-mini | ~$5-20/month (volume dependent) |
| N8N | Free (self-hosted) |
| Domain | ~$10-15/year |
| **Total (small business)** | **~$30-50/month + usage** |

---

## 13. Support & Maintenance

- **Repository**: https://github.com/sunshinecleaner/leadvoice
- **Updates**: Pull latest from main branch, rebuild Docker images
- **Database migrations**: Run `prisma migrate deploy` after schema changes
- **Monitoring**: Check EasyPanel service logs for errors
- **Backups**: Configure PostgreSQL backups in EasyPanel

---

**Powered by Optzen**
