import cv2
import pytesseract
from PIL import Image
from pyzbar.pyzbar import decode
from lxml import etree
from rapidfuzz import fuzz 
import re
import argparse
import sys
import shutil 
import logging
import os

logging.basicConfig(level=logging.INFO)

class DocumentVerifier:
    """
    A class to verify government documents like Aadhar cards by comparing
    data from the QR code with text extracted via OCR.
    """
    def __init__(self, image_path: str):
        """
        Initializes the verifier with the path to the document image.
        """
        if not image_path:
            raise ValueError("Image path cannot be empty.")
        
        self.image_path = image_path
        
        if not os.path.exists(self.image_path):
            raise FileNotFoundError(f"File does not exist at path: {self.image_path}")

        try:
            self.image = cv2.imread(self.image_path)
            if self.image is None:
                raise ValueError(f"OpenCV could not read image file at {self.image_path}. Check file format.")
        except Exception as e:
            logging.error(f"Error loading image: {e}")
            raise IOError(f"Error loading image: {e}")

    def decode_qr_code(self) -> dict | None:
        """
        Decodes the QR code from the document image and parses the XML data.
        Aadhaar QR codes contain digitally signed XML.
        """
        try:
            barcodes = decode(self.image)
            if not barcodes:
                logging.warning("No QR code found in document image.")
                return None

            qr_data_raw = barcodes[0].data

            if not self._verify_signature(qr_data_raw):
                logging.warning("Digital signature verification failed. The QR code may be tampered with.")

            qr_data_str = qr_data_raw.decode('utf-8', 'ignore')
            
            xml_start_index = qr_data_str.find('<?xml')
            if xml_start_index == -1:
                 logging.warning("QR data does not appear to be XML. Returning raw data.")
                 return {"raw_data": qr_data_str}

            xml_data = qr_data_str[xml_start_index:]
            
            try:
                root = etree.fromstring(xml_data.encode('utf-8'))
                qr_info = {
                    "name": root.get("name"),
                    "dob": root.get("dob"),
                    "gender": root.get("gender"),
                    "pincode": root.get("pc"),
                }
                return qr_info
            except etree.XMLSyntaxError:
                logging.error("Failed to parse XML from QR code.")
                return {"raw_data": qr_data_str}

        except Exception as e:
            logging.error(f"Error decoding or parsing QR code: {e}", exc_info=True)
            return None

    def _verify_signature(self, qr_data: bytes) -> bool:
        """
        **SIMULATED** digital signature verification.
        In production, use cryptographic libraries to verify the signature.
        """
        return True

    def extract_text_with_ocr(self) -> str:
        """
        Performs OCR on the image to extract all visible text.
        """
        try:
            gray_image = cv2.cvtColor(self.image, cv2.COLOR_BGR2GRAY)
            
            # Optional: Thresholding can sometimes improve OCR accuracy
            # _, thresh_image = cv2.threshold(gray_image, 150, 255, cv2.THRESH_BINARY)
            
            pil_img = Image.fromarray(gray_image)
            
            # 'eng' for English. Add other languages if needed (e.g., 'eng+hin')
            extracted_text = pytesseract.image_to_string(pil_img, lang='eng')
            
            return extracted_text.lower()
        except Exception as e:
            logging.error(f"Error during OCR extraction: {e}", exc_info=True)
            return ""

    def verify_document(self) -> dict:
        """
        Main verification method that orchestrates the entire process.
        """
        logging.info(f"Starting Document Verification for {os.path.basename(self.image_path)}")
        
        qr_info = self.decode_qr_code()
        if not qr_info:
            return {"status": "REJECTED", "reason": "No QR code found or could not be read."}
        
        logging.info(f"QR Code Decoded Successfully. Name: {qr_info.get('name', 'Unknown')}")

        ocr_text = self.extract_text_with_ocr()
        if not ocr_text:
            return {"status": "FLAGGED", "reason": "Could not extract any text from the document image."}
        
        # Clean up OCR text (remove extra whitespace)
        ocr_text = " ".join(ocr_text.split()) 

        mismatches = []
        
        # 1. Verify Name using Fuzzy Matching
        if qr_info.get("name"):
            qr_name = qr_info["name"].lower()
            # partial_ratio checks if qr_name is a substring of ocr_text with some tolerance
            similarity_score = fuzz.partial_ratio(qr_name, ocr_text)
            
            if similarity_score < 80: # Threshold: 80% match required
                mismatches.append(f"Name mismatch (Score: {similarity_score})")
            else:
                logging.info(f"Name Verified (Score: {similarity_score})")

        # 2. Verify DOB (Strict Date Matching)
        if qr_info.get("dob"):
            # Allow formats like DD-MM-YYYY or DD/MM/YYYY
            dob_pattern = qr_info["dob"].replace("-", "[/-]").replace("/", "[/-]")
            if not re.search(dob_pattern, ocr_text):
                mismatches.append(f"DOB mismatch (QR: {qr_info['dob']})")

        if mismatches:
            logging.warning(f"Verification Flagged: {mismatches}")
            return {
                "status": "FLAGGED",
                "reason": "Data mismatch between QR code and visible text.",
                "mismatched_fields": mismatches,
                "qr_data": qr_info
            }
        else:
            logging.info("Document Verified Successfully.")
            return {
                "status": "VERIFIED",
                "reason": "QR code data matches visible text.",
                "qr_data": qr_info
            }

if __name__ == "__main__":
    # This block allows you to run the script standalone for testing
    tesseract_path = shutil.which('tesseract')
    if tesseract_path:
        pytesseract.pytesseract.tesseract_cmd = tesseract_path
        print(f"Standalone Test: Tesseract found at {tesseract_path}")
    else:
        print("Standalone Test Error: Tesseract not found.")
        sys.exit(1)

    parser = argparse.ArgumentParser(description="Verify a government document image.")
    parser.add_argument("image_path", type=str, help="The file path to the document image.")
    args = parser.parse_args()

    try:
        verifier = DocumentVerifier(args.image_path)
        result = verifier.verify_document()
        print("\n--- FINAL REPORT ---")
        for key, value in result.items():
            print(f"{key}: {value}")
        print("--------------------")
    except Exception as e:
        print(f"Error: {e}")