from datetime import datetime
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.security import verify_password, create_access_token
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    name: str
    role: str


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    user = await User.find_one(User.email == body.email.lower())
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    user.last_login = datetime.utcnow()
    await user.save()

    return LoginResponse(
        access_token=create_access_token(str(user.id)),
        user_id=str(user.id),
        name=user.full_name,
        role=user.role,
    )
