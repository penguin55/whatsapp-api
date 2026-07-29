# 🚀 Connect - WhatsApp API Gateway

<p align="center">
  <b>Enterprise-grade WhatsApp API Gateway dengan multi-device support menggunakan Baileys & Fastify</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-≥18.0-green?logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/Fastify-5.x-white?logo=fastify" alt="Fastify" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="License" />
</p>

---

## ✨ Fitur Utama

<table>
  <thead>
    <tr>
      <th>Fitur</th>
      <th>Deskripsi</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>📱 <b>Multi-Session</b></td>
      <td>Kelola banyak sesi WhatsApp dalam satu instance</td>
    </tr>
    <tr>
      <td>🔐 <b>API Key Auth</b></td>
      <td>Autentikasi via <code>x-api-key</code> header per user</td>
    </tr>
    <tr>
      <td>📤 <b>Kirim Pesan</b></td>
      <td>Text, gambar, video, dokumen, audio, sticker</td>
    </tr>
    <tr>
      <td>📣 <b>Broadcast</b></td>
      <td>Kirim pesan ke banyak penerima sekaligus</td>
    </tr>
    <tr>
      <td>⏰ <b>Scheduled Message</b></td>
      <td>Jadwalkan pengiriman pesan otomatis</td>
    </tr>
    <tr>
      <td>👥 <b>Group Management</b></td>
      <td>Buat, kelola anggota, dan kirim ke grup</td>
    </tr>
    <tr>
      <td>🔔 <b>Webhook</b></td>
      <td>Terima event realtime (pesan masuk, status delivery)</td>
    </tr>
    <tr>
      <td>📄 <b>OpenAPI 3.0</b></td>
      <td>Dokumentasi API interaktif via Scalar</td>
    </tr>
    <tr>
      <td>🛡️ <b>Rate Limiting</b></td>
      <td>Proteksi anti-spam (100 req/menit)</td>
    </tr>
    <tr>
      <td>🔄 <b>Auto Reconnect</b></td>
      <td>Reconnect otomatis saat koneksi terputus</td>
    </tr>
  </tbody>
</table>

---

## 🏗️ Arsitektur

This repository uses npm workspaces. The backend lives in `apps/api`, the
React/Vite frontend lives in `apps/dashboard`, and frontend production assets
are generated into `apps/api/public/dashboard`.

```
apps/
├── api/
│   └── src/
├── app.ts                 # Entry point aplikasi
├── config/                # Konfigurasi (env, database, swagger)
├── controllers/           # Handler endpoint API
│   ├── sessionController  # Session & Send message
│   ├── groupController    # Grup & Broadcast
│   ├── scheduleController # Scheduled messages
│   └── userController     # User management
├── middleware/            # Auth middleware
├── models/                # Sequelize models
│   ├── User               # Model user (multi-tenant)
│   ├── Session            # Status & metadata sesi WA
│   ├── AuthKey            # Credential Baileys
│   └── ScheduledMessage   # Antrian pesan terjadwal
├── routes/                # Route definitions
├── services/              # Business logic
│   ├── whatsappService    # Baileys connection manager
│   └── schedulerService   # Cron job scheduler
└── lib/                   # Utility libraries
```

---

## 📋 Prasyarat

- **Node.js** ≥ 18.0.0
- **PostgreSQL** 14+
- **PM2** (untuk production)

---

## ⚡ Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/your-username/whatsapp-api.git
cd whatsapp-api
npm install
```

### 2. Konfigurasi Environment

```bash
cp .env.example .env
```

Edit file `.env`:

```env
# Server
PORT=3000
HOST=0.0.0.0
NODE_ENV=development

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=whatsapp_api
DB_USER=app_owner
DB_PASS=your_password
DB_SSL=false

# API Security
API_SECRET=your-super-secret-api-key

# Logging
LOG_LEVEL=info

# WhatsApp
WA_RECONNECT_INTERVAL=5000
WA_MAX_RECONNECT_RETRIES=5
```

To run only the shared PostgreSQL service, copy the database environment file
and start the dedicated Compose project:

```bash
cp .env.postgres.example .env.postgres
# Set a strong POSTGRES_PASSWORD and list the required databases.
docker compose --env-file .env.postgres -f docker-compose.postgres.yml up -d
```

Every database in `POSTGRES_MULTIPLE_DATABASES` is owned by the single
`POSTGRES_USER` account. Database creation runs only when the data volume is
initialized for the first time.

Other Compose projects can share this PostgreSQL container by joining the
external `wa_gateway_network`. The database has both `postgres` and `db` network
aliases for compatibility. For example, a separately deployed LiteLLM service
can use:

```yaml
services:
  litellm:
    image: docker.litellm.ai/berriai/litellm-database:latest
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/litellm
    networks:
      - gateway

networks:
  gateway:
    name: wa_gateway_network
    external: true
```

Do not use `depends_on` for the PostgreSQL service across separate Compose
projects; Compose cannot resolve cross-project service dependencies. Start
`docker-compose.postgres.yml` first, then start the LiteLLM project.

### Build and publish the API image

The two Compose files have separate responsibilities:

- `docker-compose.postgres.yml` runs only PostgreSQL.
- `docker-compose.yml` runs only the WhatsApp gateway image.

Both services join the Docker network `wa_gateway_network`; the gateway reaches
PostgreSQL using `DB_HOST=postgres`.

On the build machine, log in to Docker Hub and publish the image:

```bash
docker login
DOCKERHUB_USER=ariutomo IMAGE_NAME=wa_gateway_api TAG=2.0 \
  ./build-app.sh
```

`build-app.sh` only builds and pushes the API image. It does not run Docker
Compose or modify a server.

Copy these deployment files to the server separately if you use Compose there:

```text
docker-compose.yml
docker-compose.postgres.yml
docker/postgres/init-multiple-databases.sh
.env
.env.postgres
```

Create the server environment files from `.env.docker.example` and
`.env.postgres.example`. The `DB_USER` and `DB_PASS` values in `.env` must match
`POSTGRES_USER` and `POSTGRES_PASSWORD` in `.env.postgres`.

Pull and start the services from the server:

```bash
docker compose --file docker-compose.postgres.yml up --detach
docker compose --file docker-compose.yml pull api
docker compose --file docker-compose.yml up --detach api
```

### 3. Jalankan Aplikasi

```bash
# Development (hot-reload)
npm run dev

# React frontend development server (run in a second terminal)
npm run dev:dashboard

# Production
npm run build
npm start
```

### 4. Initial Admin User

Saat pertama kali dijalankan dengan tabel user kosong, sistem membuat admin dari
environment variables berikut:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-strong-password
```

> ⚠️ **Segera ganti password default setelah login!**

---

## 📚 API Endpoints

### 🔐 Authentication

Semua endpoint (kecuali `/health` dan `/`) memerlukan header:

```
x-api-key: YOUR_API_KEY
```

Atau via Basic Auth:
```
Authorization: Basic base64(username:password)
```

### 📱 Session Management

<table>
  <thead>
    <tr>
      <th>Method</th>
      <th>Endpoint</th>
      <th>Deskripsi</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>POST</code></td>
      <td><code>/api/session/create</code></td>
      <td>Buat sesi baru, dapatkan QR code</td>
    </tr>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/sessions</code></td>
      <td>List semua sesi user</td>
    </tr>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/session/:id/status</code></td>
      <td>Cek status sesi</td>
    </tr>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/session/:id/qr</code></td>
      <td>Ambil QR code untuk scan</td>
    </tr>
    <tr>
      <td><code>DELETE</code></td>
      <td><code>/api/session/:id</code></td>
      <td>Hapus dan logout sesi</td>
    </tr>
  </tbody>
</table>

### 📤 Messaging

<table>
  <thead>
    <tr>
      <th>Method</th>
      <th>Endpoint</th>
      <th>Deskripsi</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>POST</code></td>
      <td><code>/api/session/:id/send</code></td>
      <td>Kirim pesan (text/media)</td>
    </tr>
    <tr>
      <td><code>POST</code></td>
      <td><code>/api/session/:id/broadcast</code></td>
      <td>Broadcast ke banyak nomor</td>
    </tr>
    <tr>
      <td><code>POST</code></td>
      <td><code>/api/session/:id/send-group</code></td>
      <td>Kirim ke grup</td>
    </tr>
  </tbody>
</table>

### ⏰ Scheduled Messages

<table>
  <thead>
    <tr>
      <th>Method</th>
      <th>Endpoint</th>
      <th>Deskripsi</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>POST</code></td>
      <td><code>/api/session/:id/schedule</code></td>
      <td>Jadwalkan pesan</td>
    </tr>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/session/:id/schedule</code></td>
      <td>List pesan terjadwal</td>
    </tr>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/session/:id/schedule/:msgId</code></td>
      <td>Detail pesan terjadwal</td>
    </tr>
    <tr>
      <td><code>DELETE</code></td>
      <td><code>/api/session/:id/schedule/:msgId</code></td>
      <td>Batalkan jadwal</td>
    </tr>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/session/:id/schedule/history</code></td>
      <td>Riwayat pengiriman</td>
    </tr>
  </tbody>
</table>

### 👥 Group Management

<table>
  <thead>
    <tr>
      <th>Method</th>
      <th>Endpoint</th>
      <th>Deskripsi</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/session/:id/groups</code></td>
      <td>List semua grup</td>
    </tr>
    <tr>
      <td><code>POST</code></td>
      <td><code>/api/session/:id/groups</code></td>
      <td>Buat grup baru</td>
    </tr>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/session/:id/groups/:gid</code></td>
      <td>Info grup</td>
    </tr>
    <tr>
      <td><code>POST</code></td>
      <td><code>/api/session/:id/groups/:gid/add</code></td>
      <td>Tambah member</td>
    </tr>
    <tr>
      <td><code>POST</code></td>
      <td><code>/api/session/:id/groups/:gid/remove</code></td>
      <td>Hapus member</td>
    </tr>
    <tr>
      <td><code>DELETE</code></td>
      <td><code>/api/session/:id/groups/:gid</code></td>
      <td>Keluar dari grup</td>
    </tr>
  </tbody>
</table>

### 👤 User Management (Admin Only)

<table>
  <thead>
    <tr>
      <th>Method</th>
      <th>Endpoint</th>
      <th>Deskripsi</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/users/me</code></td>
      <td>Profile user saat ini</td>
    </tr>
    <tr>
      <td><code>POST</code></td>
      <td><code>/api/users</code></td>
      <td>Buat user baru</td>
    </tr>
    <tr>
      <td><code>GET</code></td>
      <td><code>/api/users</code></td>
      <td>List semua user</td>
    </tr>
    <tr>
      <td><code>PUT</code></td>
      <td><code>/api/users/:id</code></td>
      <td>Update user</td>
    </tr>
    <tr>
      <td><code>DELETE</code></td>
      <td><code>/api/users/:id</code></td>
      <td>Hapus user</td>
    </tr>
    <tr>
      <td><code>POST</code></td>
      <td><code>/api/users/:id/regenerate-key</code></td>
      <td>Generate API key baru</td>
    </tr>
  </tbody>
</table>

---

## 📨 Contoh Request

### Buat Session Baru

```bash
curl -X POST http://localhost:3000/api/session/create \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "my-session",
    "webhook_url": "https://your-server.com/webhook"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_id": "my-session",
    "status": "qr_ready",
    "connected": false,
    "qr": "data:image/png;base64,..."
  }
}
```

### Kirim Pesan Text + Gambar

```bash
curl -X POST http://localhost:3000/api/session/my-session/send \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "6281234567890",
    "message": "Hello from Connect!",
    "media": [
      {
        "type": "image",
        "data": "https://example.com/image.jpg",
        "caption": "Check this out!"
      }
    ]
  }'
```

### Broadcast ke Banyak Nomor

```bash
curl -X POST http://localhost:3000/api/session/my-session/broadcast \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recipients": ["6281111111111", "6282222222222", "6283333333333"],
    "message": "Promo hari ini! 🎉",
    "delay": 2000
  }'
```

### Jadwalkan Pesan

```bash
curl -X POST http://localhost:3000/api/session/my-session/schedule \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient": "6281234567890",
    "message": "Reminder: Meeting jam 10!",
    "scheduled_at": "2025-12-11T03:00:00Z"
  }'
```

---

## 🔔 Webhook Events

Konfigurasikan `webhook_url` saat membuat sesi untuk menerima events:

### `message.received`
```json
{
  "event": "message.received",
  "sessionId": "my-session",
  "timestamp": "2025-12-10T04:30:00Z",
  "data": {
    "type": "notify",
    "messages": [{
      "id": "ABC123",
      "from": "120363345675510843@g.us",
      "fromMe": false,
      "timestamp": 1765326600,
      "chatType": "group",
      "mentionedJids": [
        "83073525899438@lid"
      ],
      "type": "text",
      "text": "@259142019235840 hello!",
      "pushName": "John Doe"
    }]
  }
}
```

### `message.status`
```json
{
  "event": "message.status",
  "sessionId": "my-session",
  "timestamp": "2025-12-10T04:30:05Z",
  "data": [{
    "id": "ABC123",
    "remoteJid": "6281234567890@s.whatsapp.net",
    "status": "delivered",
    "statusCode": 3
  }]
}
```

**Status Codes:**

<table>
  <thead>
    <tr>
      <th>Code</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>pending</td>
    </tr>
    <tr>
      <td>2</td>
      <td>sent</td>
    </tr>
    <tr>
      <td>3</td>
      <td>delivered</td>
    </tr>
    <tr>
      <td>4</td>
      <td>read</td>
    </tr>
    <tr>
      <td>5</td>
      <td>played</td>
    </tr>
  </tbody>
</table>

---

## 🚀 Production Deployment

### Deploy dengan PM2

```bash
# Build aplikasi
npm run build

# Start dengan PM2
pm2 start ecosystem.config.js --env production

# Lihat logs
pm2 logs whatsapp-api

# Monitor
pm2 monit
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📖 API Documentation

Setelah server berjalan, akses dokumentasi interaktif di:

- **Scalar API Docs:** `http://localhost:3000/docs`
- **OpenAPI JSON:** `http://localhost:3000/openapi.json`

---

## 🛠️ Development

```bash
# Development dengan hot-reload
npm run dev

# React dashboard development server
npm run dev:dashboard

# Build all monorepo workspaces
npm run build

# Lint code
npm run lint

# Clean build
npm run clean
```

---

## 📁 Database Schema

### Users

<table>
  <thead>
    <tr>
      <th>Column</th>
      <th>Type</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>id</code></td>
      <td>UUID</td>
      <td>Primary key</td>
    </tr>
    <tr>
      <td><code>username</code></td>
      <td>VARCHAR(100)</td>
      <td>Unique username</td>
    </tr>
    <tr>
      <td><code>email</code></td>
      <td>VARCHAR(255)</td>
      <td>Email (optional)</td>
    </tr>
    <tr>
      <td><code>password</code></td>
      <td>VARCHAR(255)</td>
      <td>Hashed password</td>
    </tr>
    <tr>
      <td><code>api_key</code></td>
      <td>VARCHAR(64)</td>
      <td>Unique API key</td>
    </tr>
    <tr>
      <td><code>role</code></td>
      <td>ENUM</td>
      <td>'admin' | 'user'</td>
    </tr>
    <tr>
      <td><code>is_active</code></td>
      <td>BOOLEAN</td>
      <td>Account status</td>
    </tr>
  </tbody>
</table>

### Sessions

<table>
  <thead>
    <tr>
      <th>Column</th>
      <th>Type</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>id</code></td>
      <td>UUID</td>
      <td>Primary key</td>
    </tr>
    <tr>
      <td><code>session_id</code></td>
      <td>VARCHAR(100)</td>
      <td>Unique session identifier</td>
    </tr>
    <tr>
      <td><code>user_id</code></td>
      <td>UUID</td>
      <td>Foreign key to users</td>
    </tr>
    <tr>
      <td><code>status</code></td>
      <td>ENUM</td>
      <td>connecting | qr_ready | connected | disconnected | logged_out</td>
    </tr>
    <tr>
      <td><code>phone_number</code></td>
      <td>VARCHAR(20)</td>
      <td>Connected phone number</td>
    </tr>
    <tr>
      <td><code>webhook_url</code></td>
      <td>VARCHAR(500)</td>
      <td>Webhook endpoint</td>
    </tr>
  </tbody>
</table>

### Scheduled Messages

<table>
  <thead>
    <tr>
      <th>Column</th>
      <th>Type</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>id</code></td>
      <td>UUID</td>
      <td>Primary key</td>
    </tr>
    <tr>
      <td><code>session_id</code></td>
      <td>VARCHAR(100)</td>
      <td>Related session</td>
    </tr>
    <tr>
      <td><code>recipient</code></td>
      <td>VARCHAR(100)</td>
      <td>Recipient JID</td>
    </tr>
    <tr>
      <td><code>message</code></td>
      <td>TEXT</td>
      <td>Message content</td>
    </tr>
    <tr>
      <td><code>scheduled_at</code></td>
      <td>DATETIME</td>
      <td>Scheduled time</td>
    </tr>
    <tr>
      <td><code>status</code></td>
      <td>ENUM</td>
      <td>pending | sent | failed | cancelled</td>
    </tr>
  </tbody>
</table>

---

## ⚠️ Catatan Penting

1. **Rate Limiting:** API dibatasi 100 request per menit per IP
2. **WhatsApp ToS:** Gunakan dengan bijak untuk menghindari ban
3. **Session Persistence:** Credential disimpan di database, session otomatis restore saat restart
4. **Media Support:** Mendukung URL, file path lokal, dan base64

---

## 📄 License

MIT License - Silakan gunakan dan modifikasi sesuai kebutuhan.

---

## 🤝 Contributing

Pull requests are welcome! Untuk perubahan besar, silakan buka issue terlebih dahulu.

---

<p align="center">
  Made with ❤️ by <a href="https://venusverse.dev">VenusVerse</a>
</p>
