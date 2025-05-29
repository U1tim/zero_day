from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect, Depends, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import json
import aiofiles
import socketio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Create uploads directory if it doesn't exist
uploads_dir = ROOT_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)

# Mount static files
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Socket.IO server
sio = socketio.AsyncServer(
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True
)

# Define Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    username: str
    email: str

class Invention(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    creator_id: str
    creator_name: str
    model_file_path: Optional[str] = None
    model_file_name: Optional[str] = None
    is_public: bool = False
    tags: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class InventionCreate(BaseModel):
    title: str
    description: str
    creator_name: str
    is_public: bool = False
    tags: List[str] = []

class Group(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    invention_id: Optional[str] = None
    members: List[str] = []
    creator_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class GroupCreate(BaseModel):
    name: str
    description: str
    invention_id: Optional[str] = None

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    group_id: str
    sender_name: str
    message: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ChatMessageCreate(BaseModel):
    group_id: str
    sender_name: str
    message: str

class PublicSuggestion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    technology_area: str
    suggested_by: str
    inspiration_source: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PublicSuggestionCreate(BaseModel):
    title: str
    description: str
    technology_area: str
    suggested_by: str
    inspiration_source: Optional[str] = None

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, group_id: str):
        await websocket.accept()
        if group_id not in self.active_connections:
            self.active_connections[group_id] = []
        self.active_connections[group_id].append(websocket)

    def disconnect(self, websocket: WebSocket, group_id: str):
        if group_id in self.active_connections:
            self.active_connections[group_id].remove(websocket)

    async def send_message_to_group(self, message: str, group_id: str):
        if group_id in self.active_connections:
            for connection in self.active_connections[group_id]:
                try:
                    await connection.send_text(message)
                except:
                    pass

manager = ConnectionManager()

# API Routes
@api_router.get("/")
async def root():
    return {"message": "InventHub API - Collaborative Innovation Platform"}

# User routes
@api_router.post("/users", response_model=User)
async def create_user(user: UserCreate):
    user_dict = user.dict()
    user_obj = User(**user_dict)
    await db.users.insert_one(user_obj.dict())
    return user_obj

@api_router.get("/users", response_model=List[User])
async def get_users():
    users = await db.users.find().to_list(1000)
    return [User(**user) for user in users]

# Invention routes
@api_router.post("/inventions", response_model=Invention)
async def create_invention(invention: InventionCreate):
    invention_dict = invention.dict()
    invention_obj = Invention(**invention_dict)
    await db.inventions.insert_one(invention_obj.dict())
    return invention_obj

@api_router.get("/inventions", response_model=List[Invention])
async def get_inventions():
    inventions = await db.inventions.find().to_list(1000)
    return [Invention(**invention) for invention in inventions]

@api_router.get("/inventions/public", response_model=List[Invention])
async def get_public_inventions():
    inventions = await db.inventions.find({"is_public": True}).to_list(1000)
    return [Invention(**invention) for invention in inventions]

@api_router.get("/inventions/{invention_id}", response_model=Invention)
async def get_invention(invention_id: str):
    invention = await db.inventions.find_one({"id": invention_id})
    if not invention:
        raise HTTPException(status_code=404, detail="Invention not found")
    return Invention(**invention)

@api_router.post("/inventions/{invention_id}/upload-model")
async def upload_3d_model(invention_id: str, file: UploadFile = File(...)):
    # Validate file type
    allowed_extensions = ['.glb', '.gltf', '.obj', '.fbx', '.dae', '.ply', '.stl', '.3ds']
    file_extension = Path(file.filename).suffix.lower()
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"File type {file_extension} not supported. Allowed types: {', '.join(allowed_extensions)}"
        )
    
    # Check file size (10GB limit)
    max_size = 10 * 1024 * 1024 * 1024  # 10GB in bytes
    file_size = 0
    temp_file = uploads_dir / f"temp_{uuid.uuid4()}{file_extension}"
    
    try:
        async with aiofiles.open(temp_file, 'wb') as f:
            while chunk := await file.read(8192):  # Read in 8KB chunks
                file_size += len(chunk)
                if file_size > max_size:
                    temp_file.unlink()  # Delete temp file
                    raise HTTPException(status_code=413, detail="File too large. Maximum size is 10GB")
                await f.write(chunk)
        
        # Save with proper filename
        file_path = uploads_dir / f"{invention_id}_{file.filename}"
        temp_file.rename(file_path)
        
        # Update invention in database
        await db.inventions.update_one(
            {"id": invention_id},
            {
                "$set": {
                    "model_file_path": str(file_path),
                    "model_file_name": file.filename,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return {"message": "Model uploaded successfully", "file_path": str(file_path)}
        
    except Exception as e:
        if temp_file.exists():
            temp_file.unlink()
        raise HTTPException(status_code=500, detail=str(e))

# Group routes
@api_router.post("/groups", response_model=Group)
async def create_group(group: GroupCreate):
    group_dict = group.dict()
    # For now, use a placeholder creator_id
    group_dict["creator_id"] = "user_" + str(uuid.uuid4())[:8]
    group_obj = Group(**group_dict)
    await db.groups.insert_one(group_obj.dict())
    return group_obj

@api_router.get("/groups", response_model=List[Group])
async def get_groups():
    groups = await db.groups.find().to_list(1000)
    return [Group(**group) for group in groups]

@api_router.get("/groups/{group_id}", response_model=Group)
async def get_group(group_id: str):
    group = await db.groups.find_one({"id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return Group(**group)

# Chat routes
@api_router.post("/chat/messages", response_model=ChatMessage)
async def send_message(message: ChatMessageCreate):
    message_dict = message.dict()
    message_obj = ChatMessage(**message_dict)
    await db.chat_messages.insert_one(message_obj.dict())
    
    # Send message to WebSocket connections
    await manager.send_message_to_group(
        json.dumps(message_obj.dict(), default=str),
        message.group_id
    )
    
    return message_obj

@api_router.get("/chat/messages/{group_id}", response_model=List[ChatMessage])
async def get_messages(group_id: str):
    messages = await db.chat_messages.find({"group_id": group_id}).sort("timestamp", 1).to_list(1000)
    return [ChatMessage(**message) for message in messages]

# Public suggestions routes
@api_router.post("/suggestions", response_model=PublicSuggestion)
async def create_suggestion(suggestion: PublicSuggestionCreate):
    suggestion_dict = suggestion.dict()
    suggestion_obj = PublicSuggestion(**suggestion_dict)
    await db.suggestions.insert_one(suggestion_obj.dict())
    return suggestion_obj

@api_router.get("/suggestions", response_model=List[PublicSuggestion])
async def get_suggestions():
    suggestions = await db.suggestions.find().sort("created_at", -1).to_list(1000)
    return [PublicSuggestion(**suggestion) for suggestion in suggestions]

# WebSocket endpoint for real-time chat
@api_router.websocket("/ws/{group_id}")
async def websocket_endpoint(websocket: WebSocket, group_id: str):
    await manager.connect(websocket, group_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo back the message to all connections in the group
            await manager.send_message_to_group(data, group_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, group_id)

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
