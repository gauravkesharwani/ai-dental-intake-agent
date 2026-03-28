"""Mock schedule store for the dental practice demo."""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass
class TimeSlot:
    id: str
    doctor: str
    start: datetime
    duration_min: int = 30
    is_booked: bool = False
    booked_by: str | None = None


class ScheduleStore:
    """In-memory schedule with pre-populated slots for demo purposes."""

    def __init__(self):
        self.slots: dict[str, TimeSlot] = {}
        self._populate()

    def _populate(self):
        doctors = ["Dr. Smith", "Dr. Patel"]
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

        for day_offset in range(1, 4):  # next 3 days
            day = today + timedelta(days=day_offset)
            if day.weekday() >= 5:  # skip weekends
                continue
            for doctor in doctors:
                hour = 9
                while hour < 17:
                    slot_time = day.replace(hour=hour, minute=0)
                    slot_id = str(uuid.uuid4())[:8]
                    self.slots[slot_id] = TimeSlot(
                        id=slot_id,
                        doctor=doctor,
                        start=slot_time,
                    )
                    # also add :30 slot
                    slot_time_half = day.replace(hour=hour, minute=30)
                    slot_id_half = str(uuid.uuid4())[:8]
                    self.slots[slot_id_half] = TimeSlot(
                        id=slot_id_half,
                        doctor=doctor,
                        start=slot_time_half,
                    )
                    hour += 1

    def check_available(
        self, doctor: str | None = None, date: str | None = None
    ) -> list[dict]:
        """Return available slots, optionally filtered by doctor and/or date string."""
        results = []
        for slot in self.slots.values():
            if slot.is_booked:
                continue
            if doctor and doctor.lower() not in slot.doctor.lower():
                continue
            if date:
                slot_date_str = slot.start.strftime("%Y-%m-%d")
                if date not in slot_date_str:
                    continue
            results.append(
                {
                    "id": slot.id,
                    "doctor": slot.doctor,
                    "start": slot.start.strftime("%Y-%m-%d %H:%M"),
                    "duration_min": slot.duration_min,
                }
            )
        results.sort(key=lambda s: s["start"])
        return results[:10]  # return at most 10 to keep LLM context small

    def book(self, slot_id: str, patient_name: str) -> dict:
        """Book a slot by ID. Returns confirmation or error."""
        slot = self.slots.get(slot_id)
        if not slot:
            return {"success": False, "error": f"Slot {slot_id} not found"}
        if slot.is_booked:
            return {
                "success": False,
                "error": f"Slot {slot_id} is already booked by {slot.booked_by}",
            }
        slot.is_booked = True
        slot.booked_by = patient_name
        return {
            "success": True,
            "doctor": slot.doctor,
            "start": slot.start.strftime("%Y-%m-%d %H:%M"),
            "patient": patient_name,
        }


schedule_store = ScheduleStore()
