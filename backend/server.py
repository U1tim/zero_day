from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect, Depends, status, Query
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
from enum import Enum

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

# Enums
class UserRole(str, Enum):
    STUDENT = "student"
    RESEARCHER = "researcher"
    MENTOR = "mentor"
    INDUSTRY = "industry"

class NotificationType(str, Enum):
    VOTE = "vote"
    REVIEW = "review"
    COMMENT = "comment"
    MENTOR_REQUEST = "mentor_request"
    GROUP_INVITE = "group_invite"
    SYSTEM = "system"

class ReviewStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"

# Enhanced Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    full_name: str
    bio: Optional[str] = None
    role: UserRole = UserRole.STUDENT
    institution: Optional[str] = None
    specialization: List[str] = []
    skills: List[str] = []
    is_mentor: bool = False
    mentor_categories: List[str] = []
    profile_image: Optional[str] = None
    social_links: Dict[str, str] = {}
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    username: str
    email: str
    full_name: str
    bio: Optional[str] = None
    role: UserRole = UserRole.STUDENT
    institution: Optional[str] = None
    specialization: List[str] = []
    skills: List[str] = []
    is_mentor: bool = False
    mentor_categories: List[str] = []

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    institution: Optional[str] = None
    specialization: Optional[List[str]] = None
    skills: Optional[List[str]] = None
    is_mentor: Optional[bool] = None
    mentor_categories: Optional[List[str]] = None
    social_links: Optional[Dict[str, str]] = None

class Invention(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    creator_id: str
    creator_name: str
    model_file_path: Optional[str] = None
    model_file_name: Optional[str] = None
    model_thumbnail: Optional[str] = None
    is_public: bool = False
    tags: List[str] = []
    category: Optional[str] = None
    difficulty_level: Optional[str] = None
    estimated_cost: Optional[str] = None
    development_stage: Optional[str] = None
    votes_up: int = 0
    votes_down: int = 0
    total_votes: int = 0
    average_rating: float = 0.0
    view_count: int = 0
    collaboration_open: bool = True
    seeking_mentorship: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class InventionCreate(BaseModel):
    title: str
    description: str
    creator_name: str
    is_public: bool = False
    tags: List[str] = []
    category: Optional[str] = None
    difficulty_level: Optional[str] = None
    estimated_cost: Optional[str] = None
    development_stage: Optional[str] = None
    collaboration_open: bool = True
    seeking_mentorship: bool = False

class InventionVote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invention_id: str
    user_id: str
    user_name: str
    vote_type: str  # "up" or "down"
    created_at: datetime = Field(default_factory=datetime.utcnow)

class InventionVoteCreate(BaseModel):
    invention_id: str
    user_name: str
    vote_type: str

class InventionRating(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invention_id: str
    user_id: str
    user_name: str
    rating: int  # 1-5 stars
    review_text: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class InventionRatingCreate(BaseModel):
    invention_id: str
    user_name: str
    rating: int
    review_text: Optional[str] = None

class PeerReview(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invention_id: str
    reviewer_id: str
    reviewer_name: str
    creator_id: str
    status: ReviewStatus = ReviewStatus.PENDING
    technical_score: Optional[int] = None  # 1-10
    innovation_score: Optional[int] = None  # 1-10
    feasibility_score: Optional[int] = None  # 1-10
    overall_score: Optional[float] = None
    strengths: Optional[str] = None
    weaknesses: Optional[str] = None
    suggestions: Optional[str] = None
    detailed_feedback: Optional[str] = None
    confidential_notes: Optional[str] = None
    review_deadline: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class PeerReviewCreate(BaseModel):
    invention_id: str
    reviewer_name: str

class PeerReviewUpdate(BaseModel):
    technical_score: Optional[int] = None
    innovation_score: Optional[int] = None
    feasibility_score: Optional[int] = None
    strengths: Optional[str] = None
    weaknesses: Optional[str] = None
    suggestions: Optional[str] = None
    detailed_feedback: Optional[str] = None

class MentorshipRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    student_name: str
    mentor_id: str
    mentor_name: str
    invention_id: Optional[str] = None
    subject: str
    message: str
    status: str = "pending"  # pending, accepted, rejected, completed
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class MentorshipRequestCreate(BaseModel):
    student_name: str
    mentor_name: str
    invention_id: Optional[str] = None
    subject: str
    message: str

class Comment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    invention_id: str
    user_id: str
    user_name: str
    content: str
    parent_comment_id: Optional[str] = None
    likes: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)

class CommentCreate(BaseModel):
    invention_id: str
    user_name: str
    content: str
    parent_comment_id: Optional[str] = None

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: NotificationType
    title: str
    message: str
    data: Dict[str, Any] = {}
    read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Group(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    invention_id: Optional[str] = None
    members: List[str] = []
    moderators: List[str] = []
    creator_id: str
    is_private: bool = False
    tags: List[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

class GroupCreate(BaseModel):
    name: str
    description: str
    invention_id: Optional[str] = None
    is_private: bool = False
    tags: List[str] = []

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
    votes: int = 0
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

# Helper functions
async def create_notification(user_id: str, notification_type: NotificationType, title: str, message: str, data: Dict = None):
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        message=message,
        data=data or {}
    )
    await db.notifications.insert_one(notification.dict())
    return notification

async def update_invention_rating(invention_id: str):
    """Recalculate invention rating based on all ratings"""
    ratings = await db.invention_ratings.find({"invention_id": invention_id}).to_list(1000)
    if ratings:
        total_rating = sum(rating["rating"] for rating in ratings)
        average_rating = total_rating / len(ratings)
        await db.inventions.update_one(
            {"id": invention_id},
            {"$set": {"average_rating": round(average_rating, 2)}}
        )

# API Routes
@api_router.get("/")
async def root():
    return {"message": "InventHub API - Collaborative Innovation Platform"}

# Enhanced User routes
@api_router.post("/users", response_model=User)
async def create_user(user: UserCreate):
    user_dict = user.dict()
    user_obj = User(**user_dict)
    await db.users.insert_one(user_obj.dict())
    return user_obj

@api_router.get("/users", response_model=List[User])
async def get_users(role: Optional[UserRole] = None, is_mentor: Optional[bool] = None):
    query = {}
    if role:
        query["role"] = role
    if is_mentor is not None:
        query["is_mentor"] = is_mentor
    
    users = await db.users.find(query).to_list(1000)
    return [User(**user) for user in users]

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user)

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(user_id: str, user_update: UserUpdate):
    update_data = {k: v for k, v in user_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    updated_user = await db.users.find_one({"id": user_id})
    return User(**updated_user)

@api_router.get("/users/{user_id}/mentors", response_model=List[User])
async def get_recommended_mentors(user_id: str):
    # Get user's specialization and skills for matching
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Find mentors with matching specializations
    query = {
        "is_mentor": True,
        "$or": [
            {"mentor_categories": {"$in": user.get("specialization", [])}},
            {"skills": {"$in": user.get("skills", [])}}
        ]
    }
    
    mentors = await db.users.find(query).to_list(100)
    return [User(**mentor) for mentor in mentors]

# Enhanced Invention routes
@api_router.post("/inventions", response_model=Invention)
async def create_invention(invention: InventionCreate):
    invention_dict = invention.dict()
    invention_dict["creator_id"] = "user_" + str(uuid.uuid4())[:8]
    invention_obj = Invention(**invention_dict)
    await db.inventions.insert_one(invention_obj.dict())
    return invention_obj

@api_router.get("/inventions", response_model=List[Invention])
async def get_inventions(
    category: Optional[str] = None,
    tags: Optional[str] = None,
    seeking_mentorship: Optional[bool] = None,
    collaboration_open: Optional[bool] = None,
    sort_by: Optional[str] = "created_at",
    limit: int = 100
):
    query = {}
    if category:
        query["category"] = category
    if tags:
        tag_list = [tag.strip() for tag in tags.split(",")]
        query["tags"] = {"$in": tag_list}
    if seeking_mentorship is not None:
        query["seeking_mentorship"] = seeking_mentorship
    if collaboration_open is not None:
        query["collaboration_open"] = collaboration_open
    
    sort_order = -1 if sort_by in ["created_at", "votes", "rating"] else 1
    inventions = await db.inventions.find(query).sort(sort_by, sort_order).limit(limit).to_list(limit)
    return [Invention(**invention) for invention in inventions]

@api_router.get("/inventions/search")
async def search_inventions(q: str = Query(..., min_length=2)):
    """Search inventions by title, description, tags, or creator name"""
    query = {
        "$or": [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"tags": {"$regex": q, "$options": "i"}},
            {"creator_name": {"$regex": q, "$options": "i"}}
        ]
    }
    
    inventions = await db.inventions.find(query).limit(50).to_list(50)
    return [Invention(**invention) for invention in inventions]

@api_router.get("/inventions/public", response_model=List[Invention])
async def get_public_inventions():
    inventions = await db.inventions.find({"is_public": True}).sort("created_at", -1).to_list(1000)
    return [Invention(**invention) for invention in inventions]

@api_router.get("/inventions/{invention_id}", response_model=Invention)
async def get_invention(invention_id: str):
    # Increment view count
    await db.inventions.update_one(
        {"id": invention_id},
        {"$inc": {"view_count": 1}}
    )
    
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
    max_size = 10 * 1024 * 1024 * 1024
    file_size = 0
    temp_file = uploads_dir / f"temp_{uuid.uuid4()}{file_extension}"
    
    try:
        async with aiofiles.open(temp_file, 'wb') as f:
            while chunk := await file.read(8192):
                file_size += len(chunk)
                if file_size > max_size:
                    temp_file.unlink()
                    raise HTTPException(status_code=413, detail="File too large. Maximum size is 10GB")
                await f.write(chunk)
        
        file_path = uploads_dir / f"{invention_id}_{file.filename}"
        temp_file.rename(file_path)
        
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

# Voting system
@api_router.post("/inventions/{invention_id}/vote", response_model=InventionVote)
async def vote_invention(invention_id: str, vote: InventionVoteCreate):
    # Check if user already voted
    existing_vote = await db.invention_votes.find_one({
        "invention_id": invention_id,
        "user_name": vote.user_name
    })
    
    if existing_vote:
        # Update existing vote
        await db.invention_votes.update_one(
            {"id": existing_vote["id"]},
            {"$set": {"vote_type": vote.vote_type}}
        )
        vote_obj = InventionVote(**{**existing_vote, "vote_type": vote.vote_type})
    else:
        # Create new vote
        vote_dict = vote.dict()
        vote_dict["user_id"] = "user_" + str(uuid.uuid4())[:8]
        vote_obj = InventionVote(**vote_dict)
        await db.invention_votes.insert_one(vote_obj.dict())
    
    # Update invention vote counts
    votes = await db.invention_votes.find({"invention_id": invention_id}).to_list(1000)
    votes_up = sum(1 for v in votes if v["vote_type"] == "up")
    votes_down = sum(1 for v in votes if v["vote_type"] == "down")
    
    await db.inventions.update_one(
        {"id": invention_id},
        {
            "$set": {
                "votes_up": votes_up,
                "votes_down": votes_down,
                "total_votes": len(votes)
            }
        }
    )
    
    return vote_obj

@api_router.get("/inventions/{invention_id}/votes")
async def get_invention_votes(invention_id: str):
    votes = await db.invention_votes.find({"invention_id": invention_id}).to_list(1000)
    return [InventionVote(**vote) for vote in votes]

# Rating system
@api_router.post("/inventions/{invention_id}/rate", response_model=InventionRating)
async def rate_invention(invention_id: str, rating: InventionRatingCreate):
    # Check if user already rated
    existing_rating = await db.invention_ratings.find_one({
        "invention_id": invention_id,
        "user_name": rating.user_name
    })
    
    if existing_rating:
        # Update existing rating
        update_data = rating.dict()
        await db.invention_ratings.update_one(
            {"id": existing_rating["id"]},
            {"$set": update_data}
        )
        rating_obj = InventionRating(**{**existing_rating, **update_data})
    else:
        # Create new rating
        rating_dict = rating.dict()
        rating_dict["user_id"] = "user_" + str(uuid.uuid4())[:8]
        rating_obj = InventionRating(**rating_dict)
        await db.invention_ratings.insert_one(rating_obj.dict())
    
    # Update average rating
    await update_invention_rating(invention_id)
    
    return rating_obj

@api_router.get("/inventions/{invention_id}/ratings")
async def get_invention_ratings(invention_id: str):
    ratings = await db.invention_ratings.find({"invention_id": invention_id}).to_list(1000)
    return [InventionRating(**rating) for rating in ratings]

# Peer Review System
@api_router.post("/peer-reviews", response_model=PeerReview)
async def create_peer_review(review: PeerReviewCreate):
    review_dict = review.dict()
    review_dict["reviewer_id"] = "user_" + str(uuid.uuid4())[:8]
    review_dict["creator_id"] = "user_" + str(uuid.uuid4())[:8]
    review_obj = PeerReview(**review_dict)
    await db.peer_reviews.insert_one(review_obj.dict())
    
    # Create notification for inventor
    invention = await db.inventions.find_one({"id": review.invention_id})
    if invention:
        await create_notification(
            invention["creator_id"],
            NotificationType.REVIEW,
            "New Peer Review Request",
            f"{review.reviewer_name} has requested to review your invention: {invention['title']}",
            {"invention_id": review.invention_id, "review_id": review_obj.id}
        )
    
    return review_obj

@api_router.get("/peer-reviews", response_model=List[PeerReview])
async def get_peer_reviews(invention_id: Optional[str] = None, reviewer_name: Optional[str] = None):
    query = {}
    if invention_id:
        query["invention_id"] = invention_id
    if reviewer_name:
        query["reviewer_name"] = reviewer_name
    
    reviews = await db.peer_reviews.find(query).to_list(1000)
    return [PeerReview(**review) for review in reviews]

@api_router.put("/peer-reviews/{review_id}", response_model=PeerReview)
async def update_peer_review(review_id: str, review_update: PeerReviewUpdate):
    update_data = {k: v for k, v in review_update.dict().items() if v is not None}
    
    # Calculate overall score if all scores provided
    if all(key in update_data for key in ["technical_score", "innovation_score", "feasibility_score"]):
        overall_score = (update_data["technical_score"] + update_data["innovation_score"] + update_data["feasibility_score"]) / 3
        update_data["overall_score"] = round(overall_score, 2)
        update_data["status"] = ReviewStatus.COMPLETED
        update_data["completed_at"] = datetime.utcnow()
    
    result = await db.peer_reviews.update_one(
        {"id": review_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    
    updated_review = await db.peer_reviews.find_one({"id": review_id})
    return PeerReview(**updated_review)

# Mentorship System
@api_router.post("/mentorship-requests", response_model=MentorshipRequest)
async def create_mentorship_request(request: MentorshipRequestCreate):
    request_dict = request.dict()
    request_dict["student_id"] = "user_" + str(uuid.uuid4())[:8]
    request_dict["mentor_id"] = "user_" + str(uuid.uuid4())[:8]
    request_obj = MentorshipRequest(**request_dict)
    await db.mentorship_requests.insert_one(request_obj.dict())
    
    # Create notification for mentor
    await create_notification(
        request_obj.mentor_id,
        NotificationType.MENTOR_REQUEST,
        "New Mentorship Request",
        f"{request.student_name} has requested mentorship: {request.subject}",
        {"request_id": request_obj.id}
    )
    
    return request_obj

@api_router.get("/mentorship-requests", response_model=List[MentorshipRequest])
async def get_mentorship_requests(student_name: Optional[str] = None, mentor_name: Optional[str] = None):
    query = {}
    if student_name:
        query["student_name"] = student_name
    if mentor_name:
        query["mentor_name"] = mentor_name
    
    requests = await db.mentorship_requests.find(query).to_list(1000)
    return [MentorshipRequest(**request) for request in requests]

@api_router.put("/mentorship-requests/{request_id}")
async def update_mentorship_request(request_id: str, status: str):
    result = await db.mentorship_requests.update_one(
        {"id": request_id},
        {"$set": {"status": status, "updated_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return {"message": "Request updated successfully"}

# Comments System
@api_router.post("/comments", response_model=Comment)
async def create_comment(comment: CommentCreate):
    comment_dict = comment.dict()
    comment_dict["user_id"] = "user_" + str(uuid.uuid4())[:8]
    comment_obj = Comment(**comment_dict)
    await db.comments.insert_one(comment_obj.dict())
    
    # Create notification for invention creator
    invention = await db.inventions.find_one({"id": comment.invention_id})
    if invention and invention["creator_id"] != comment_obj.user_id:
        await create_notification(
            invention["creator_id"],
            NotificationType.COMMENT,
            "New Comment on Your Invention",
            f"{comment.user_name} commented on {invention['title']}",
            {"invention_id": comment.invention_id, "comment_id": comment_obj.id}
        )
    
    return comment_obj

@api_router.get("/comments/{invention_id}", response_model=List[Comment])
async def get_comments(invention_id: str):
    comments = await db.comments.find({"invention_id": invention_id}).sort("created_at", 1).to_list(1000)
    return [Comment(**comment) for comment in comments]

# Notification System
@api_router.get("/notifications/{user_id}", response_model=List[Notification])
async def get_notifications(user_id: str, unread_only: bool = False):
    query = {"user_id": user_id}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(query).sort("created_at", -1).to_list(100)
    return [Notification(**notification) for notification in notifications]

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    result = await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

# Group routes (enhanced)
@api_router.post("/groups", response_model=Group)
async def create_group(group: GroupCreate):
    group_dict = group.dict()
    group_dict["creator_id"] = "user_" + str(uuid.uuid4())[:8]
    group_dict["moderators"] = [group_dict["creator_id"]]
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

@api_router.post("/groups/{group_id}/join")
async def join_group(group_id: str, user_name: str):
    result = await db.groups.update_one(
        {"id": group_id},
        {"$addToSet": {"members": user_name}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Group not found")
    
    return {"message": "Joined group successfully"}

# Chat routes
@api_router.post("/chat/messages", response_model=ChatMessage)
async def send_message(message: ChatMessageCreate):
    message_dict = message.dict()
    message_obj = ChatMessage(**message_dict)
    await db.chat_messages.insert_one(message_obj.dict())
    
    await manager.send_message_to_group(
        json.dumps(message_obj.dict(), default=str),
        message.group_id
    )
    
    return message_obj

@api_router.get("/chat/messages/{group_id}", response_model=List[ChatMessage])
async def get_messages(group_id: str):
    messages = await db.chat_messages.find({"group_id": group_id}).sort("timestamp", 1).to_list(1000)
    return [ChatMessage(**message) for message in messages]

# Enhanced suggestions routes
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

@api_router.post("/suggestions/{suggestion_id}/vote")
async def vote_suggestion(suggestion_id: str):
    result = await db.suggestions.update_one(
        {"id": suggestion_id},
        {"$inc": {"votes": 1}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    
    return {"message": "Vote recorded"}

# Analytics endpoints
@api_router.get("/analytics/summary")
async def get_analytics_summary():
    total_inventions = await db.inventions.count_documents({})
    total_users = await db.users.count_documents({})
    total_groups = await db.groups.count_documents({})
    total_reviews = await db.peer_reviews.count_documents({})
    
    # Top categories
    pipeline = [
        {"$unwind": "$tags"},
        {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]
    top_tags = await db.inventions.aggregate(pipeline).to_list(10)
    
    return {
        "total_inventions": total_inventions,
        "total_users": total_users,
        "total_groups": total_groups,
        "total_reviews": total_reviews,
        "top_tags": top_tags
    }

# WebSocket endpoint for real-time chat
@api_router.websocket("/ws/{group_id}")
async def websocket_endpoint(websocket: WebSocket, group_id: str):
    await manager.connect(websocket, group_id)
    try:
        while True:
            data = await websocket.receive_text()
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
