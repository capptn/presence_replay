
from __future__ import annotations
import logging
import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall
from .const import DOMAIN
from .storage import PresenceReplayStore

_LOGGER = logging.getLogger(__name__)
START_SCHEMA = vol.Schema({vol.Optional("config"): dict})

async def async_register_services(hass: HomeAssistant, simulator, store: PresenceReplayStore) -> None:
    async def handle_start(call: ServiceCall):
        cfg = call.data.get("config")
        if cfg is None:
            cfg = (await store.load()).get("config", {})
        await simulator.start(cfg)

    async def handle_stop(call: ServiceCall):
        await simulator.stop()

    hass.services.async_register(DOMAIN, "start", handle_start, schema=START_SCHEMA)
    hass.services.async_register(DOMAIN, "stop", handle_stop)
