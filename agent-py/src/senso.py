"""Knowledge base client — uses Senso KB API (apiv2.senso.ai)."""

import json
import logging
import os
from datetime import datetime

import requests

logger = logging.getLogger("senso")

SENSO_BASE = "https://apiv2.senso.ai/api/v1"


class SensoClient:
    """Persists call summaries to Senso KB and retrieves them via semantic search."""

    def __init__(self):
        self._api_key = os.getenv("SENSO_API_KEY")
        self._folder_id: str | None = None
        self._memory_store: list[dict] = []

        if self._api_key:
            logger.info("Senso API key configured")
            self._ensure_folder()
        else:
            logger.info("No SENSO_API_KEY — using in-memory knowledge base")

    def _headers(self) -> dict:
        return {
            "X-API-Key": self._api_key,
            "Content-Type": "application/json",
        }

    def _ensure_folder(self):
        """Find or create the 'Patient Intakes' folder in the KB root."""
        try:
            resp = requests.get(
                f"{SENSO_BASE}/org/kb/my-files",
                headers=self._headers(),
                timeout=10,
            )
            resp.raise_for_status()
            for node in resp.json().get("nodes", []):
                if node["type"] == "folder" and node["name"] == "Patient Intakes":
                    self._folder_id = node["kb_node_id"]
                    logger.info("Found existing folder: %s", self._folder_id)
                    return

            # Create the folder
            resp = requests.post(
                f"{SENSO_BASE}/org/kb/folders",
                headers=self._headers(),
                json={"name": "Patient Intakes"},
                timeout=10,
            )
            resp.raise_for_status()
            self._folder_id = resp.json()["kb_node_id"]
            logger.info("Created folder: %s", self._folder_id)
        except Exception as e:
            logger.warning("Failed to set up Senso folder: %s", e)

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def write_summary(
        self,
        patient_name: str,
        patient_intent: str,
        insurance_detected: str = "",
        slot_booked: str = "",
        new_facts_learned: list[str] | None = None,
    ) -> str:
        entry = {
            "patient_name": patient_name,
            "patient_intent": patient_intent,
            "insurance_detected": insurance_detected,
            "slot_booked": slot_booked,
            "new_facts_learned": new_facts_learned or [],
            "timestamp": datetime.now().isoformat(),
        }
        self._memory_store.append(entry)

        if self._api_key and self._folder_id:
            try:
                facts_str = ", ".join(new_facts_learned or [])
                text = (
                    f"Patient: {patient_name}\n"
                    f"Reason for visit: {patient_intent}\n"
                    f"Insurance: {insurance_detected or 'Not provided'}\n"
                    f"Appointment: {slot_booked or 'Not booked'}\n"
                    f"Additional notes: {facts_str or 'None'}"
                )
                today = datetime.now().strftime("%Y-%m-%d")
                resp = requests.post(
                    f"{SENSO_BASE}/org/kb/raw",
                    headers=self._headers(),
                    json={
                        "kb_folder_node_id": self._folder_id,
                        "title": f"Intake: {patient_name} - {today}",
                        "summary": f"{patient_name} — {patient_intent}",
                        "text": text,
                    },
                    timeout=10,
                )
                resp.raise_for_status()
                logger.info("Wrote summary to Senso KB for %s", patient_name)
            except Exception as e:
                logger.warning("Senso write failed (kept in memory): %s", e)

        return f"Summary stored for {patient_name}"

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    def search_patient(self, patient_name: str) -> list[dict]:
        """Search for previous visits by patient name."""
        results = []

        # Search Senso cloud
        if self._api_key:
            try:
                resp = requests.post(
                    f"{SENSO_BASE}/org/search",
                    headers=self._headers(),
                    json={"query": f"{patient_name} patient intake visit"},
                    timeout=15,
                )
                resp.raise_for_status()
                data = resp.json()

                for item in data.get("results", []):
                    chunk = item.get("chunk_text", "")
                    # Parse the structured text back into fields
                    fields = {}
                    for line in chunk.split("\n"):
                        if ":" in line:
                            key, _, val = line.partition(":")
                            fields[key.strip().lower()] = val.strip()

                    results.append({
                        "patient_name": fields.get("patient", patient_name),
                        "patient_intent": fields.get("reason for visit", ""),
                        "insurance_detected": fields.get("insurance", ""),
                        "slot_booked": fields.get("appointment", ""),
                        "new_facts_learned": [
                            f for f in fields.get("additional notes", "").split(",")
                            if f.strip() and f.strip() != "None"
                        ],
                        "timestamp": item.get("created_at", datetime.now().isoformat()),
                        "source": "senso",
                    })
                logger.info(
                    "Senso search returned %d results for %s",
                    len(results), patient_name,
                )
            except Exception as e:
                logger.warning("Senso search failed: %s", e)

        # Also check in-memory store
        memory_results = [
            e for e in self._memory_store
            if e["patient_name"].lower() == patient_name.lower()
        ]
        # Avoid duplicates — only add memory results not already in Senso results
        if not results:
            results.extend(memory_results)

        return results

    def get_context(self, patient_name: str | None = None) -> list[dict]:
        """Retrieve past call summaries, optionally filtered by patient name."""
        if patient_name:
            return self.search_patient(patient_name)
        return list(self._memory_store)


senso_client = SensoClient()
