from ipaddress import ip_address
from typing import Any

def normalize_text(value: Any) -> str | None:
    if value is None:
        return None
    text = " ".join(str(value).strip().split())
    return text or None

def normalize_ip(value: Any) -> str | None:
    text = normalize_text(value)
    if text is None:
        return None
    if text.count(".") == 3:
        parts = text.split(".")
        try:
            octets = [int(part, 10) for part in parts]
        except ValueError as exc:
            raise ValueError("Invalid IP address") from exc
        if any(octet < 0 or octet > 255 for octet in octets):
            raise ValueError("Invalid IP address")
        return ".".join(str(octet) for octet in octets)
    try:
        return str(ip_address(text))
    except ValueError as exc:
        raise ValueError("Invalid IP address") from exc

def normalize_coordinate(value: Any, minimum: float, maximum: float, name: str) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid {name}") from exc
    if not minimum <= number <= maximum:
        raise ValueError(f"Invalid {name}")
    return number
