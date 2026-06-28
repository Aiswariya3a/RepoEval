import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
import jwt as pyjwt

from app.config import Settings

settings = Settings()


def _load_private_key() -> rsa.RSAPrivateKey:
    key_path = Path(settings.jwt_private_key_path)
    if not key_path.exists():
        raise FileNotFoundError(
            f"JWT private key not found at {key_path}. Run 'make keys' first."
        )
    with open(key_path, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)


def _load_public_key() -> rsa.RSAPublicKey:
    key_path = Path(settings.jwt_public_key_path)
    if not key_path.exists():
        raise FileNotFoundError(
            f"JWT public key not found at {key_path}. Run 'make keys' first."
        )
    with open(key_path, "rb") as f:
        return serialization.load_pem_public_key(f.read())


def create_access_token(user_id: uuid.UUID) -> str:
    private_key = _load_private_key()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_access_token_expire_minutes),
    }
    return pyjwt.encode(payload, private_key, algorithm="RS256")


def create_refresh_token(user_id: uuid.UUID, session_id: uuid.UUID) -> str:
    private_key = _load_private_key()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "sid": str(session_id),
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=settings.jwt_refresh_token_expire_days),
    }
    return pyjwt.encode(payload, private_key, algorithm="RS256")


def verify_access_token(token: str) -> dict | None:
    try:
        public_key = _load_public_key()
        payload = pyjwt.decode(
            token, public_key, algorithms=["RS256"], options={"require": ["sub", "type"]}
        )
        if payload.get("type") != "access":
            return None
        return payload
    except pyjwt.ExpiredSignatureError:
        return None
    except pyjwt.PyJWTError:
        return None


def verify_refresh_token(token: str) -> dict | None:
    try:
        public_key = _load_public_key()
        payload = pyjwt.decode(
            token, public_key, algorithms=["RS256"], options={"require": ["sub", "sid", "type"]}
        )
        if payload.get("type") != "refresh":
            return None
        return payload
    except pyjwt.ExpiredSignatureError:
        return None
    except pyjwt.PyJWTError:
        return None
