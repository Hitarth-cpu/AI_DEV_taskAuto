import json
from typing import Dict, Any
from fastapi import WebSocket, WebSocketDisconnect

class ConnectionManager:
    def __init__(self):
        # A dictionary mapping CLI agent tokens to active WebSockets
        self.cli_connections: Dict[str, WebSocket] = {}
        # A dictionary mapping UI session IDs to active WebSockets
        self.ui_connections: Dict[str, WebSocket] = {}

    async def connect_cli(self, token: str, websocket: WebSocket):
        await websocket.accept()
        self.cli_connections[token] = websocket
        # Broadcast to all UIs that an agent is online
        await self.broadcast_ui({"type": "agent_status", "token": token, "status": "online"})

    def disconnect_cli(self, token: str):
        if token in self.cli_connections:
            del self.cli_connections[token]

    async def connect_ui(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.ui_connections[session_id] = websocket

    def disconnect_ui(self, session_id: str):
        if session_id in self.ui_connections:
            del self.ui_connections[session_id]

    async def send_to_cli(self, token: str, message: dict):
        if token in self.cli_connections:
            await self.cli_connections[token].send_json(message)
            return True
        return False

    async def broadcast_ui(self, message: dict):
        for connection in self.ui_connections.values():
            await connection.send_json(message)

manager = ConnectionManager()
