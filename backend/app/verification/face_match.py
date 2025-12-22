import cv2
import numpy as np
from deepface import DeepFace
import logging
import os

logging.basicConfig(level=logging.INFO)

def extract_face(image_input) -> np.ndarray | None:
    """
    Extracts the largest face from an image (File Path OR Numpy Array).
    Returns the cropped face as a Numpy Array (BGR).
    """
    img = None
    
    if isinstance(image_input, str):
        if not os.path.exists(image_input):
            logging.error(f"File not found: {image_input}")
            return None
        img = cv2.imread(image_input)
    elif isinstance(image_input, np.ndarray):
        img = image_input
    else:
        logging.error("Invalid input type. Expected str (path) or np.ndarray")
        return None

    if img is None:
        logging.error("Could not read image data.")
        return None

    try:
        faces = DeepFace.extract_faces(
            img_path=img, 
            detector_backend='mtcnn',
            enforce_detection=False,
            align=True
        )

        if not faces:
            return None

        largest_face = None
        max_area = 0
        
        for face_obj in faces:
            area = face_obj['facial_area']['w'] * face_obj['facial_area']['h']
            if area > max_area and area > 1000: 
                max_area = area
                largest_face = face_obj

        if largest_face:
            detected_face = largest_face['face']
            
            if detected_face.max() <= 1.0:
                detected_face = (detected_face * 255).astype(np.uint8)
            
            detected_face_bgr = cv2.cvtColor(detected_face, cv2.COLOR_RGB2BGR)
            
            return detected_face_bgr

        return None

    except Exception as e:
        logging.error(f"Face extraction error: {e}")
        return None

def compare_faces(img1_input, img2_input) -> dict:
    """
    Compares two face images (Path vs Path, or Array vs Path, etc.).
    """
    if img1_input is None or img2_input is None:
        return {"verified": False, "distance": 1.0, "error": "Missing input data"}

    try:
        model_name = 'Facenet512'
        distance_metric = 'cosine'
        result = DeepFace.verify(
            img1_path=img1_input,
            img2_path=img2_input,
            model_name=model_name,
            detector_backend='skip',
            distance_metric=distance_metric,
            enforce_detection=False
        )

        return {
            "verified": result["verified"],
            "distance": result["distance"],
            "threshold": result["threshold"],
            "model": model_name
        }

    except Exception as e:
        logging.error(f"Error during face comparison: {e}")
        return {"verified": False, "distance": 1.0, "error": str(e)}