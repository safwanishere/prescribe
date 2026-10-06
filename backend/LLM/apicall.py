import os
import json

from google import genai
from google.genai import types

from dotenv import load_dotenv
from supabase import Client, create_client


load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not configured")
if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SECRET_KEY must be configured")

client = genai.Client(api_key=GEMINI_API_KEY)

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY
)



SYSTEM_PROMPT = """
You are a clinical information extraction assistant.

Your task is to analyze an image of a handwritten or typed clinical note
and extract the clinically relevant information into the required JSON structure.

Important rules:

1. Carefully read the entire clinical note.
2. Extract information only when it is present in the note.
3. Do not invent, infer, or hallucinate missing information.
4. If a field is not present or cannot be reliably read, return null or an empty array
   depending on the field type.
5. Preserve the meaning of the original note.
6. Correct obvious OCR/handwriting interpretation errors when the context makes
   the intended text clear.
7. Do not provide medical advice, diagnosis, or treatment recommendations.
8. Return ONLY the requested structured JSON.
"""


RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "patient_name": {
            "type": "STRING",
            "nullable": True
        },
        "age": {
            "type": "INTEGER",
            "nullable": True
        },
        "sex": {
            "type": "STRING",
            "nullable": True
        },
        "symptoms": {
            "type": "ARRAY",
            "items": {
                "type": "STRING"
            }
        },
        "medical_history": {
            "type": "ARRAY",
            "items": {
                "type": "STRING"
            }
        },
        "family_history": {
            "type": "ARRAY",
            "items": {
                "type": "STRING"
            }
        },
        "allergies": {
            "type": "ARRAY",
            "items": {
                "type": "STRING"
            }
        },
        "medications": {
            "type": "ARRAY",
            "items": {
                "type": "STRING"
            }
        }
    },
    "required": [
        "patient_name",
        "age",
        "sex",
        "symptoms",
        "medical_history",
        "family_history",
        "allergies",
        "medications"
    ]
}


def extract_clinical_information(
    storage_path: str,
    filename: str
):
    """
    Download an image from Supabase Storage and send it to Gemini
    for structured clinical information extraction.

    Args:
        storage_path: Path of the image inside the Supabase bucket.
        filename: Original filename of the uploaded image.

    Returns:
        Dictionary containing the structured clinical information.
    """

    try:
        # Download image from Supabase Storage
        image_bytes = (
            supabase.storage
            .from_("notes")
            .download(storage_path)
        )

        # Determine MIME type
        extension = os.path.splitext(filename)[1].lower()
        if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
            extension = os.path.splitext(storage_path)[1].lower()

        mime_types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp"
        }

        mime_type = mime_types.get(extension)

        if not mime_type:
            raise ValueError(
                f"Unsupported image format: {extension}"
            )

        # Send image + system prompt to Gemini
        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=[
                types.Part.from_text(
                    text=SYSTEM_PROMPT
                ),
                types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=mime_type
                )
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=RESPONSE_SCHEMA
            )
        )

        # Convert Gemini's JSON response to Python dictionary
        result = json.loads(response.text)

        return result

    except Exception as e:
        print("Gemini extraction error:", e)
        raise


# print(extract_clinical_information(
#     storage_path="1a968579-c1b4-4a0f-9e1c-be4ce6219abc/14838b55-ffde-4a73-ae5f-5f2cf1442066/original.jpeg",
#     filename="original.jpeg"
# ))