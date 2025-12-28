
from __future__ import annotations
import logging, os
from homeassistant.components import frontend
from homeassistant.core import HomeAssistant
from .const import DEFAULT_REFERENCE_DAYS, DEFAULT_RANDOM_SEC, DEFAULT_MIN_EVENT_GAP, DEFAULT_TIME_WINDOWS
from .http import ConfigView, PreviewView, StatusView
from .services import async_register_services
from .simulator import PresenceSimulator
from .storage import PresenceReplayStore

_LOGGER = logging.getLogger(__name__)

async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    _LOGGER.warning("Presence Replay loaded")

    store = PresenceReplayStore(hass)
    simulator = PresenceSimulator(hass)

    data = await store.load()
    if "config" not in data:
        await store.save({"config": {
            "entities": [],
            "reference_days": DEFAULT_REFERENCE_DAYS,
            "random_seconds": DEFAULT_RANDOM_SEC,
            "min_event_gap": DEFAULT_MIN_EVENT_GAP,
            "time_windows": DEFAULT_TIME_WINDOWS,
        }})

    hass.http.register_view(ConfigView(hass, store))
    hass.http.register_view(PreviewView(simulator))
    hass.http.register_view(StatusView(simulator))

    panel_dir = os.path.join(os.path.dirname(__file__), "panel")
    hass.http.register_static_path("/presence_replay_panel", panel_dir, cache_headers=False)

    frontend.async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="Presence Replay",
        sidebar_icon="mdi:account-clock",
        frontend_url_path="presence-replay",
        config={"_panel_custom": {"name": "presence-replay-panel", "js_url": "/presence_replay_panel/presence-replay-panel.js"}},
        require_admin=True,
    )

    await async_register_services(hass, simulator, store)
    return True
