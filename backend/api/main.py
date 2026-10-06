from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from supabase import create_client, Client

from uuid import uuid4
import logging

import os
from dotenv import load_dotenv

from LLM.apicall import extract_clinical_information


api = FastAPI()
logger = logging.getLogger(__name__)

api.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "https://prescribe-kappa.vercel.app",
    ],
    allow_methods=["POST"],
    allow_headers=["Authorization", "Content-Type"],
)

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY
)


@api.get("/health")
def health():
    return {"status": "healthy"}


# Dependency to get the current user (mock implementation)
security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        response = supabase.auth.get_user(token)

        if not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token"
            )

        return {
            "id": response.user.id,
            "email": response.user.email
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(
            "Supabase access-token verification failed (%s)",
            type(exc).__name__,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )




@api.post("/process")
async def process_note(
    file: UploadFile = File(...),
    filename: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    try:
        # Generate a unique ID for the clinical note
        note_id = str(uuid4())

        user_id = current_user["id"]

        # Get the uploaded file contents
        file_bytes = await file.read()

        # Basic validation
        allowed_types = {
            "image/jpeg",
            "image/png",
            "image/webp"
        }

        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail="Only JPEG, PNG, and WebP images are supported."
            )

        if not file_bytes:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty."
            )

        # Preserve the original extension
        extension = os.path.splitext(file.filename or "")[1].lower()

        if not extension:
            extension = ".jpg"

        # Storage path
        storage_path = (
            f"{user_id}/{note_id}/original{extension}"
        )

        # Upload image to Supabase Storage
        supabase.storage \
            .from_("notes") \
            .upload(
                storage_path,
                file_bytes,
                {
                    "content-type": file.content_type,
                    "upsert": False
                }
            )

        # Create database record
        note_data = {
            "id": note_id,
            "user_id": user_id,
            "filename": filename,
            "storage_path": storage_path,
            "status": "uploaded"
        }

        response = supabase \
            .table("clinical_notes") \
            .insert(note_data) \
            .execute()


        extracted_info = extract_clinical_information(
            storage_path=storage_path,
            filename=filename
        )

        final_output_response = supabase \
            .table("final_outputs") \
            .insert({
                "note_id": note_id,
                "output": extracted_info
            }) \
            .execute()

        return {
            "success": True,
            "message": "Clinical note uploaded successfully.",
            "note": response.data[0],
            "final_output": final_output_response.data[0]
        }

    except HTTPException:
        raise

    except Exception as e:
        print("Error processing clinical note:", e)

        raise HTTPException(
            status_code=500,
            detail="Failed to process clinical note."
        )