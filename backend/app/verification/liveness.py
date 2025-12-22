import cv2
import dlib
from scipy.spatial import distance as dist
import logging
import numpy as np
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PREDICTOR_PATH = os.path.join(BASE_DIR, "ml_models", "liveness_detection", "shape_predictor_68_face_landmarks.dat")

detector = dlib.get_frontal_face_detector()
predictor = None

try:
    if os.path.exists(PREDICTOR_PATH):
        predictor = dlib.shape_predictor(PREDICTOR_PATH)
    else:
        logging.error(f"Liveness Model not found at: {PREDICTOR_PATH}")
except Exception as e:
    logging.error(f"Error loading predictor: {e}")

(lStart, lEnd) = (42, 48)
(rStart, rEnd) = (36, 42)


# --- 2. CORE MATH FUNCTIONS ---

def eye_aspect_ratio(eye):
    """Calculates the Eye Aspect Ratio (EAR) to detect blinking."""
    A = dist.euclidean(eye[1], eye[5])
    B = dist.euclidean(eye[2], eye[4])
    C = dist.euclidean(eye[0], eye[3])
    ear = (A + B) / (2.0 * C)
    return ear

def get_head_pose(shape, img_w, img_h):
    """Calculates Yaw, Pitch, Roll for head turn challenges."""
    image_points = np.array([
        (shape.part(30).x, shape.part(30).y),     # Nose tip
        (shape.part(8).x, shape.part(8).y),       # Chin
        (shape.part(36).x, shape.part(36).y),     # Left eye left corner
        (shape.part(45).x, shape.part(45).y),     # Right eye right corner
        (shape.part(48).x, shape.part(48).y),     # Left Mouth corner
        (shape.part(54).x, shape.part(54).y)      # Right mouth corner
    ], dtype="double")

    model_points = np.array([
        (0.0, 0.0, 0.0),             
        (0.0, -330.0, -65.0),        
        (-225.0, 170.0, -135.0),     
        (225.0, 170.0, -135.0),      
        (-150.0, -150.0, -125.0),   
        (150.0, -150.0, -125.0)      
    ])

    focal_length = img_w
    center = (img_w / 2, img_h / 2)
    camera_matrix = np.array(
        [[focal_length, 0, center[0]],
         [0, focal_length, center[1]],
         [0, 0, 1]], dtype="double"
    )
    dist_coeffs = np.zeros((4, 1)) 

    (success, rotation_vector, translation_vector) = cv2.solvePnP(
        model_points, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
    )

    rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
    proj_matrix = np.hstack((rotation_matrix, translation_vector))
    _, _, _, _, _, _, euler_angles = cv2.decomposeProjectionMatrix(proj_matrix)

    pitch, yaw, roll = [element[0] for element in euler_angles]
    return {"pitch": pitch, "yaw": yaw, "roll": roll}


# --- 3. SINGLE FRAME STATE CHECKER ---

def check_liveness_challenge(frame_bgr, challenge_type="blink"):
    """
    Checks if a single frame MEETS the condition for the challenge.
    Returns the boolean result AND the raw metric (EAR or Yaw).
    """
    if predictor is None: 
        return {"passed": False, "message": "Predictor not loaded"}

    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    rects = detector(gray, 0)
    
    if len(rects) == 0:
        return {"passed": False, "message": "No face detected"}

    shape = predictor(gray, rects[0])
    
    # --- BLINK LOGIC ---
    if challenge_type == "blink":
        coords = [(shape.part(i).x, shape.part(i).y) for i in range(68)]
        leftEAR = eye_aspect_ratio(coords[lStart:lEnd])
        rightEAR = eye_aspect_ratio(coords[rStart:rEnd])
        avg_ear = (leftEAR + rightEAR) / 2.0
        
        return {"passed": avg_ear < 0.25, "score": avg_ear}

    # --- HEAD POSE LOGIC ---
    h, w = frame_bgr.shape[:2]
    pose = get_head_pose(shape, w, h)
    
    if challenge_type == "turn_left":
        return {"passed": pose["yaw"] > 15, "yaw": pose["yaw"], "score": pose["yaw"]}

    if challenge_type == "turn_right":
        return {"passed": pose["yaw"] < -15, "yaw": pose["yaw"], "score": pose["yaw"]}

    return {"passed": False, "message": "Unknown challenge", "score": 0.0}


# --- 4. CHUNK EVALUATOR (Averaged Score Logic) ---

def liveness_check(frame_chunk: list, challenge_type: str = "blink") -> dict:
    """
    Analyzes a video chunk.
    - Collects scores for ALL frames that meet the condition (e.g., all frames where eyes are closed).
    - Calculates the AVERAGE of these scores.
    - Decides 'passed' based on action count AND average score quality.
    """
    EYE_AR_CONSEC_FRAMES = 2      
    HEAD_TURN_CONSEC_FRAMES = 3   
    PROCESS_EVERY_N_FRAMES = 3  

    MIN_AVG_SCORE_THRESHOLD = 0.60 
    
    consecutive_frames = 0
    action_counter = 0
    
    active_frame_scores = []
    
    if not frame_chunk:
        return {"passed": False, "score": 0.0, "error": "Empty chunk"}

    if predictor is None:
        return {"passed": False, "score": 0.0, "error": "Predictor not loaded"}

    for i, frame in enumerate(frame_chunk):
        if i % PROCESS_EVERY_N_FRAMES != 0:
            continue
        try:
            result = check_liveness_challenge(frame, challenge_type)
            
            if "message" in result and result["message"] == "No face detected":
                continue

            condition_met = result.get("passed", False)
            raw_val = result.get("score", 0.0)

            if condition_met:
                consecutive_frames += 1
                
                normalized_val = 0.0
                if challenge_type == "blink":
                    normalized_val = max(0.0, 1.0 - raw_val)
                else:
                    normalized_val = max(0.0, min(1.0, abs(raw_val) / 45.0))
                
                active_frame_scores.append(normalized_val)
                
            else:
                if challenge_type == "blink" and consecutive_frames >= EYE_AR_CONSEC_FRAMES:
                    action_counter += 1
                elif "turn" in challenge_type and consecutive_frames >= HEAD_TURN_CONSEC_FRAMES:
                    action_counter += 1
                consecutive_frames = 0
            
        except Exception as e:
            logging.error(f"Frame {i} error: {e}")
            continue

    if challenge_type == "blink" and consecutive_frames >= EYE_AR_CONSEC_FRAMES:
        action_counter += 1
    elif "turn" in challenge_type and consecutive_frames >= HEAD_TURN_CONSEC_FRAMES:
        action_counter += 1

    final_score = 0.0
    if active_frame_scores:
        final_score = sum(active_frame_scores) / len(active_frame_scores)
    
    is_live = (action_counter > 0) and (final_score >= MIN_AVG_SCORE_THRESHOLD)
    
    return {
        "passed": is_live,
        "action_count": action_counter,
        "score": final_score, 
        "challenge_type": challenge_type
    }