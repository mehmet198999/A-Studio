"""
OAuth2 automation service.

Gmail:    Standard SMTP+App Password (Google does NOT support ROPC).
          App Password = 16-char code from Google account security settings.
          Works exactly like a regular password for IMAP/SMTP.

Outlook:  Supports ROPC (Resource Owner Password Credentials).
          Sends email+password directly to Microsoft token endpoint.
          Returns access_token + refresh_token for XOAUTH2.
          Requires Azure AD app registration (free).

Firstmail: Standard SMTP/IMAP with username+password. No OAuth2 needed.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

import requests

# ── Outlook / Microsoft ───────────────────────────────────────────────────────

# Default: use the publicly registered Microsoft "common" app.
# For production with many accounts, register your own Azure AD app:
# https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
# → New registration → "Accounts in any Microsoft account tenant (personal)"
# → Add redirect URI: http://localhost
# → API permissions: IMAP.AccessAsUser.All, SMTP.Send, offline_access

MICROSOFT_TOKEN_URL_TEMPLATE = (
    "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
)
MICROSOFT_SCOPE = (
    "https://outlook.office.com/IMAP.AccessAsUser.All "
    "https://outlook.office.com/SMTP.Send "
    "offline_access"
)


def _get_ms_tenant(email: str) -> str:
    """Return 'consumers' for personal accounts, 'organizations' for work."""
    domain = email.split("@")[-1].lower()
    personal = {"outlook.com", "hotmail.com", "live.com", "msn.com", "live.de",
                "hotmail.de", "outlook.de", "live.at", "hotmail.at"}
    return "consumers" if domain in personal else "common"


def get_outlook_token_ropc(
    email: str,
    password: str,
    client_id: Optional[str] = None,
) -> dict:
    """
    Obtain Outlook OAuth2 tokens using ROPC (email + password).
    Returns: {"access_token": ..., "refresh_token": ..., "expires_in": ...}

    client_id: Your Azure AD app client ID.
                Falls back to OUTLOOK_CLIENT_ID env var.
                Users MUST register their own app for bulk use.
    """
    client_id = client_id or os.environ.get("OUTLOOK_CLIENT_ID", "")
    if not client_id:
        raise ValueError(
            "OUTLOOK_CLIENT_ID not set. Register a free Azure AD app at "
            "https://portal.azure.com and add OUTLOOK_CLIENT_ID to your .env"
        )

    tenant = _get_ms_tenant(email)
    url = MICROSOFT_TOKEN_URL_TEMPLATE.format(tenant=tenant)

    resp = requests.post(url, data={
        "grant_type": "password",
        "client_id": client_id,
        "username": email,
        "password": password,
        "scope": MICROSOFT_SCOPE,
    }, timeout=15)

    if not resp.ok:
        err = resp.json().get("error_description", resp.text)
        raise ValueError(f"Outlook ROPC failed for {email}: {err}")

    data = resp.json()
    return {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token", ""),
        "expires_in": data.get("expires_in", 3600),
        "token_expiry": datetime.utcnow() + timedelta(seconds=data.get("expires_in", 3600) - 60),
    }


def refresh_outlook_token(refresh_token: str, client_id: Optional[str] = None) -> dict:
    """Refresh an existing Outlook access token."""
    client_id = client_id or os.environ.get("OUTLOOK_CLIENT_ID", "")
    if not client_id:
        raise ValueError("OUTLOOK_CLIENT_ID not set")

    resp = requests.post(
        MICROSOFT_TOKEN_URL_TEMPLATE.format(tenant="common"),
        data={
            "grant_type": "refresh_token",
            "client_id": client_id,
            "refresh_token": refresh_token,
            "scope": MICROSOFT_SCOPE,
        },
        timeout=15,
    )
    if not resp.ok:
        raise ValueError(f"Token refresh failed: {resp.text}")

    data = resp.json()
    return {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token", refresh_token),
        "expires_in": data.get("expires_in", 3600),
        "token_expiry": datetime.utcnow() + timedelta(seconds=data.get("expires_in", 3600) - 60),
    }


# ── Gmail ─────────────────────────────────────────────────────────────────────

def validate_gmail_app_password(email: str, app_password: str) -> bool:
    """
    Gmail does NOT support ROPC. App Passwords must be used.

    How to generate an App Password:
    1. Go to https://myaccount.google.com/security
    2. Enable 2-Step Verification
    3. Search "App Passwords" → Generate → Copy 16-char code
    4. Use that code as the password in CSV (spaces optional)

    This function tests if the app password is valid via IMAP.
    """
    import imaplib
    try:
        pw = app_password.replace(" ", "")
        imap = imaplib.IMAP4_SSL("imap.gmail.com", 993)
        imap.login(email, pw)
        imap.logout()
        return True
    except Exception:
        return False


# ── Provider auto-detection ───────────────────────────────────────────────────

def detect_provider(email: str) -> str:
    """Auto-detect provider from email domain."""
    domain = email.split("@")[-1].lower()
    if domain in {"gmail.com", "googlemail.com"}:
        return "gmail"
    if domain in {"outlook.com", "hotmail.com", "live.com", "msn.com",
                  "live.de", "hotmail.de", "outlook.de", "live.at", "hotmail.at",
                  "live.fr", "hotmail.fr", "live.co.uk", "hotmail.co.uk"}:
        return "outlook"
    if domain in {"firstmail.ltd"}:
        return "firstmail"
    return "custom"
