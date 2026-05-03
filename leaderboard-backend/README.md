# Leaderboard Backend

This folder contains a standalone Ubuntu-friendly backend for `lb.yeetryan.com`.

It stores one file per user. Example:

```json
{
  "yeeps0299": "5"
}
```

If the same user posts another score, the backend adds the new value to the existing value.

## What It Does

- `POST /api/scores`
  Accepts JSON like:

  ```json
  {
    "yeeps0299": "2"
  }
  ```

  If `data/yeeps0299.json` already contains:

  ```json
  {
    "yeeps0299": "3"
  }
  ```

  it becomes:

  ```json
  {
    "yeeps0299": "5"
  }
  ```

- `GET /`
  Returns the top 10 users in plain text:

  ```text
  yeeps0299: 5
  sigmarizz: 3
  whathts: 1
  ```

- `GET /leaderboard`
  Same output as `/`

- `GET /leaderboard/:userId`
  Returns one user in plain text:

  ```text
  yeeps0299: 5
  ```

- `GET /api/leaderboard`
  Returns the top 10 in JSON for frontend use

- `GET /api/leaderboard/:userId`
  Returns one user in JSON

- `GET /health`
  Simple health check

## Request Format

You do not need any URL params or query params for the score submission request.

Use:

```http
POST /api/scores
Content-Type: application/json
```

Example body:

```json
{
  "yeeps0299": "2"
}
```

You can also send multiple users in one request if you want:

```json
{
  "yeeps0299": "2",
  "sigmarizz": "1"
}
```

## Local Setup

Requirements:

- Ubuntu Linux
- Node.js 20 or newer
- npm

Install Node.js 20 on Ubuntu:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Start the backend:

```bash
cd leaderboard-backend
npm install
npm start
```

By default it runs on port `3000`.

## Environment Variables

Copy the example env file if you want to customize settings:

```bash
cp .env.example .env
```

Available values:

- `PORT`
- `DATA_DIR`

Default values:

```env
PORT=3000
DATA_DIR=./data
```

## Test Requests

Add a score:

```bash
curl -X POST http://localhost:3000/api/scores \
  -H "Content-Type: application/json" \
  -d '{"yeeps0299":"2"}'
```

Get the leaderboard:

```bash
curl http://localhost:3000/
```

Get one user:

```bash
curl http://localhost:3000/leaderboard/yeeps0299
```

## Ubuntu Service Setup

You can keep the backend running in the background with `systemd`.

1. Copy the project to your Ubuntu server.
2. Run `npm install` inside `leaderboard-backend`.
3. Copy `leaderboard-backend.service` to `/etc/systemd/system/`.
4. Update the `WorkingDirectory` and `ExecStart` paths in the service file.
5. Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable leaderboard-backend
sudo systemctl start leaderboard-backend
sudo systemctl status leaderboard-backend
```

## Nginx Reverse Proxy For `lb.yeetryan.com`

Example Nginx config:

```nginx
server {
    server_name lb.yeetryan.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

After that, reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Notes

- User IDs are sanitized to letters, numbers, dots, underscores, and hyphens before a file is created.
- Scores must be whole numbers greater than or equal to `0`.
- The plain-text leaderboard only returns the top `10` entries.
- If you later want Discord-style formatting like `<@123456789>: 5`, I can change the plain-text formatter for you.
