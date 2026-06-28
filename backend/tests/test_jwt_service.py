import pytest
from app.auth.jwt_service import (
    create_access_token,
    create_refresh_token,
    verify_access_token,
    verify_refresh_token,
)
import uuid


class TestJWTAccessToken:
    def test_create_and_verify_access_token(self):
        user_id = uuid.uuid4()
        token = create_access_token(user_id)
        assert token is not None
        assert isinstance(token, str)

        payload = verify_access_token(token)
        assert payload is not None
        assert payload["sub"] == str(user_id)
        assert payload["type"] == "access"
        assert "exp" in payload
        assert "iat" in payload

    def test_verify_invalid_token_returns_none(self):
        assert verify_access_token("invalid.token.here") is None

    def test_verify_tampered_token_returns_none(self):
        user_id = uuid.uuid4()
        token = create_access_token(user_id)
        parts = token.split(".")
        tampered = parts[0] + "." + parts[1] + ".invalidsignature"
        assert verify_access_token(tampered) is None

    def test_refresh_token_rejected_by_access_verifier(self):
        user_id = uuid.uuid4()
        session_id = uuid.uuid4()
        refresh = create_refresh_token(user_id, session_id)
        assert verify_access_token(refresh) is None


class TestJWTRefreshToken:
    def test_create_and_verify_refresh_token(self):
        user_id = uuid.uuid4()
        session_id = uuid.uuid4()
        token = create_refresh_token(user_id, session_id)
        assert token is not None

        payload = verify_refresh_token(token)
        assert payload is not None
        assert payload["sub"] == str(user_id)
        assert payload["sid"] == str(session_id)
        assert payload["type"] == "refresh"

    def test_access_token_rejected_by_refresh_verifier(self):
        user_id = uuid.uuid4()
        access = create_access_token(user_id)
        assert verify_refresh_token(access) is None

    def test_expired_token_returns_none(self):
        import jwt as pyjwt
        from cryptography.hazmat.primitives import serialization
        from datetime import datetime, timezone, timedelta
        from app.auth.jwt_service import _load_private_key

        key = _load_private_key()
        payload = {
            "sub": str(uuid.uuid4()),
            "type": "access",
            "iat": datetime.now(timezone.utc) - timedelta(hours=1),
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        }
        expired = pyjwt.encode(payload, key, algorithm="RS256")
        assert verify_access_token(expired) is None
