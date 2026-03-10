"""
Domain reputation checks using free/open-source DNS-based methods.
No API keys required. Uses:
  - DNS MX record check
  - SPF (TXT record _spf / v=spf1)
  - DKIM (TXT record default._domainkey)
  - DMARC (TXT record _dmarc)
  - DNSBL blacklist checks (Spamhaus, SpamCop, Barracuda, SORBS, etc.)
"""

import ipaddress
import socket
from typing import Optional

try:
    import dns.resolver
    HAS_DNSPYTHON = True
except ImportError:
    HAS_DNSPYTHON = False


# ── DNS helpers ───────────────────────────────────────────────────────────────

def _txt_lookup(name: str) -> Optional[str]:
    """Return first TXT record value or None."""
    try:
        if HAS_DNSPYTHON:
            answers = dns.resolver.resolve(name, "TXT", lifetime=5)
            for rdata in answers:
                return "".join(s.decode() for s in rdata.strings)
        else:
            import subprocess
            result = subprocess.run(
                ["dig", "+short", "TXT", name],
                capture_output=True, text=True, timeout=5
            )
            out = result.stdout.strip().strip('"')
            return out if out else None
    except Exception:
        return None


def _mx_lookup(domain: str) -> Optional[str]:
    try:
        if HAS_DNSPYTHON:
            answers = dns.resolver.resolve(domain, "MX", lifetime=5)
            mx = sorted(answers, key=lambda r: r.preference)[0]
            return str(mx.exchange).rstrip(".")
        else:
            import subprocess
            result = subprocess.run(
                ["dig", "+short", "MX", domain],
                capture_output=True, text=True, timeout=5
            )
            out = result.stdout.strip()
            return out if out else None
    except Exception:
        return None


def _a_lookup(name: str) -> Optional[str]:
    try:
        return socket.gethostbyname(name)
    except Exception:
        return None


# ── DNSBL check ───────────────────────────────────────────────────────────────

# Free, widely-used DNSBL zones
DNSBL_ZONES = [
    ("Spamhaus SBL", "sbl.spamhaus.org"),
    ("Spamhaus XBL", "xbl.spamhaus.org"),
    ("Spamhaus PBL", "pbl.spamhaus.org"),
    ("SpamCop", "bl.spamcop.net"),
    ("Barracuda", "b.barracudacentral.org"),
    ("SORBS SPAM", "spam.sorbs.net"),
    ("SURBL", "multi.surbl.org"),
    ("URIBL", "multi.uribl.com"),
]


def _check_ip_in_dnsbl(ip: str, dnsbl_zone: str) -> bool:
    """Check if IP is listed in a DNSBL zone."""
    try:
        reversed_ip = ".".join(reversed(ip.split(".")))
        query = f"{reversed_ip}.{dnsbl_zone}"
        socket.setdefaulttimeout(3)
        socket.gethostbyname(query)
        return True  # If it resolves, IP is listed
    except socket.gaierror:
        return False  # NXDOMAIN = not listed
    except Exception:
        return False


def _resolve_domain_to_ip(domain: str) -> Optional[str]:
    try:
        return socket.gethostbyname(domain)
    except Exception:
        return None


# ── Main reputation check ─────────────────────────────────────────────────────

def check_domain_reputation(domain: str) -> dict:
    """
    Comprehensive domain reputation check.
    Returns dict compatible with DomainReputation schema.
    """
    # 1. MX Record
    mx_value = _mx_lookup(domain)
    mx = {"record": "MX", "found": bool(mx_value), "value": mx_value}

    # 2. SPF
    spf_value = _txt_lookup(domain)
    if spf_value and "v=spf1" in spf_value:
        spf = {"record": "SPF", "found": True, "value": spf_value[:100]}
    else:
        spf_value2 = _txt_lookup(f"_spf.{domain}")
        spf = {
            "record": "SPF",
            "found": bool(spf_value2 and "v=spf1" in spf_value2),
            "value": (spf_value2 or "")[:100] or None,
        }

    # 3. DKIM (check default selector)
    dkim_value = _txt_lookup(f"default._domainkey.{domain}")
    dkim = {
        "record": "DKIM",
        "found": bool(dkim_value and "v=DKIM1" in dkim_value),
        "value": (dkim_value or "")[:80] or None,
    }

    # 4. DMARC
    dmarc_value = _txt_lookup(f"_dmarc.{domain}")
    dmarc = {
        "record": "DMARC",
        "found": bool(dmarc_value and "v=DMARC1" in dmarc_value),
        "value": (dmarc_value or "")[:100] or None,
    }

    # 5. DNSBL checks (resolve domain IP first)
    domain_ip = _resolve_domain_to_ip(domain)
    blacklists = []

    if domain_ip:
        for bl_name, bl_zone in DNSBL_ZONES:
            listed = _check_ip_in_dnsbl(domain_ip, bl_zone)
            blacklists.append({
                "name": bl_name,
                "listed": listed,
                "detail": f"IP {domain_ip} gelistet" if listed else None,
            })
    else:
        for bl_name, _ in DNSBL_ZONES:
            blacklists.append({
                "name": bl_name,
                "listed": False,
                "detail": "IP nicht auflösbar",
            })

    # 6. Score calculation
    score = 100
    if not mx["found"]:
        score -= 25
    if not spf["found"]:
        score -= 20
    if not dkim["found"]:
        score -= 20
    if not dmarc["found"]:
        score -= 15

    listed_count = sum(1 for bl in blacklists if bl["listed"])
    score -= listed_count * 10
    score = max(0, score)

    if score >= 80:
        score_label = "Gut"
    elif score >= 50:
        score_label = "Mittel"
    else:
        score_label = "Schlecht"

    return {
        "domain": domain,
        "mx": mx,
        "spf": spf,
        "dkim": dkim,
        "dmarc": dmarc,
        "blacklists": blacklists,
        "score": score,
        "score_label": score_label,
    }
