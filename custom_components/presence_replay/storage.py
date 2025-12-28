
from __future__ import annotations
from homeassistant.helpers.storage import Store
from .const import STORAGE_KEY, STORAGE_VERSION

class PresenceReplayStore:
    def __init__(self, hass):
        self._store = Store(hass, STORAGE_VERSION, STORAGE_KEY)

    async def load(self) -> dict:
        return await self._store.async_load() or {}

    async def save(self, data: dict) -> None:
        await self._store.async_save(data)
