# backend/main.py
import os
import logging
import shutil
import sys
import cv2 # Added for reading video frames

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from werkzeug.utils import secure_filename
import torch # For device setup
import pytesseract # For Tesseract config

# Import your ML modules
from app.verification import liveness, deepfake
from app.verification.document_ocr import DocumentVerifier
# --- Import face_match module ---
from app.verification import face_match


# Configure logging
logging.basicConfig(level=logging.INFO)

# --- Configuration ---
UPLOAD_FOLDER = 'uploads'
EXTRACTED_FACES_FOLDER = os.path.join(UPLOAD_FOLDER, 'extracted_faces')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'mp4', 'webm'}

app = FastAPI()

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
if not os.path.exists(EXTRACTED_FACES_FOLDER):
    os.makedirs(EXTRACTED_FACES_FOLDER)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- CRITICAL: CORS Middleware ---
origins = [
    "http://localhost:5100", # Frontend port
    "http://127.0.0.1:5100",
    "http://localhost:8000", # Backend port
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --------------------------------

# --- Tesseract Configuration ---
tesseract_path = shutil.which('tesseract')
if tesseract_path:
    pytesseract.pytesseract.tesseract_cmd = tesseract_path
    logging.info(f"Tesseract executable found at: {tesseract_path}")
else:
    logging.error("Tesseract is not installed or not in your system's PATH.")
    logging.error("Please install Tesseract OCR from https://tesseract-ocr.github.io/tessdoc/Installation.html")
    sys.exit(1)

# --- PyTorch Device Setup (including MPS for Mac) ---
DEVICE = None
if torch.backends.mps.is_available() and torch.backends.mps.is_built():
    DEVICE = torch.device("mps")
    logging.info(f"Using device: {DEVICE} (Apple Metal Performance Shaders)")
elif torch.cuda.is_available():
    DEVICE = torch.device("cuda")
    logging.info(f"Using device: {DEVICE} (NVIDIA CUDA)")
else:
    DEVICE = torch.device("cpu")
    logging.info(f"Using device: {DEVICE} (CPU)")


@app.get("/")
def read_root():
    return {"message": "Smart VKYC Backend is running!"}

# --- Define custom face match threshold ---
# This value needs tuning based on testing with your data.
# Lower value = stricter match requirement.
CUSTOM_FACE_MATCH_THRESHOLD = 0.25

@app.post("/api/v1/verify")
async def verify_identity(
    document: UploadFile = File(...),
    video: UploadFile = File(...)
):
    """
    Orchestrates the VKYC pipeline:
    1. Saves uploaded document and video.
    2. Runs liveness, deepfake, document verification checks.
    3. Extracts face from document and a video frame.
    4. Compares the extracted faces.
    5. Fuses results based on predefined rules and thresholds.
    6. Returns the final decision and details.
    7. Cleans up temporary files.
    """

    doc_path = ""
    video_path = ""
    doc_face_path = None
    video_frame_path = None # Path to the *cropped* face from video
    temp_frame_path = None # Path to the *full* frame extracted from video

    try:
        # --- 1. Save Files Securely ---
        if not allowed_file(document.filename) or not allowed_file(video.filename):
            raise HTTPException(status_code=400, detail="Invalid file type")

        doc_filename = secure_filename(document.filename)
        doc_path = os.path.join(UPLOAD_FOLDER, doc_filename)
        with open(doc_path, "wb") as f:
            f.write(await document.read())

        video_filename = secure_filename(video.filename)
        video_path = os.path.join(UPLOAD_FOLDER, video_filename)
        with open(video_path, "wb") as f:
            f.write(await video.read())

        logging.info(f"Files saved: {doc_path}, {video_path}")

        # --- 2. Run Initial Verification Checks ---
        logging.info("Running liveness check...")
        liveness_result = liveness.check_blinks_in_video(video_path)

        logging.info("Running deepfake check...")
        deepfake_result = deepfake.detect_deepfake(video_path)

        logging.info("Running Document Verification (QR + OCR)...")
        verifier = DocumentVerifier(doc_path)
        doc_verification_result = verifier.verify_document()

        # --- 3. Perform Face Matching ---
        logging.info("Attempting face matching...")

        # 3a. Extract face from the uploaded document image
        doc_face_path = face_match.extract_face(doc_path)
        if doc_face_path:
            logging.info(f"Successfully extracted face from document: {doc_face_path}")
        else:
            logging.warning(f"FAILED to extract face from document: {doc_path}")


        # 3b. Extract a frame from the video and then extract the face from that frame
        if video_path and os.path.exists(video_path):
            cap = cv2.VideoCapture(video_path)
            if cap.isOpened():
                frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                middle_frame_idx = frame_count // 2
                cap.set(cv2.CAP_PROP_POS_FRAMES, middle_frame_idx)
                ret, frame = cap.read()
                if ret:
                    # Save the full frame temporarily
                    temp_frame_filename = f"frame_{os.path.basename(video_path)}.jpg"
                    temp_frame_path = os.path.join(UPLOAD_FOLDER, temp_frame_filename)
                    cv2.imwrite(temp_frame_path, frame)
                    logging.info(f"Saved temporary video frame to: {temp_frame_path}")

                    # Extract the face from the saved frame
                    video_frame_path = face_match.extract_face(temp_frame_path)
                    if video_frame_path:
                        logging.info(f"Successfully extracted face from video frame: {video_frame_path}")
                    else:
                        logging.warning(f"FAILED to extract face from video frame: {temp_frame_path}")
                else:
                    logging.warning(f"Could not read middle frame from video: {video_path}")
                cap.release()
            else:
                logging.warning(f"Could not open video for frame extraction: {video_path}")
        else:
            logging.warning(f"Video path invalid or does not exist: {video_path}")

        # 3c. Compare the two extracted faces (if both were found)
        if doc_face_path and video_frame_path:
            face_match_result = face_match.compare_faces(doc_face_path, video_frame_path)
            # Apply custom threshold logic
            if face_match_result.get("distance", -1) != -1: # Check if comparison succeeded
                face_match_result["custom_verified"] = face_match_result["distance"] < CUSTOM_FACE_MATCH_THRESHOLD
                logging.info(f"Custom Face Match Decision: {face_match_result['custom_verified']} (Distance: {face_match_result['distance']:.2f} vs Threshold: {CUSTOM_FACE_MATCH_THRESHOLD})")
            else:
                 face_match_result["custom_verified"] = False
            logging.warning(f"Face comparison failed or returned invalid distance. Result: {face_match_result}") # Changed to warning
            logging.info(f"Face Match Result: {face_match_result}")
        else:
            # Handle cases where one or both faces couldn't be extracted
            face_match_result = {"verified": False, "distance": -1, "threshold": -1, "custom_verified": False, "error": "Could not extract faces from document or video for comparison."}
            logging.error(face_match_result["error"]) # Changed to error for visibility

        # --- 4. Run Fusion Logic ---
        final_decision = "FAIL"
        reasons = []

        # Define the order of checks for rejection
        if not liveness_result.get("live"):
            reasons.append(f"Liveness check failed ({liveness_result.get('reason', 'unknown')}).")
        elif deepfake_result.get("is_deepfake"):
            reasons.append(f"Deepfake detected with score: {deepfake_result.get('fake_score'):.2f}.")
        elif doc_verification_result.get("status") == "REJECTED":
            reasons.append(f"Document rejected: {doc_verification_result.get('reason')}")
        elif doc_verification_result.get("status") == "FLAGGED":
            reasons.append(f"Document flagged: {doc_verification_result.get('reason')}. Mismatches: {', '.join(doc_verification_result.get('mismatched_fields', []))}")
        elif not face_match_result.get("custom_verified"):
             reasons.append(f"Face mismatch detected. Distance: {face_match_result.get('distance', -1):.2f} (Required < {CUSTOM_FACE_MATCH_THRESHOLD}).")
             if face_match_result.get("error"): # Add specific error if comparison failed
                 reasons.append(f"Face Match Error: {face_match_result.get('error')}")
        else: # If none of the above failure conditions were met, it's a pass
            final_decision = "PASS"
            reasons.append("All primary checks passed (Liveness, Deepfake, Document Verified, Face Matched).")


        logging.info(f"Final Decision: {final_decision}")

        # --- 5. Return Final Result ---
        return {
            "decision": final_decision,
            "reasons": reasons,
            "checks": {
                "liveness": liveness_result,
                "deepfake": deepfake_result,
                "document_verification": doc_verification_result,
                "face_match": face_match_result
            }
        }
    except Exception as e:
        logging.error(f"Verification pipeline failed unexpectedly: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An internal error occurred during verification.")
    finally:
        # --- 6. Clean up temporary files ---
        logging.info("Cleaning up temporary files...")
        if os.path.exists(doc_path): os.remove(doc_path)
        if os.path.exists(video_path): os.remove(video_path)
        if temp_frame_path and os.path.exists(temp_frame_path): os.remove(temp_frame_path)
        if doc_face_path and os.path.exists(doc_face_path): os.remove(doc_face_path)
        if video_frame_path and os.path.exists(video_frame_path): os.remove(video_frame_path)
        logging.info("Cleanup complete.")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)