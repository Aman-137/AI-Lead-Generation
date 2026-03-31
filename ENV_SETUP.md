# Environment Variables - Complete Reference

## 📌 Backend Environment File

**Location:** `backend/.env`

```env
# ===== SUPABASE (Database & Auth) =====
# Get from: https://supabase.com → Your Project → Settings → API
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ===== OPENAI (Email Generation) =====
# Get from: https://platform.openai.com → API keys → Create new secret key
OPENAI_API_KEY=sk-proj-abc123xyz...

# ===== GMAIL (Email Sending) =====
# Get from: https://console.cloud.google.com → Credentials → OAuth 2.0 Client IDs
GMAIL_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-abc123xyz456
GMAIL_REDIRECT_URI=http://localhost:5000/api/gmail/callback

# ===== SERVER CONFIG =====
NODE_ENV=development
PORT=5000
```

---

## 📌 Frontend Environment File

**Location:** `frontend/.env.local`

```env
# ===== SUPABASE (Auth & Database Access) =====
# Get from: https://supabase.com → Your Project → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ===== API CONNECTION =====
# Points to your backend server
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## 🔑 Where to Get Each Value

### 1️⃣ **SUPABASE_URL**
- Go to: https://supabase.com
- Login → Select your project
- Settings → API (left sidebar)
- Copy: **Project URL** (starts with `https://`)
- Example: `https://abc123def.supabase.co`

### 2️⃣ **SUPABASE_SERVICE_ROLE_KEY**
- Same location as above: Settings → API
- Under "API Keys", find the **Service Role** key
- Copy the long key starting with `eyJhbGc...`
- ⚠️ NEVER share this key or commit to GitHub!

### 3️⃣ **NEXT_PUBLIC_SUPABASE_ANON_KEY**
- Same location: Settings → API
- Under "API Keys", find the **anon public** key
- Copy the key (shorter than service role key)
- This is safe to expose in frontend

### 4️⃣ **OPENAI_API_KEY**
- Go to: https://platform.openai.com
- Login → API keys (left sidebar)
- Click **Create new secret key**
- Copy the key (starts with `sk-proj-`)
- ⚠️ Save it immediately, you won't see it again!
- Add billing to account (charges only for usage: ~$1-5/month)

### 5️⃣ **GMAIL_CLIENT_ID**
- Go to: https://console.cloud.google.com
- Create new project called "AI Lead Gen"
- Search for "Gmail API" → Click **ENABLE**
- Go to **Credentials** (left sidebar)
- Click **+ CREATE CREDENTIALS** → OAuth client ID
- Application type: **Web application**
- Authorized redirect URIs: Add `http://localhost:5000/api/gmail/callback`
- Click Create
- Copy the **Client ID**
- Example: `123456789-abc123def456.apps.googleusercontent.com`

### 6️⃣ **GMAIL_CLIENT_SECRET**
- Same location as Client ID
- In the OAuth 2.0 credentials modal
- Copy the **Client Secret**
- Starts with `GOCSPX-`

### 7️⃣ **GMAIL_REDIRECT_URI**
- This is **fixed**, don't change it:
- `http://localhost:5000/api/gmail/callback`

### 8️⃣ **Other Variables**
- `NODE_ENV` = `development` (for local setup)
- `PORT` = `5000` (backend port)
- `NEXT_PUBLIC_API_URL` = `http://localhost:5000` (connects frontend to backend)

---

## ✅ Quick Setup Checklist

Use this to gather all keys:

```
□ SUPABASE_URL = ___________________
□ SUPABASE_SERVICE_ROLE_KEY = ___________________
□ NEXT_PUBLIC_SUPABASE_ANON_KEY = ___________________
□ OPENAI_API_KEY = ___________________
□ GMAIL_CLIENT_ID = ___________________
□ GMAIL_CLIENT_SECRET = ___________________
□ GMAIL_REDIRECT_URI = http://localhost:5000/api/gmail/callback
```

Once you have all these, create:
1. `backend/.env` with all values
2. `frontend/.env.local` with the Supabase + API URL values

---

## ⚠️ Important Notes

- **Supabase keys:** Service Role stays in backend (.env), Anon key goes in frontend (.env.local)
- **OpenAI:** Requires payment method, but you're only charged for usage
- **Gmail:** OAuth flow happens when user clicks "Connect Gmail" in app
- **Never commit .env files to GitHub** - they're in .gitignore already
- Copy values **exactly** - even one space breaks it
- No quotes needed around values in .env files

---

## 🧪 How to Verify Everything Works

After creating both .env files:

```bash
# Backend
cd backend
npm install
npm run dev
# Should see: Backend server running on http://localhost:5000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
# Should see: started server on 0.0.0.0:3000
```

Then:
1. Open http://localhost:3000
2. Sign up with email/password
3. You should see the dashboard
4. Try uploading a CSV file
5. If it works, all env vars are correct! ✓

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid API key" | Check for extra spaces in .env file |
| "Cannot connect to database" | Verify SUPABASE_URL is correct |
| "OpenAI quota exceeded" | Add payment method to OpenAI account |
| "Gmail not connecting" | Make sure GMAIL_REDIRECT_URI is exact |
| "Port 5000 already in use" | Change PORT to 5001 in backend/.env and NEXT_PUBLIC_API_URL accordingly |
| "Module not found" | Run `npm install` in backend AND frontend folders |

See **TROUBLESHOOTING.md** for more issues.
