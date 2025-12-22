import logging
import torch
from transformers import AutoImageProcessor, AutoModelForImageClassification
from PIL import Image
import cv2
import sys
import os
import numpy as np
import torch.nn.functional as F

if torch.backends.mps.is_available() and torch.backends.mps.is_built():
    DEVICE = torch.device("mps")
elif torch.cuda.is_available():
    DEVICE = torch.device("cuda")
else:
    DEVICE = torch.device("cpu")

# IMAGE_MODEL = "selimsef/weighted-face-cnn-deepfake-detection"
IMAGE_MODEL = "prithivMLmods/Deep-Fake-Detector-v2-Model"

logging.basicConfig(level=logging.INFO)

try:
    logging.info(f"Loading Deepfake model: {IMAGE_MODEL}")
    image_processor = AutoImageProcessor.from_pretrained(IMAGE_MODEL)
    image_model_obj = AutoModelForImageClassification.from_pretrained(IMAGE_MODEL)
    image_model_obj.to(DEVICE)
    image_model_obj.eval() 
    logging.info("Deepfake Model loaded.")
except Exception as e:
    logging.error(f"Failed to load deepfake model: {e}")
    image_model_obj = None
    image_processor = None

def detect_deepfake(frame_chunk: list) -> dict:
    try:
        if not frame_chunk:
            return {"is_deepfake": False, "fake_score": 0.0, "error": "Empty frame chunk."}
        frame_scores = []
        device = next(image_model_obj.parameters()).device
        for i, frame in enumerate(frame_chunk):
            try:
                img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))               
                inputs = image_processor(images=img, return_tensors="pt")
                inputs = {k: v.to(device) for k, v in inputs.items()}
                
                with torch.no_grad():
                    outputs = image_model_obj(**inputs)
                    logits = outputs.logits
                    probs = torch.nn.functional.softmax(logits, dim=1)
                    
                    fake_prob = probs[0][1].item()
                    frame_scores.append(fake_prob)
                    
                    if i % 10 == 0:
                        logging.info(f"Chunk Frame {i}: fake_prob={fake_prob:.4f}")
                        
            except Exception as frame_err:
                logging.warning(f"Skipping frame {i} due to error: {frame_err}")
                continue

        if not frame_scores:
            return {"is_deepfake": False, "fake_score": 0.0, "error": "No valid frames processed in chunk."}

        final_score = float(torch.quantile(torch.tensor(frame_scores), 0.9))
        
        return {
            "is_deepfake": final_score > 0.5, 
            "fake_score": final_score
        }

    except Exception as e:
        logging.error(f"Detection failed on chunk: {e}")
        return {"is_deepfake": False, "fake_score": 0.0, "error": str(e)}
    

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python deepfake_video_detector.py <video_file>")
        sys.exit(1)

    video_file = sys.argv[1]
    if not os.path.exists(video_file):
        print("Error: Video file not found.")
        sys.exit(1)

    print(f"\nAnalyzing: {video_file}\nUsing model: {IMAGE_MODEL}\n")
    result = detect_deepfake(video_file)

    if "error" in result and result["error"]:
        print(f"Error: {result['error']}")
    else:
        print(f"Highest Fake Score: {result['fake_score']:.4f}")
        print("Conclusion:", "LIKELY DEEPFAKE" if result["is_deepfake"] else "LIKELY REAL")
    
