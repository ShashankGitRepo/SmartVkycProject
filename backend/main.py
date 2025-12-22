import os
import logging
import shutil
import httpx
import cv2 
import uuid
import asyncio
import base64
import time
from sqlalchemy.exc import IntegrityError
import numpy as np
from datetime import datetime, timedelta, date
from typing import List, Dict, Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, status, Depends, WebSocket, WebSocketDisconnect, Query, Body, Form
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from werkzeug.utils import secure_filename
import torch
import pytesseract 
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

# --- AGORA TOKEN BUILDER ---
from agora_token_builder import RtcTokenBuilder

# --- DATABASE IMPORTS ---
from database import database
from database.db_models import User as DBUser, Meeting, UserRole, Document, VerificationResult
from database.models import (
    UserCreate, UserLogin, Token, UserResponse, MeetingCreate, MeetingResponse 
)
from app.auth.auth import (
    get_password_hash, verify_password, create_access_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.auth.agora_utils import generate_agora_rtc_token, APP_ID

# --- ML MODULES ---
from app.verification import liveness, deepfake
from app.verification.liveness import check_liveness_challenge, liveness_check
from app.verification.deepfake import detect_deepfake
from app.verification.document_ocr import DocumentVerifier
from app.verification import face_match

# --- SETUP ---
database.Base.metadata.create_all(bind=database.engine)
logging.basicConfig(level=logging.INFO)

UPLOAD_FOLDER = 'uploads'
EXTRACTED_FACES_FOLDER = os.path.join(UPLOAD_FOLDER, 'extracted_faces')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'mp4', 'webm', 'pdf'}
CUSTOM_FACE_MATCH_THRESHOLD = 0.40

# --- PERFORMANCE TUNING ---
LIVENESS_TARGET_WIDTH = 720   
HEAVY_TARGET_WIDTH = 480      

# --- CONFIGURATION ---
VIDEO_CHUNK_SIZE = 60 
LIVENESS_THRESHOLD = 0.40    
DEEPFAKE_THRESHOLD = 0.50     
FACE_MATCH_THRESHOLD = 0.40   

DEEPFAKE_SENSITIVITY = 0.20


frontend_url = os.getenv("FRONTEND_URL")
backend_url = os.getenv("BACKEND_PUBLIC_URL")

app = FastAPI()

if not os.path.exists(UPLOAD_FOLDER): os.makedirs(UPLOAD_FOLDER)
if not os.path.exists(EXTRACTED_FACES_FOLDER): os.makedirs(EXTRACTED_FACES_FOLDER)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Tesseract & Device ---
tesseract_path = shutil.which('tesseract')
if tesseract_path: pytesseract.pytesseract.tesseract_cmd = tesseract_path
else: logging.warning("Tesseract not found. OCR will fail.")

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
if torch.backends.mps.is_available(): DEVICE = torch.device("mps")
logging.info(f"Using device: {DEVICE}")


# ================= WEBSOCKET CONNECTION MANAGER =================
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, meeting_code: str):
        await websocket.accept()
        if meeting_code not in self.active_connections:
            self.active_connections[meeting_code] = []
        self.active_connections[meeting_code].append(websocket)
        print(f"[WS MANAGER] Connected: {meeting_code}. Total Clients: {len(self.active_connections[meeting_code])}")

    def disconnect(self, websocket: WebSocket, meeting_code: str):
        if meeting_code in self.active_connections:
            if websocket in self.active_connections[meeting_code]:
                self.active_connections[meeting_code].remove(websocket)
            if not self.active_connections[meeting_code]:
                del self.active_connections[meeting_code]
        print(f"[WS MANAGER] Disconnected: {meeting_code}")

    async def broadcast(self, message: dict, meeting_code: str):
        if meeting_code in self.active_connections:
            for connection in list(self.active_connections[meeting_code]):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logging.debug(f"[WS BROADCAST] send_json error: {e}")

manager = ConnectionManager()

# ================= AUTHENTICATION =================
ADMIN_CREATION_SECRET = os.getenv("ADMIN_SECRET_KEY")

@app.post("/api/v1/auth/register", response_model=UserResponse)
async def register_user(user: UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(DBUser).filter(DBUser.email == user.email).first()
    if db_user: raise HTTPException(status_code=400, detail="Email already registered")
    assigned_role = UserRole.CLIENT.value
    if user.role == "admin":
        if user.admin_secret != ADMIN_CREATION_SECRET: raise HTTPException(status_code=403, detail="Invalid Secret")
        assigned_role = UserRole.ADMIN.value
    hashed_password = get_password_hash(user.password)
    new_user = DBUser(first_name=user.first_name, last_name=user.last_name, email=user.email, 
                      phone_number=user.phone_number, hashed_password=hashed_password, role=assigned_role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return UserResponse.from_orm(new_user)

@app.post("/api/v1/auth/login")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = db.query(DBUser).filter(DBUser.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect credentials")
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

# ================= USER MANAGEMENT =================

@app.get("/api/v1/users/me", response_model=UserResponse)
async def read_users_me(current_user: UserResponse = Depends(get_current_user)):
    return current_user

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    birth_date: Optional[date] = None

@app.put("/api/v1/users/me", response_model=UserResponse)
async def update_user_me(
    user_data: UserUpdate,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    user = db.query(DBUser).filter(DBUser.id == current_user.id).first()
    if user_data.first_name: user.first_name = user_data.first_name
    if user_data.last_name: user.last_name = user_data.last_name
    if user_data.birth_date: user.birth_date = user_data.birth_date
    db.commit()
    db.refresh(user)
    return UserResponse.from_orm(user)

@app.get("/api/v1/users/status")
async def get_user_status(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    doc = db.query(Document).filter(
        Document.user_id == current_user.id, 
        Document.is_verified == True
    ).first()
    return {"is_verified": doc is not None}

@app.get("/api/v1/users/history")
async def get_user_history(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    logs = db.query(VerificationResult).filter(
        VerificationResult.client_id == current_user.id
    ).order_by(VerificationResult.timestamp.desc()).all()
    return logs


# ================= MEETING & AGORA =================

class AgoraTokenRequest(BaseModel): channelName: str

@app.post("/api/v1/agora/token")
async def get_agora_token(payload: AgoraTokenRequest, current_user: UserResponse = Depends(get_current_user)):
    token = generate_agora_rtc_token(payload.channelName, int(current_user.id))
    if not token: raise HTTPException(status_code=500, detail="Token generation failed")
    return {"token": token, "appId": APP_ID, "userId": int(current_user.id)}

# --- CORRECTED JOIN MEETING ENDPOINT ---
@app.get("/api/v1/meetings/join/{meeting_code}")
async def join_meeting_data(
    meeting_code: str, 
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    meeting = db.query(Meeting).filter(Meeting.meeting_code == meeting_code).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    # REGISTER THE CLIENT ID
    if current_user.role == "client":
        if meeting.client_id is None:
            meeting.client_id = current_user.id
            db.commit()
            db.refresh(meeting)
        elif meeting.client_id != current_user.id:
            logging.warning(f"Meeting {meeting_code} client mismatch.")

    # Generate Agora Token
    uid = int(current_user.id)
    privilege_expired_ts = int(time.time()) + (3600 * 24)
    agora_app_id = os.getenv("AGORA_APP_ID", APP_ID)
    agora_cert = os.getenv("AGORA_APP_CERTIFICATE")
    
    token = RtcTokenBuilder.buildTokenWithUid(
        agora_app_id, 
        agora_cert, 
        meeting_code, 
        uid, 
        1, 
        privilege_expired_ts
    )

    return {
        "appId": agora_app_id,
        "token": token,
        "uid": uid,
        "role": current_user.role, 
        "client_id": meeting.client_id, 
        "host_id": meeting.host_id
    }

@app.post("/api/v1/meetings/create", response_model=MeetingResponse)
async def create_meeting(
    payload: MeetingCreate,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    code = getattr(payload, "meeting_code", None)
    if not code: code = str(uuid.uuid4())[:12]

    client_id_val = getattr(payload, "client_id", None)

    meeting = Meeting(
        meeting_code = code,
        title = payload.title,
        client_id = client_id_val, 
        host_id = current_user.id,
        created_at = datetime.utcnow()
    )

    db.add(meeting)
    db.commit()
    db.refresh(meeting)

    join_url = f"{frontend_url}/meet/{meeting.meeting_code}"

    return MeetingResponse(
        id = meeting.id,
        meeting_code = meeting.meeting_code,
        title = meeting.title,
        host_id = meeting.host_id,
        created_at = meeting.created_at,
        join_url = join_url
    )


# ================= SCORES & VERIFICATION =================
class ScoresPayload(BaseModel):
    liveness: dict | None = None
    deepfake: dict | None = None
    face_match: dict | None = None
    saved_by: str | None = None

@app.post("/api/v1/meetings/{meeting_code}/scores")
async def persist_meeting_scores(meeting_code: str, payload: ScoresPayload, db: Session = Depends(database.get_db)):
    meeting = db.query(Meeting).filter(Meeting.meeting_code == meeting_code).first()
    if not meeting or not meeting.client_id: return {"ok": False}
    
    liveness_score = float(payload.liveness.get("score")) if payload.liveness and payload.liveness.get("score") is not None else None
    deepfake_score = float(payload.deepfake.get("score")) if payload.deepfake and payload.deepfake.get("score") is not None else None
    face_match_score = float(payload.face_match.get("distance")) if payload.face_match and payload.face_match.get("distance") is not None else None

    existing = db.query(VerificationResult).filter(VerificationResult.meeting_id == meeting.id, VerificationResult.client_id == meeting.client_id).first()
    
    if existing:
        if liveness_score is not None: existing.liveness_score = liveness_score
        if deepfake_score is not None: existing.deepfake_score = deepfake_score
        if face_match_score is not None: existing.face_match_score = face_match_score
        try: existing.timestamp = datetime.utcnow() 
        except: pass
        db.commit()
    else:
        new_row = VerificationResult(meeting_id=meeting.id, client_id=meeting.client_id, liveness_score=liveness_score, 
                                     deepfake_score=deepfake_score, face_match_score=face_match_score, is_pass=None)
        db.add(new_row)
        db.commit()
    return {"ok": True}


# ================= DOCUMENT VERIFICATION =================

@app.post("/api/v1/verify")
async def verify_identity(
    document: UploadFile = File(...),
    doc_type: str = Form("aadhaar_card"),
    video: UploadFile = File(None),
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    doc_path = ""
    video_path = ""
    try:
        valid_types = ["aadhaar_card", "pan_card", "voter_id", "driving_license", "passport"]
        if doc_type not in valid_types or not allowed_file(document.filename):
            raise HTTPException(status_code=400, detail="Invalid file type.")

        doc_filename = secure_filename(document.filename)
        doc_path = os.path.join(UPLOAD_FOLDER, doc_filename)
        with open(doc_path, "wb") as f:
            f.write(await document.read())

        file_url_for_db = f"{backend_url}/{UPLOAD_FOLDER}/{doc_filename}".replace("\\", "/")

        new_doc_record = Document(
            user_id=current_user.id,
            file_url=file_url_for_db, 
            doc_type=doc_type, 
            is_verified=False
        )
        db.add(new_doc_record)
        db.commit()
        db.refresh(new_doc_record)
        
        if video:
            video_filename = secure_filename(video.filename)
            video_path = os.path.join(UPLOAD_FOLDER, video_filename)
            with open(video_path, "wb") as f:
                f.write(await video.read())
        
        verifier = DocumentVerifier(doc_path)
        doc_verification_result = verifier.verify_document()


        doc_face_arr = face_match.extract_face(doc_path) 
        
        face_match_result = {"verified": False, "distance": 1.0, "custom_verified": False}

        if video_path and os.path.exists(video_path):
            cap = cv2.VideoCapture(video_path)
            if cap.isOpened():
                frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                middle_frame_idx = frame_count // 2
                cap.set(cv2.CAP_PROP_POS_FRAMES, middle_frame_idx)
                ret, frame = cap.read()
                
                if ret:
                    video_face_arr = face_match.extract_face(frame)
                    
                    if doc_face_arr is not None and video_face_arr is not None:
                        face_match_result = face_match.compare_faces(doc_face_arr, video_face_arr)
                        
                        dist = face_match_result.get("distance", 1.0)
                        face_match_result["custom_verified"] = dist < CUSTOM_FACE_MATCH_THRESHOLD
                
                cap.release()

        final_decision = "FAIL"
        reasons = []

        if doc_verification_result.get("status") == "REJECTED":
            reasons.append("Document rejected (QR/OCR mismatch).")
        elif video and not face_match_result.get("custom_verified"):
             reasons.append(f"Face mismatch (Dist: {face_match_result.get('distance'):.2f}).")
        else: 
            final_decision = "PASS"
            reasons.append("All checks passed.")
            new_doc_record.is_verified = True
            db.commit()

        return {
                "decision": final_decision,
                "reasons": reasons,
                "checks": {
                "document": doc_verification_result,
                "face_match": face_match_result
            }
        }

    except Exception as e:
        logging.error(f"Verify error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if video_path and os.path.exists(video_path): 
            try:
                os.remove(video_path)
            except:
                pass

# ================= REAL-TIME WEBSOCKET AI (TUNED) =================

def process_ai_pipeline(video_chunk, single_frame, ref_arr):
    df_res = detect_deepfake(video_chunk)
    liv_res = liveness_check(video_chunk)
    fm_dist = 1.0
    if ref_arr is not None:
        live_face_arr = face_match.extract_face(single_frame)
        if live_face_arr is not None:
            fm_res = face_match.compare_faces(ref_arr, live_face_arr)
            fm_dist = fm_res.get("distance", 1.0)
            
    return df_res, liv_res, fm_dist


# ================= DECODE IMAGE =================

def _decode_image(b64_str: str):
    if not b64_str: return None
    try:
        if isinstance(b64_str, str) and "base64," in b64_str:
            b64_str = b64_str.split("base64,")[-1]
        raw = base64.b64decode(b64_str)
        nparr = np.frombuffer(raw, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception:
        return None

heavy_processing_lock = asyncio.Lock()

# ================= LOCATION =================

async def get_geolocation(ip_address: str):
    if ip_address in ["127.0.0.1", "localhost", "::1"]:
        return None, None 
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://ipwho.is/{ip_address}")
            data = resp.json()
            
            if data.get("success") is True:
                return data.get("latitude"), data.get("longitude")
            else:
                logging.warning(f"[GeoIP Failed] {data.get('message')}")
                
    except Exception as e:
        logging.error(f"[GeoIP Error] {e}")
    
    return None, None

# ================= WEBSOCKET =================

@app.websocket("/ws/verify/{meeting_code}/{client_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    meeting_code: str, 
    client_id: int,
    db: Session = Depends(database.get_db)
):
    await manager.connect(websocket, meeting_code)
    
    # 1. CAPTURE IP & LOCATION
    client_ip = websocket.client.host
    client_lat, client_lon = None, None
    try:
        client_lat, client_lon = await get_geolocation(client_ip)
        print(f"[WS INFO] Client: {client_ip} | Loc: {client_lat}, {client_lon}")
    except Exception:
        pass

    # 2. SETUP REFERENCE FACE
    reference_face_path = None
    try:
        client_doc = db.query(Document).filter(Document.user_id == client_id).order_by(Document.uploaded_at.desc()).first()
        if client_doc:
            filename = os.path.basename(client_doc.file_url)
            potential_path = os.path.join(UPLOAD_FOLDER, filename)
            if os.path.exists(potential_path):
                reference_face_path = await asyncio.to_thread(face_match.extract_face, potential_path)
    except Exception as e:
        print(f"[WS SETUP] Error: {e}")

    # 3. STATE VARIABLES
    frame_buffer = []
    
    total_deepfake_score = 0.0
    total_face_match_score = 0.0
    frame_block_count = 0 
    
    current_result_id = None  

    current_state = {
        "liveness_score": 0.0,
        "is_liveness_confirmed": False,
        "deepfake_score": 0.0,
        "is_deepfake": False,
        "face_match_score": 1.0 
    }

    # 4. DATABASE UPDATE
    def update_db(final_average_mode=False):
        nonlocal current_result_id 
        
        try:
            final_df = current_state["deepfake_score"]
            final_fm = current_state["face_match_score"]

            if final_average_mode and frame_block_count > 0:
                final_df = total_deepfake_score / frame_block_count
                final_fm = total_face_match_score / frame_block_count
                print(f"[WS END] Session Avg -> Frames: {frame_block_count}, DF: {final_df:.2f}, FM: {final_fm:.2f}")

            final_liv = 1.0 if current_state["is_liveness_confirmed"] else current_state["liveness_score"]

            reasons = []
            
            if final_liv < LIVENESS_THRESHOLD:
                reasons.append(f"Liveness Low ({final_liv:.2f})")
            
            if final_df > DEEPFAKE_THRESHOLD:
                reasons.append(f"Deepfake Detected ({final_df:.2f})")

            if final_fm > FACE_MATCH_THRESHOLD:
                reasons.append(f"Face Mismatch ({final_fm:.2f})")

            is_pass_val = len(reasons) == 0
            failure_reason_val = "NA" if is_pass_val else ", ".join(reasons)

            row = None
            if current_result_id:
                row = db.query(VerificationResult).filter(VerificationResult.id == current_result_id).first()
            
            if not row:
                meeting = db.query(Meeting).filter(Meeting.meeting_code == meeting_code).first()
                if not meeting: return
                row = db.query(VerificationResult).filter(VerificationResult.meeting_id == meeting.id).first()

            if row:
                row.deepfake_score = final_df
                row.face_match_score = final_fm
                row.liveness_score = final_liv
                row.is_pass = is_pass_val
                row.failure_reason = failure_reason_val
                row.timestamp = datetime.utcnow()
                
                if client_ip: row.ip_address = client_ip
                if client_lat: row.latitude = client_lat
                if client_lon: row.longitude = client_lon
                
                current_result_id = row.id 
                db.commit()
            else:
                meeting = db.query(Meeting).filter(Meeting.meeting_code == meeting_code).first()
                if meeting:
                    new_row = VerificationResult(
                        meeting_id=meeting.id, 
                        client_id=client_id, 
                        deepfake_score=final_df, 
                        face_match_score=final_fm, 
                        liveness_score=final_liv,
                        is_pass=is_pass_val,
                        failure_reason=failure_reason_val,
                        ip_address=client_ip,
                        latitude=client_lat,
                        longitude=client_lon
                    )
                    db.add(new_row)
                    try:
                        db.commit()
                        db.refresh(new_row)
                        current_result_id = new_row.id
                    except IntegrityError:
                        db.rollback()
                        print("[DB SYNC] Race condition, retrying as update...")
                        update_db(final_average_mode)

        except Exception as e:
            print(f"[DB ERROR] {e}")
            db.rollback()

    # 5. MAIN LOOP
    try:
        while True:
            try:
                raw_data = await websocket.receive_json()
            except WebSocketDisconnect:
                break
            except Exception:
                continue

            if isinstance(raw_data, dict) and raw_data.get("type") == "ping": continue

            b64_image = raw_data.get("image") or raw_data.get("frame")
            if not b64_image: continue

            frame = await asyncio.to_thread(_decode_image, b64_image)
            if frame is None: continue

            if not current_state["is_liveness_confirmed"]:
                try:
                    small_frame = cv2.resize(frame, (LIVENESS_TARGET_WIDTH, int(frame.shape[0]*(LIVENESS_TARGET_WIDTH/frame.shape[1]))))
                    
                    liv_fast = await asyncio.to_thread(check_liveness_challenge, small_frame, "blink")
                    
                    raw_ear = liv_fast.get("score", 1.0)
                    instant_score = max(0.0, 1.0 - raw_ear)
                    
                    current_state["liveness_score"] = instant_score                    
                except Exception:
                    pass

            ml_frame = cv2.resize(frame, (HEAVY_TARGET_WIDTH, int(frame.shape[0]*(HEAVY_TARGET_WIDTH/frame.shape[1]))))
            frame_buffer.append(ml_frame)

            if len(frame_buffer) >= VIDEO_CHUNK_SIZE:
                
                if not heavy_processing_lock.locked():
                    async with heavy_processing_lock:
                        video_chunk = list(frame_buffer)
                        snapshot_frame = frame_buffer[-1]
                        
                        df_res, liv_res, fm_res = await asyncio.to_thread(
                            process_ai_pipeline, 
                            video_chunk, 
                            snapshot_frame, 
                            reference_face_path
                        )

                        current_state["is_deepfake"] = df_res.get("is_deepfake", False)
                        current_state["deepfake_score"] = df_res.get("fake_score", 0.0) * DEEPFAKE_SENSITIVITY
                        current_state["face_match_score"] = fm_res
                        
                        chunk_liv_score = liv_res.get("score", 0.0)
                        chunk_liv_passed = liv_res.get("passed", False)
                        
                        if chunk_liv_score > current_state["liveness_score"]:
                             current_state["liveness_score"] = chunk_liv_score
                        
                        if chunk_liv_passed:
                            current_state["is_liveness_confirmed"] = True

                        total_deepfake_score += current_state["deepfake_score"]
                        total_face_match_score += current_state["face_match_score"]
                        frame_block_count += 1

                        await asyncio.to_thread(update_db, final_average_mode=False)
                        
                        frame_buffer.clear()
                else:
                    if len(frame_buffer) > VIDEO_CHUNK_SIZE * 2:
                        frame_buffer.clear()
            response = {
                "liveness": {
                    "status": current_state["is_liveness_confirmed"],
                    "score": 1.0 if current_state["is_liveness_confirmed"] else current_state["liveness_score"], 
                    "challenge": "none"
                },
                "deepfake": {
                    "is_deepfake": current_state["is_deepfake"], 
                    "score": current_state["deepfake_score"]
                },
                "face_match": {
                    "distance": current_state["face_match_score"], 
                    "is_match": current_state["face_match_score"] < FACE_MATCH_THRESHOLD
                }
            }
            await manager.broadcast(response, meeting_code)
            print(response)

    except Exception as e:
        logging.error(f"WS Error: {e}")
    finally:
        await asyncio.to_thread(update_db, final_average_mode=True)
        manager.disconnect(websocket, meeting_code)

@app.get("/api/v1/admin/verifications")
async def get_all_verifications(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    return db.query(VerificationResult)\
        .options(joinedload(VerificationResult.client))\
        .order_by(VerificationResult.timestamp.desc())\
        .offset(skip).limit(limit).all()

@app.get("/api/v1/meetings/{meeting_code}/result")
async def get_meeting_result(meeting_code: str, db: Session = Depends(database.get_db)):
    meeting = db.query(Meeting).filter(Meeting.meeting_code == meeting_code).first()
    if not meeting: raise HTTPException(status_code=404)
    result = db.query(VerificationResult).filter(VerificationResult.meeting_id == meeting.id).first()
    if result: return result
    return {"status": "pending", "client_id": meeting.client_id, "meeting_id": meeting.id}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)