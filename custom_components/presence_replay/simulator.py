
from __future__ import annotations
import asyncio, logging, random
from dataclasses import dataclass
from datetime import datetime, timedelta
from homeassistant.components.recorder import history
from homeassistant.core import HomeAssistant
from homeassistant.util.dt import utcnow
from .const import CONF_ENTITIES, CONF_REFERENCE_DAYS, CONF_RANDOM_SEC, CONF_MIN_EVENT_GAP, CONF_TIME_WINDOWS, DEFAULT_REFERENCE_DAYS, DEFAULT_RANDOM_SEC, DEFAULT_MIN_EVENT_GAP

_LOGGER = logging.getLogger(__name__)

@dataclass
class ReplayEvent:
    when: datetime
    entity_id: str
    state: str

def _in_windows(dt: datetime, windows: list[dict]) -> bool:
    if not windows:
        return True
    t = dt.time()
    for w in windows:
        try:
            s = datetime.strptime(w["start"], "%H:%M").time()
            e = datetime.strptime(w["end"], "%H:%M").time()
        except Exception:
            continue
        if s <= t <= e:
            return True
    return False

class PresenceSimulator:
    def __init__(self, hass: HomeAssistant):
        self.hass = hass
        self._task: asyncio.Task | None = None

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except Exception:
                pass
        self._task = None

    async def start(self, cfg: dict) -> None:
        await self.stop()
        events = await self.build_schedule(cfg)
        self._task = asyncio.create_task(self._run(events))

    async def build_schedule(self, cfg: dict) -> list[ReplayEvent]:
        now = utcnow()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)

        entities = list(cfg.get(CONF_ENTITIES, []))
        reference_days = int(cfg.get(CONF_REFERENCE_DAYS, DEFAULT_REFERENCE_DAYS))
        random_sec = int(cfg.get(CONF_RANDOM_SEC, DEFAULT_RANDOM_SEC))
        min_gap = int(cfg.get(CONF_MIN_EVENT_GAP, DEFAULT_MIN_EVENT_GAP))
        windows = cfg.get(CONF_TIME_WINDOWS, []) or []

        events: list[ReplayEvent] = []
        for ent in entities:
            day_offset = random.randint(1, max(1, reference_days))
            ref_start = today - timedelta(days=day_offset)
            ref_end = ref_start + timedelta(days=1)

            def _fetch():
                return history.get_significant_states(
                    self.hass, ref_start, ref_end,
                    entity_ids=[ent],
                    include_start_time_state=True,
                    significant_changes_only=False,
                    minimal_response=False,
                )

            try:
                states_map = await self.hass.async_add_executor_job(_fetch)
                states = (states_map or {}).get(ent, [])
            except Exception as e:
                _LOGGER.debug("History fetch failed for %s: %s", ent, e)
                continue

            last_state = None
            last_time = None
            for st in states:
                if not st or st.state in ("unknown","unavailable",None):
                    continue
                when = today + (st.last_changed - ref_start)
                if random_sec:
                    when += timedelta(seconds=random.randint(-random_sec, random_sec))
                if not _in_windows(when, windows):
                    continue
                if last_state == st.state:
                    continue
                if last_time and (when - last_time).total_seconds() < min_gap:
                    continue
                events.append(ReplayEvent(when=when, entity_id=ent, state=st.state))
                last_state = st.state
                last_time = when

        events.sort(key=lambda e: e.when)
        cutoff = now - timedelta(seconds=3)
        return [e for e in events if e.when >= cutoff]

    async def _run(self, events: list[ReplayEvent]) -> None:
        for ev in events:
            delay = (ev.when - utcnow()).total_seconds()
            if delay > 0:
                await asyncio.sleep(delay)

            domain = ev.entity_id.split(".", 1)[0]
            if domain == "light":
                svc = "turn_on" if ev.state == "on" else "turn_off"
                await self.hass.services.async_call("light", svc, {"entity_id": ev.entity_id}, blocking=False)
            elif domain == "switch":
                svc = "turn_on" if ev.state == "on" else "turn_off"
                await self.hass.services.async_call("switch", svc, {"entity_id": ev.entity_id}, blocking=False)
            elif domain == "cover":
                if ev.state in ("open","opening"):
                    await self.hass.services.async_call("cover","open_cover",{"entity_id": ev.entity_id},blocking=False)
                elif ev.state in ("closed","closing"):
                    await self.hass.services.async_call("cover","close_cover",{"entity_id": ev.entity_id},blocking=False)
