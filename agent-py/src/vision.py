"""Card OCR via Gemini Vision, with mock fallback."""

import json
import logging
import os

logger = logging.getLogger("vision")

MOCK_INSURANCE_DATA = {
    "insurance_provider": "Delta Dental PPO",
    "member_id": "DDG-123456789",
    "group_number": "GRP-8842",
    "policy_holder": "Jane Doe",
}

MOCK_ID_DATA = {
    "full_name": "Jane Doe",
    "date_of_birth": "03/15/1990",
    "address": "123 Oak Street, San Francisco, CA 94102",
}


async def _call_gemini(image_base64: str, prompt: str) -> str | None:
    """Call Gemini Vision and return raw text response, or None on failure."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return None

    import google.generativeai as genai

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.5-flash")

    response = await model.generate_content_async(
        [
            {
                "inline_data": {
                    "mime_type": "image/jpeg",
                    "data": image_base64,
                }
            },
            prompt,
        ]
    )

    text = response.text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        text = text.rsplit("```", 1)[0].strip()

    return text


async def extract_insurance_info(image_base64: str) -> dict:
    """Extract insurance info from a base64-encoded card image."""
    try:
        text = await _call_gemini(
            image_base64,
            "Extract the following from this insurance card as JSON: "
            "insurance_provider, member_id, group_number, policy_holder. "
            "Return only valid JSON, no markdown.",
        )
        if text is None:
            logger.info("No GOOGLE_API_KEY set, returning mock insurance data")
            return MOCK_INSURANCE_DATA
        return json.loads(text)
    except Exception as e:
        logger.warning(f"Gemini Vision failed, returning mock data: {e}")
        return MOCK_INSURANCE_DATA


async def extract_id_info(image_base64: str) -> dict:
    """Extract personal info from a photo ID (driver's license)."""
    try:
        text = await _call_gemini(
            image_base64,
            "Extract the following from this photo ID / driver's license as JSON: "
            "full_name, date_of_birth, address. "
            "Return only valid JSON, no markdown.",
        )
        if text is None:
            logger.info("No GOOGLE_API_KEY set, returning mock ID data")
            return MOCK_ID_DATA
        return json.loads(text)
    except Exception as e:
        logger.warning(f"Gemini Vision failed for ID, returning mock data: {e}")
        return MOCK_ID_DATA
