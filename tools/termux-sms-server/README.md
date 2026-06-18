# Termux SMS Server

Small Node.js server for using an Android phone as the SMS sender through Termux + Termux:API.

## Android setup

1. Install Termux from F-Droid.
2. Install the Termux:API app from F-Droid.
3. In Termux, install the needed packages:

```sh
pkg update
pkg install nodejs termux-api
```

4. Allow SMS permission for Termux:API in Android app settings.
5. Copy this folder to the phone, then start the server:

```sh
cd tools/termux-sms-server
export TERMUX_SMS_SERVER_TOKEN="replace-with-a-long-random-token"
export PORT=8787
node server.js
```

Keep Termux running while the web app needs to send SMS messages. The app server must be able to reach the phone on the same network.

## Web app environment

Set these values on the Astro server:

```env
SMS_ENABLED=true
SMS_PROVIDER=termux
TERMUX_SMS_SERVER_URL=http://PHONE_LAN_IP:8787/send-sms
TERMUX_SMS_SERVER_TOKEN=replace-with-the-same-long-random-token
TERMUX_SMS_TIMEOUT_MS=10000
```

`TERMUX_SMS_SERVER_TOKEN` is server-only. Do not expose it in client-side code.

## API

`POST /send-sms`

Headers:

```http
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json
```

Body:

```json
{
  "to": "+639171234567",
  "message": "Your booking has been updated."
}
```

The server validates `to` and `message`, then calls `termux-sms-send` with `spawn` and no shell.
