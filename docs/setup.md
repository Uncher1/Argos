# Building Argos yourself

You only need this guide to build Argos from the source code. To simply use it, download the installer from the [Releases](https://github.com/Uncher1/Argos/releases/latest) page.

## 1. Register an application with Twitch

Twitch asks every application that reads data from an account to be registered. It is free.

1. Open https://dev.twitch.tv/console/apps and log in with your Twitch account.
   Twitch requires two-factor authentication (2FA) on your account to create an application. If it is not on yet, turn it on first in Twitch's security settings.
2. Click **Register Your Application**.
3. Fill in the form:
   - **Name**: `Argos` followed by something that makes it unique, for example your name (the name must be unique across Twitch, and it is shown on the consent page).
   - **OAuth Redirect URLs**: `http://localhost/auth/callback`, then click **Add**.
   - **Category**: `Application Integration`.
   - **Client Type**: `Confidential`.
4. Complete the captcha, then click **Create**.
5. In the list, click **Manage** next to the application and copy the **Client ID**. You do not need the client secret.

## 2. Build the installer

You need Windows, Node.js 24 and npm 11. From the project folder:

1. Copy `config/twitch.example.json` to `config/twitch.json` and put your Client ID in it:
   ```json
   { "clientId": "your-client-id" }
   ```
2. Run `npm install` (once), then `npm run dist`.
3. The installer is created as `dist/Argos-Setup-<version>.exe`.

## 3. Install

Double-click the installer. As the application is not signed by a known publisher, Windows may show "Windows protected your PC": click **More info**, then **Run anyway**. An **Argos** shortcut appears on the desktop and in the Start menu.

## 4. First launch

1. **Language**: pick the language of the app. Twitch pages shown inside Argos (sign-in, channel pages) follow it too. You can change it later by right-clicking the tab at the top of the window.
2. **Sign-in**: click "Log in with Twitch" and sign in with your Twitch username (or email) and password. Google refuses sign-in inside apps, so Argos hides the "Continue with Google" button. If your account has no password, click Twitch's "Trouble logging in?" link: Twitch emails you a link to create one.

If something does not work, open an issue on GitHub and describe what you saw.
