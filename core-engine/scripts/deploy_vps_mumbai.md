# Production Deployment Guide: AWS ap-south-1 (Mumbai) & DigitalOcean BLR1

This guide details deploying the **Core AI Calling Agent Engine** in Mumbai (AWS `ap-south-1` or DigitalOcean `blr1`) for sub-30ms network hops to Twilio and Exotel voice gateways.

---

## 1. System Requirements

- **OS:** Ubuntu 24.04 LTS or 22.04 LTS x86_64 or ARM64
- **Specifications:** 2 vCPU, 4 GB RAM (e.g. AWS `t4g.medium` or DigitalOcean `s-2vcpu-4gb`)
- **Storage:** 40 GB NVMe SSD
- **Public Domain:** e.g. `voice.yourdomain.com` pointing to the VPS Elastic IP

---

## 2. Server Provisioning & OS Setup

```bash
# Update base system
sudo apt update && sudo apt upgrade -y

# Install essential dependencies, audio libraries, and build tools
sudo apt install -y curl git ufw ffmpeg libportaudio2 sqlite3 build-essential \
    python3-pip python3-venv certbot python3-certbot-nginx nginx

# Configure UFW Firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (Certbot)
sudo ufw allow 443/tcp   # HTTPS & WSS
sudo ufw --force enable
```

---

## 3. Dedicated Service User & Directory

```bash
# Create system user without login privileges
sudo useradd -r -s /bin/false -m -d /opt/calling-agent callingagent

# Set up project directory
sudo mkdir -p /opt/calling-agent
sudo chown -R callingagent:callingagent /opt/calling-agent
```

---

## 4. Code Checkout & Virtual Environment

```bash
cd /opt/calling-agent
sudo -u callingagent git clone https://github.com/your-org/calling-agent-engine.git .

# Create virtualenv and install dependencies
sudo -u callingagent python3 -m venv venv
sudo -u callingagent /opt/calling-agent/venv/bin/pip install --upgrade pip setuptools wheel
sudo -u callingagent /opt/calling-agent/venv/bin/pip install -r requirements.txt
```

---

## 5. Environment Secrets Configuration

```bash
sudo mkdir -p /etc/calling-agent
sudo cp .env.example /etc/calling-agent/.env
sudo chown -R root:callingagent /etc/calling-agent
sudo chmod 640 /etc/calling-agent/.env

# Edit production credentials
sudo nano /etc/calling-agent/.env
```

Ensure the following are set:
```ini
APP_ENV=production
PUBLIC_URL=https://voice.yourdomain.com
DATABASE_URL=sqlite:////opt/calling-agent/calling_agent.db
TELEPHONY_PROVIDER=twilio
GROQ_API_KEY=gsk_...
DEEPGRAM_API_KEY=...
CARTESIA_API_KEY=...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+91...
WEBHOOK_SECRET=your-secure-sha256-secret-key
```

---

## 6. Nginx Reverse Proxy & WebSocket Streaming

Create `/etc/nginx/sites-available/calling-agent`:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    server_name voice.yourdomain.com;

    client_max_body_size 25M;

    # Standard REST API endpoints
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Real-time Telephony WebSocket Streams (Twilio & Exotel)
    location ~* ^/webhooks/(twilio|exotel)/stream {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Keep streaming audio socket alive up to 2 hours
        proxy_read_timeout 7200s;
        proxy_send_timeout 7200s;
        proxy_buffering off;
    }
}
```

Enable site and acquire SSL:
```bash
sudo ln -s /etc/nginx/sites-available/calling-agent /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Issue Let's Encrypt TLS Certificate
sudo certbot --nginx -d voice.yourdomain.com --non-interactive --agree-tos -m admin@yourdomain.com
```

---

## 7. Systemd Service Setup

Install the provided service unit:
```bash
sudo cp /opt/calling-agent/calling-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now calling-agent
sudo systemctl status calling-agent
```

---

## 8. Automated Daily Backups

Add a cron job for daily midnight database backups:
```bash
sudo chmod +x /opt/calling-agent/scripts/backup_db.sh
sudo crontab -e
```
Add:
```cron
0 2 * * * /opt/calling-agent/scripts/backup_db.sh >> /var/log/calling_agent_backup.log 2>&1
```

---

## 9. Verification & Health Check

```bash
curl -i https://voice.yourdomain.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "env": "production",
  "default_telephony": "twilio",
  "active_calls": 0
}
```
