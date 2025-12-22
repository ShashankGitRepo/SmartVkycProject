from sqlalchemy import Column, Integer, String, TIMESTAMP, Date, ForeignKey, Boolean, Float, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database.database import Base
import enum

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    CLIENT = "client"

class MeetingStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    COMPLETED = "completed"

class DocType(str, enum.Enum):
    AADHAAR = "aadhaar_card"
    PAN = "pan_card"
    VOTER_ID = "voter_id"
    DRIVING_LICENSE = "driving_license"
    PASSPORT = "passport"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    birth_date = Column(Date, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    phone_number = Column(String(20), nullable=True)
    
    role = Column(String(50), default=UserRole.CLIENT.value) 
    created_at = Column(TIMESTAMP, server_default=func.now())

    documents = relationship("Document", back_populates="user")
    hosted_meetings = relationship("Meeting", foreign_keys="Meeting.host_id", back_populates="host")
    guest_meetings = relationship("Meeting", foreign_keys="Meeting.client_id", back_populates="client")
    verification_results = relationship("VerificationResult", back_populates="client")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    file_url = Column(String(2048), nullable=False) 
    
    doc_type = Column(String(50), nullable=False) 
    is_verified = Column(Boolean, default=False)
    uploaded_at = Column(TIMESTAMP, server_default=func.now())

    user = relationship("User", back_populates="documents")


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_code = Column(String(36), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=True, default="New Meeting")

    host_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False) 
    client_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True) 
    
    start_time = Column(TIMESTAMP, nullable=True)
    end_time = Column(TIMESTAMP, nullable=True)
    status = Column(String(50), default=MeetingStatus.SCHEDULED.value)
    
    created_at = Column(TIMESTAMP, server_default=func.now())

    host = relationship("User", foreign_keys=[host_id], back_populates="hosted_meetings")
    client = relationship("User", foreign_keys=[client_id], back_populates="guest_meetings")
    verification_logs = relationship("VerificationResult", back_populates="meeting")


class VerificationResult(Base):
    __tablename__ = "verification_results"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    meeting_id = Column(Integer, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    liveness_score = Column(Float, nullable=True)     
    deepfake_score = Column(Float, nullable=True)     
    face_match_score = Column(Float, nullable=True)   

    ip_address = Column(String(50), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
        
    is_pass = Column(Boolean, default=False)
    failure_reason = Column(Text, nullable=True)
    timestamp = Column(TIMESTAMP, server_default=func.now())

    meeting = relationship("Meeting", back_populates="verification_logs")
    client = relationship("User", back_populates="verification_results")