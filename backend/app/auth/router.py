import logging
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from urllib.parse import quote

from fastapi import APIRouter, Request, Response, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.config import Settings
from app.database import get_db, async_session
from app.models.user import User
from app.models.session import Session
from app.auth.jwt_service import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
)
from app.auth.dependencies import get_current_user
from app.auth.schemas import UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = Settings()
logger = logging.getLogger(__name__)

ACCESS_COOKIE_NAME = "access_token"
REFRESH_COOKIE_NAME = "refresh_token"
STATE_COOKIE_NAME = "oauth_state"


def _set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
) -> None:
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        samesite="strict",
        secure=False,
        max_age=settings.jwt_access_token_expire_minutes * 60,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        samesite="strict",
        secure=False,
        max_age=settings.jwt_refresh_token_expire_days * 86400,
        path="/api/auth",
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key=ACCESS_COOKIE_NAME, path="/")
    response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/api/auth")
    response.delete_cookie(key=STATE_COOKIE_NAME, path="/api/auth")


def _build_authorize_url(state: str) -> str:
    redirect_uri = settings.github_redirect_uri
    print(f"[oauth] client_id={settings.github_client_id} redirect_uri={redirect_uri}")
    logger.info(
        "GitHub OAuth login request: client_id=%s redirect_uri=%s",
        settings.github_client_id,
        redirect_uri,
    )
    return (
        "https://github.com/login/oauth/authorize"
        f"?client_id={quote(settings.github_client_id, safe='')}"
        f"&redirect_uri={quote(redirect_uri, safe='')}"
        f"&state={state}"
        "&scope=read:user+user:email"
    )


@router.get("/login")
async def login():
    state = secrets.token_urlsafe(32)
    authorize_url = _build_authorize_url(state)
    redirect_url = Response(
        status_code=status.HTTP_307_TEMPORARY_REDIRECT,
        headers={"Location": authorize_url},
    )
    redirect_url.set_cookie(
        key=STATE_COOKIE_NAME,
        value=state,
        httponly=True,
        samesite="strict",
        secure=False,
        max_age=600,
        path="/api/auth",
    )
    return redirect_url


@router.get("/callback")
async def callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    if error:
        redirect = Response(
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            headers={"Location": f"{settings.frontend_url}/sign-in?error=generic"},
        )
        _clear_auth_cookies(redirect)
        return redirect

    stored_state = request.cookies.get(STATE_COOKIE_NAME)
    if not state or not stored_state or state != stored_state:
        redirect = Response(
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            headers={"Location": f"{settings.frontend_url}/sign-in?error=generic"},
        )
        _clear_auth_cookies(redirect)
        return redirect

    if not code:
        redirect = Response(
            status_code=status.HTTP_307_TEMPORARY_REDIRECT,
            headers={"Location": f"{settings.frontend_url}/sign-in?error=generic"},
        )
        _clear_auth_cookies(redirect)
        return redirect

    logger.info(
        "GitHub OAuth callback exchange: client_id=%s redirect_uri=%s",
        settings.github_client_id,
        settings.github_redirect_uri,
    )

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        if token_resp.status_code != 200:
            redirect = Response(
                status_code=status.HTTP_307_TEMPORARY_REDIRECT,
                headers={"Location": f"{settings.frontend_url}/sign-in?error=generic"},
            )
            _clear_auth_cookies(redirect)
            return redirect

        token_data = token_resp.json()
        github_access_token = token_data.get("access_token")
        if not github_access_token:
            redirect = Response(
                status_code=status.HTTP_307_TEMPORARY_REDIRECT,
                headers={"Location": f"{settings.frontend_url}/sign-in?error=generic"},
            )
            _clear_auth_cookies(redirect)
            return redirect

        user_resp = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {github_access_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        if user_resp.status_code != 200:
            redirect = Response(
                status_code=status.HTTP_307_TEMPORARY_REDIRECT,
                headers={"Location": f"{settings.frontend_url}/sign-in?error=generic"},
            )
            _clear_auth_cookies(redirect)
            return redirect

        github_user = user_resp.json()

    github_id = github_user["id"]
    email = github_user.get("email")
    display_name = github_user.get("name") or github_user["login"]
    avatar_url = github_user.get("avatar_url")

    async with async_session() as db:
        result = await db.execute(select(User).where(User.github_id == github_id))
        user = result.scalar_one_or_none()

        if user:
            user.display_name = display_name
            if email:
                user.email = email
            if avatar_url:
                user.avatar_url = avatar_url
            user.updated_at = datetime.now(timezone.utc)
        else:
            user = User(
                github_id=github_id,
                email=email,
                display_name=display_name,
                avatar_url=avatar_url,
            )
            db.add(user)

        await db.flush()

        session_id = uuid.uuid4()
        refresh_token_value = secrets.token_urlsafe(64)

        session = Session(
            id=session_id,
            user_id=user.id,
            refresh_token=refresh_token_value,
            expires_at=datetime.now(timezone.utc)
            + timedelta(days=settings.jwt_refresh_token_expire_days),
        )
        db.add(session)
        await db.commit()

    access_token = create_access_token(user.id)
    refresh_jwt = create_refresh_token(user.id, session_id)

    redirect = Response(
        status_code=status.HTTP_307_TEMPORARY_REDIRECT,
        headers={"Location": f"{settings.frontend_url}/dashboard"},
    )
    _set_auth_cookies(redirect, access_token, refresh_jwt)
    redirect.delete_cookie(key=STATE_COOKIE_NAME, path="/api/auth")
    return redirect


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_cookie = request.cookies.get(REFRESH_COOKIE_NAME)
    if refresh_cookie:
        payload = verify_refresh_token(refresh_cookie)
        if payload:
            session_id_str = payload.get("sid")
            if session_id_str:
                try:
                    sid = uuid.UUID(session_id_str)
                    result = await db.execute(select(Session).where(Session.id == sid))
                    session = result.scalar_one_or_none()
                    if session:
                        session.revoked = True
                        await db.commit()
                except ValueError:
                    pass

    _clear_auth_cookies(response)
    return {"detail": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)


@router.post("/refresh")
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    refresh_cookie = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_cookie:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token provided",
        )

    payload = verify_refresh_token(refresh_cookie)
    if payload is None:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id_str = payload.get("sub")
    session_id_str = payload.get("sid")
    if not user_id_str or not session_id_str:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    try:
        user_id = uuid.UUID(user_id_str)
        session_id = uuid.UUID(session_id_str)
    except ValueError:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token claims",
        )

    result = await db.execute(
        select(Session).where(
            Session.id == session_id,
            Session.user_id == user_id,
            Session.revoked is False,
            Session.expires_at > datetime.now(timezone.utc),
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        _clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session revoked or expired",
        )

    session.revoked = True

    new_session_id = uuid.uuid4()
    new_refresh_token_value = secrets.token_urlsafe(64)
    new_session = Session(
        id=new_session_id,
        user_id=user_id,
        refresh_token=new_refresh_token_value,
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=settings.jwt_refresh_token_expire_days),
    )
    db.add(new_session)
    await db.commit()

    new_access_token = create_access_token(user_id)
    new_refresh_jwt = create_refresh_token(user_id, new_session_id)

    _set_auth_cookies(response, new_access_token, new_refresh_jwt)
    return {
        "detail": "Tokens refreshed",
        "access_token_expires_in": settings.jwt_access_token_expire_minutes * 60,
    }
