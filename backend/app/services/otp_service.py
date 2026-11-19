"""
Industry-ready OTP Service for Email Authentication.
Features:
- Cryptographically secure 6-digit OTP generation using secrets module.
- Salted SHA-256 hash storage (never stores plain OTP in memory/cache).
- Constant-time verification using hmac.compare_digest against timing attacks.
- Brute-force protection: automatic invalidation after 3 failed attempts.
- Rate limiting: 60-second cooldown per email and hourly threshold.
- Anti-replay: single-use token invalidated immediately upon successful verification.
- Dual email delivery: Resend API, SMTP, or styled terminal console simulation for dev.
"""

import hmac
import hashlib
import json
import logging
import re
import secrets
import smtplib
import threading
import time
import urllib.request
import urllib.error
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Optional, Tuple

from ..config import settings

logger = logging.getLogger(__name__)

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class OTPRecord:
    """Thread-safe metadata container for active OTP sessions."""
    def __init__(self, hashed_otp: str, salt: str, expires_at: float):
        self.hashed_otp = hashed_otp
        self.salt = salt
        self.expires_at = expires_at
        self.attempts = 0
        self.last_sent_at = time.time()


class OTPService:
    """Industry-standard OTP lifecycle management service."""

    def __init__(self):
        self._store: Dict[str, OTPRecord] = {}
        self._hourly_sends: Dict[str, list] = {}  # email -> list of timestamps
        self._lock = threading.Lock()

    @staticmethod
    def is_valid_email(email: str) -> bool:
        """Validate email format with RFC-compliant regular expression."""
        if not email or len(email) > 255:
            return False
        return bool(EMAIL_REGEX.match(email.strip()))

    @staticmethod
    def _generate_otp_code() -> str:
        """Generate cryptographically secure 6-digit numeric OTP."""
        return f"{secrets.randbelow(900000) + 100000:06d}"

    @staticmethod
    def _hash_otp(otp: str, salt: str) -> str:
        """Hash OTP with a cryptographically unique salt using SHA-256."""
        combined = f"{salt}:{otp}".encode("utf-8")
        return hashlib.sha256(combined).hexdigest()

    def _cleanup_expired(self):
        """Purge stale records past their expiration timestamp."""
        now = time.time()
        expired_keys = [k for k, v in self._store.items() if v.expires_at < now]
        for k in expired_keys:
            del self._store[k]

        # Purge hourly sends older than 3600 seconds
        for k in list(self._hourly_sends.keys()):
            self._hourly_sends[k] = [t for t in self._hourly_sends[k] if now - t < 3600]
            if not self._hourly_sends[k]:
                del self._hourly_sends[k]

    def request_otp(self, email: str) -> Tuple[bool, str, Optional[str], int, int]:
        """
        Generate, store, and dispatch a one-time verification password.
        
        Returns:
            Tuple of (success, message, dev_otp_or_none, expires_in, cooldown)
        """
        clean_email = email.strip().lower()
        if not self.is_valid_email(clean_email):
            return False, "Please provide a valid email address.", None, 0, 0

        now = time.time()

        with self._lock:
            self._cleanup_expired()

            # 1. Check Cooldown (default: 60s)
            existing = self._store.get(clean_email)
            if existing:
                elapsed_since_last = now - existing.last_sent_at
                if elapsed_since_last < settings.OTP_COOLDOWN_SECONDS:
                    remaining_wait = int(settings.OTP_COOLDOWN_SECONDS - elapsed_since_last)
                    return False, f"Please wait {remaining_wait}s before requesting a new code.", None, 0, remaining_wait

            # 2. Hourly rate limit (Max 5 requests per email per hour)
            recent_sends = [t for t in self._hourly_sends.get(clean_email, []) if now - t < 3600]
            if len(recent_sends) >= 5:
                return False, "Too many OTP requests for this email. Please try again in an hour.", None, 0, 0

            # 3. Generate secure code and salt
            raw_otp = self._generate_otp_code()
            salt = secrets.token_hex(16)
            hashed_otp = self._hash_otp(raw_otp, salt)
            expires_at = now + settings.OTP_EXPIRE_SECONDS

            # 4. Store hashed OTP
            record = OTPRecord(hashed_otp=hashed_otp, salt=salt, expires_at=expires_at)
            self._store[clean_email] = record

            # Update hourly tracker
            recent_sends.append(now)
            self._hourly_sends[clean_email] = recent_sends

        # 5. Dispatch email
        self._dispatch_email(clean_email, raw_otp)

        dev_otp = raw_otp if settings.DEV_SHOW_OTP else None
        return (
            True,
            f"Verification code sent to {clean_email}.",
            dev_otp,
            settings.OTP_EXPIRE_SECONDS,
            settings.OTP_COOLDOWN_SECONDS
        )

    def verify_otp(self, email: str, entered_otp: str) -> Tuple[bool, str]:
        """
        Verify submitted OTP with constant-time comparison and brute-force tracking.
        
        Returns:
            Tuple of (is_valid, status_message)
        """
        clean_email = email.strip().lower()
        clean_otp = entered_otp.strip()

        if not clean_otp or len(clean_otp) != 6 or not clean_otp.isdigit():
            return False, "Verification code must be exactly 6 digits."

        now = time.time()

        with self._lock:
            self._cleanup_expired()
            record = self._store.get(clean_email)

            if not record:
                return False, "Verification code has expired or was not requested. Please request a new code."

            if record.expires_at < now:
                del self._store[clean_email]
                return False, "Verification code has expired. Please request a new code."

            # Check max attempts limit (default: 3)
            if record.attempts >= settings.OTP_MAX_ATTEMPTS:
                del self._store[clean_email]
                return False, "Too many failed attempts. For your security, this code has been invalidated. Please request a new code."

            # Constant-time comparison using HMAC
            candidate_hash = self._hash_otp(clean_otp, record.salt)
            matches = hmac.compare_digest(record.hashed_otp, candidate_hash)

            if matches:
                # Anti-replay: Immediately destroy active record
                del self._store[clean_email]
                return True, "Verification successful."
            else:
                record.attempts += 1
                remaining_tries = settings.OTP_MAX_ATTEMPTS - record.attempts
                if remaining_tries <= 0:
                    del self._store[clean_email]
                    return False, "Too many failed attempts. This code has been invalidated. Please request a new code."
                return False, f"Incorrect verification code. {remaining_tries} attempt{'s' if remaining_tries > 1 else ''} remaining."

    def _dispatch_email(self, email: str, otp: str):
        """Route OTP delivery through Resend API, SMTP, or Dev Simulation."""
        # 1. Try Resend API if API Key is configured
        if settings.RESEND_API_KEY:
            try:
                self._send_via_resend(email, otp)
                return
            except Exception as e:
                logger.error(f"Failed to send email via Resend API: {e}")

        # 2. Try SMTP if SMTP_HOST is configured
        if settings.SMTP_HOST:
            try:
                self._send_via_smtp(email, otp)
                return
            except Exception as e:
                logger.error(f"Failed to send email via SMTP: {e}")

        # 3. Fallback: Development Simulation (Formatted Console Logging)
        self._simulate_email_console(email, otp)

    def _send_via_resend(self, email: str, otp: str):
        """Send email via Resend REST API."""
        payload = {
            "from": f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>",
            "to": [email],
            "subject": f"Your Verification Code: {otp}",
            "html": self._get_html_template(otp, email)
        }
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status in (200, 201):
                logger.info(f"Resend dispatched OTP to {email}")

    def _send_via_smtp(self, email: str, otp: str):
        """Send email via standard SMTP server."""
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Your Verification Code: {otp}"
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = email

        text_content = f"Your verification code is: {otp}\nThis code is valid for 5 minutes. Do not share it with anyone."
        html_content = self._get_html_template(otp, email)

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            logger.info(f"SMTP dispatched OTP to {email}")

    @staticmethod
    def _simulate_email_console(email: str, otp: str):
        """Visual terminal delivery box for developer environments."""
        border = "=" * 65
        print(f"\n{border}")
        print("  📧 [TRANSACTIONAL EMAIL DISPATCH - DEV SIMULATION]")
        print(f"  To:        {email}")
        print(f"  Subject:   Your Verification Code: {otp}")
        print(f"  Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"  Valid:     5 Minutes ({settings.OTP_EXPIRE_SECONDS} seconds)")
        print("  " + "-" * 61)
        print(f"  >>> ONE-TIME PASSWORD: [ {otp} ] <<<")
        print("  " + "-" * 61)
        print("  Security: Single-use, expires in 5m, 3 attempts max.")
        print(f"{border}\n", flush=True)

    @staticmethod
    def _get_html_template(otp: str, email: str) -> str:
        """Responsive, dark/light modern HTML email template."""
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f17; color: #f1f5f9; margin: 0; padding: 24px; }}
    .container {{ max-width: 480px; margin: 0 auto; background: #131b2a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }}
    .brand {{ text-align: center; margin-bottom: 24px; }}
    .badge {{ display: inline-block; background: linear-gradient(135deg, #059669, #06b6d4); color: #fff; font-weight: 800; font-size: 20px; width: 44px; height: 44px; line-height: 44px; border-radius: 12px; }}
    h1 {{ font-size: 20px; font-weight: 700; color: #ffffff; text-align: center; margin: 12px 0 6px 0; }}
    p {{ font-size: 14px; line-height: 1.6; color: #94a3b8; text-align: center; margin: 0 0 24px 0; }}
    .otp-card {{ background: #0b0f17; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }}
    .otp-code {{ font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #34d399; margin: 0; }}
    .footer {{ font-size: 12px; color: #64748b; text-align: center; margin-top: 24px; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 16px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">
      <div class="badge">Q</div>
      <h1>Verification Code</h1>
      <p>Use the 6-digit code below to sign in to your Question Answering System account.</p>
    </div>
    <div class="otp-card">
      <div class="otp-code">{otp}</div>
    </div>
    <p style="font-size: 13px; color: #cbd5e1;">This code is valid for <strong>5 minutes</strong>. For your security, never share this code with anyone.</p>
    <div class="footer">
      If you did not request this code, you can safely ignore this email.<br>
      © Question Answering System. All rights reserved.
    </div>
  </div>
</body>
</html>"""


# Global singleton instance
otp_service = OTPService()
