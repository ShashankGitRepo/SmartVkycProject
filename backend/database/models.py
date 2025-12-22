from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, date
from enum import Enum

class DocTypeEnum(str, Enum):
    AADHAAR = "aadhaar_card"
    PAN = "pan_card"
    VOTER_ID = "voter_id"
    DRIVING_LICENSE = "driving_license"
    PASSPORT = "passport"

class UserCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone_number: Optional[str] = None
    password: str
    role: str = "client"
    admin_secret: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    birth_date: Optional[date] = None

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    birth_date: Optional[date] = None
    phone_number: Optional[str] = Field(None, pattern=r'^\+?[0-9]+$')     
    role: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=8, max_length=72, description="Current password")
    new_password: str = Field(..., min_length=8, max_length=72, description="New password")

class MessageResponse(BaseModel):
    message: str

class DocumentResponse(BaseModel):
    id: int
    file_url: str
    doc_type: str
    is_verified: bool
    uploaded_at: datetime
    
    class Config:
        from_attributes = True

class MeetingCreate(BaseModel):
    title: Optional[str] = "New Meeting"

class MeetingResponse(BaseModel):
    meeting_code: str
    title: Optional[str] = "New Meeting"
    host_id: int
    created_at: Optional[datetime] = None 
    join_url: str
    
    class Config:
        from_attributes = True

class VerificationResultCreate(BaseModel):
    meeting_id: int
    client_id: int
    liveness_score: float
    deepfake_score: float
    face_match_score: float
    is_pass: bool
    failure_reason: Optional[str] = None

class VerificationResultResponse(VerificationResultCreate):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True