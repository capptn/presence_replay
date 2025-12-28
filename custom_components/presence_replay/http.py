
from __future__ import annotations
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant
from .storage import PresenceReplayStore

class ConfigView(HomeAssistantView):
    url = "/api/presence_replay/config"
    name = "api:presence_replay:config"
    requires_auth = True
    def __init__(self, hass: HomeAssistant, store: PresenceReplayStore):
        self.hass = hass
        self.store = store
    async def get(self, request):
        return self.json(await self.store.load())
    async def post(self, request):
        body = await request.json()
        data = await self.store.load()
        data["config"] = body.get("config", {})
        await self.store.save(data)
        return self.json({"ok": True})

class PreviewView(HomeAssistantView):
    url = "/api/presence_replay/preview"
    name = "api:presence_replay:preview"
    requires_auth = True
    def __init__(self, simulator):
        self.simulator = simulator
    async def post(self, request):
        cfg = await request.json()
        events = await self.simulator.build_schedule(cfg)
        return self.json([{"time": e.when.isoformat(), "entity_id": e.entity_id, "state": e.state} for e in events])

class StatusView(HomeAssistantView):
    url = "/api/presence_replay/status"
    name = "api:presence_replay:status"
    requires_auth = True
    def __init__(self, simulator):
        self.simulator = simulator
    async def get(self, request):
        return self.json({"running": bool(self.simulator.running)})
