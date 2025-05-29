import requests
import unittest
import json
import uuid
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    STUDENT = "student"
    RESEARCHER = "researcher"
    MENTOR = "mentor"
    INDUSTRY = "industry"

class ReviewStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REJECTED = "rejected"

class InventHubAPITester:
    def __init__(self, base_url="https://065f6081-1b16-4fab-a30e-a944b0b2062f.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_data = {}

    def run_test(self, name, method, endpoint, expected_status, data=None, print_response=False):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                if print_response and response.text:
                    try:
                        print(f"Response: {json.dumps(response.json(), indent=2)}")
                    except:
                        print(f"Response: {response.text}")
                return True, response.json() if response.text else {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                if response.text:
                    try:
                        print(f"Error: {json.dumps(response.json(), indent=2)}")
                    except:
                        print(f"Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    # API Root Test
    def test_api_root(self):
        """Test the API root endpoint"""
        return self.run_test("API Root", "GET", "", 200, print_response=True)

    # User Management Tests
    def test_create_user(self, role=UserRole.STUDENT, is_mentor=False):
        """Test creating a new user"""
        test_id = str(uuid.uuid4())[:8]
        name = "Dr. Sarah Chen" if role == UserRole.RESEARCHER and is_mentor else f"Test User {test_id}"
        
        data = {
            "username": f"user_{test_id}",
            "email": f"user_{test_id}@example.com",
            "full_name": name,
            "bio": f"This is a test user with role {role}",
            "role": role,
            "institution": "MIT" if role == UserRole.RESEARCHER else "Stanford University",
            "specialization": ["AI", "Machine Learning"] if role == UserRole.RESEARCHER else ["Computer Science"],
            "skills": ["Python", "Data Science"] if role == UserRole.RESEARCHER else ["Programming"],
            "is_mentor": is_mentor,
            "mentor_categories": ["AI Research", "Data Science"] if is_mentor else []
        }
        
        success, response = self.run_test(f"Create {role} User", "POST", "users", 200, data=data, print_response=True)
        if success:
            if role == UserRole.RESEARCHER and is_mentor:
                self.test_data["mentor_id"] = response.get("id")
                self.test_data["mentor_name"] = name
            elif role == UserRole.STUDENT:
                self.test_data["student_id"] = response.get("id")
                self.test_data["student_name"] = name
            else:
                self.test_data["user_id"] = response.get("id")
                self.test_data["user_name"] = name
        return success, response

    def test_get_users(self):
        """Test getting all users"""
        return self.run_test("Get All Users", "GET", "users", 200, print_response=True)

    def test_get_mentors(self):
        """Test getting mentors"""
        return self.run_test("Get Mentors", "GET", "users?is_mentor=true", 200, print_response=True)

    def test_get_user_by_id(self, user_id_key="user_id"):
        """Test getting a specific user by ID"""
        if user_id_key not in self.test_data:
            print(f"❌ Skipping test_get_user_by_id - No {user_id_key} available")
            return False, {}
        
        return self.run_test(
            "Get User by ID", 
            "GET", 
            f"users/{self.test_data[user_id_key]}", 
            200,
            print_response=True
        )

    # Enhanced Invention Tests
    def test_create_enhanced_invention(self):
        """Test creating a new invention with enhanced fields"""
        test_id = str(uuid.uuid4())[:8]
        data = {
            "title": f"Smart IoT Garden Monitor {test_id}",
            "description": "An IoT device that monitors soil moisture, sunlight, and temperature for optimal plant growth",
            "creator_name": self.test_data.get("user_name", "API Tester"),
            "is_public": True,
            "tags": ["IoT", "gardening", "smart home", "sustainability"],
            "category": "Smart Home",
            "difficulty_level": "Intermediate",
            "estimated_cost": "$50-100",
            "development_stage": "Prototype",
            "collaboration_open": True,
            "seeking_mentorship": True
        }
        success, response = self.run_test("Create Enhanced Invention", "POST", "inventions", 200, data=data, print_response=True)
        if success:
            self.test_data["invention_id"] = response.get("id")
        return success, response

    def test_get_inventions(self):
        """Test getting all inventions"""
        return self.run_test("Get Inventions", "GET", "inventions", 200, print_response=True)

    def test_get_invention_by_id(self):
        """Test getting a specific invention by ID"""
        if "invention_id" not in self.test_data:
            print("❌ Skipping test_get_invention_by_id - No invention ID available")
            return False, {}
        
        return self.run_test(
            "Get Invention by ID", 
            "GET", 
            f"inventions/{self.test_data['invention_id']}", 
            200,
            print_response=True
        )

    def test_get_public_inventions(self):
        """Test getting public inventions"""
        return self.run_test("Get Public Inventions", "GET", "inventions/public", 200, print_response=True)

    def test_get_inventions_with_filters(self):
        """Test getting inventions with filters"""
        return self.run_test(
            "Get Inventions with Filters", 
            "GET", 
            "inventions?seeking_mentorship=true&category=Smart%20Home", 
            200, 
            print_response=True
        )

    def test_search_inventions(self):
        """Test searching inventions"""
        return self.run_test(
            "Search Inventions", 
            "GET", 
            "inventions/search?q=garden", 
            200, 
            print_response=True
        )

    # Voting System Tests
    def test_vote_invention(self, vote_type="up"):
        """Test voting on an invention"""
        if "invention_id" not in self.test_data:
            print("❌ Skipping test_vote_invention - No invention ID available")
            return False, {}
        
        data = {
            "invention_id": self.test_data["invention_id"],
            "user_name": self.test_data.get("user_name", "API Tester"),
            "vote_type": vote_type
        }
        
        return self.run_test(
            f"Vote {vote_type.capitalize()} on Invention", 
            "POST", 
            f"inventions/{self.test_data['invention_id']}/vote", 
            200, 
            data=data,
            print_response=True
        )

    def test_get_invention_votes(self):
        """Test getting votes for an invention"""
        if "invention_id" not in self.test_data:
            print("❌ Skipping test_get_invention_votes - No invention ID available")
            return False, {}
        
        return self.run_test(
            "Get Invention Votes", 
            "GET", 
            f"inventions/{self.test_data['invention_id']}/votes", 
            200,
            print_response=True
        )

    # Rating System Tests
    def test_rate_invention(self, rating=5, review_text="Excellent invention with great potential!"):
        """Test rating an invention"""
        if "invention_id" not in self.test_data:
            print("❌ Skipping test_rate_invention - No invention ID available")
            return False, {}
        
        data = {
            "invention_id": self.test_data["invention_id"],
            "user_name": self.test_data.get("user_name", "API Tester"),
            "rating": rating,
            "review_text": review_text
        }
        
        return self.run_test(
            f"Rate Invention ({rating} stars)", 
            "POST", 
            f"inventions/{self.test_data['invention_id']}/rate", 
            200, 
            data=data,
            print_response=True
        )

    def test_get_invention_ratings(self):
        """Test getting ratings for an invention"""
        if "invention_id" not in self.test_data:
            print("❌ Skipping test_get_invention_ratings - No invention ID available")
            return False, {}
        
        return self.run_test(
            "Get Invention Ratings", 
            "GET", 
            f"inventions/{self.test_data['invention_id']}/ratings", 
            200,
            print_response=True
        )

    # Peer Review System Tests
    def test_create_peer_review(self):
        """Test creating a peer review request"""
        if "invention_id" not in self.test_data:
            print("❌ Skipping test_create_peer_review - No invention ID available")
            return False, {}
        
        data = {
            "invention_id": self.test_data["invention_id"],
            "reviewer_name": self.test_data.get("mentor_name", "Dr. Expert Reviewer")
        }
        
        success, response = self.run_test(
            "Create Peer Review Request", 
            "POST", 
            "peer-reviews", 
            200, 
            data=data,
            print_response=True
        )
        
        if success:
            self.test_data["review_id"] = response.get("id")
        
        return success, response

    def test_submit_peer_review(self):
        """Test submitting a peer review"""
        if "review_id" not in self.test_data:
            print("❌ Skipping test_submit_peer_review - No review ID available")
            return False, {}
        
        data = {
            "technical_score": 8,
            "innovation_score": 9,
            "feasibility_score": 7,
            "strengths": "Innovative approach to a common problem. Good use of IoT technology.",
            "weaknesses": "Power consumption might be an issue for long-term deployment.",
            "suggestions": "Consider adding solar power capabilities.",
            "detailed_feedback": "This is a well-thought-out invention with practical applications. The technical implementation is solid, and the innovation factor is high. Consider addressing the power consumption issue for better real-world deployment."
        }
        
        return self.run_test(
            "Submit Peer Review", 
            "PUT", 
            f"peer-reviews/{self.test_data['review_id']}", 
            200, 
            data=data,
            print_response=True
        )

    def test_get_peer_reviews(self):
        """Test getting peer reviews"""
        if "invention_id" not in self.test_data:
            print("❌ Skipping test_get_peer_reviews - No invention ID available")
            return False, {}
        
        return self.run_test(
            "Get Peer Reviews", 
            "GET", 
            f"peer-reviews?invention_id={self.test_data['invention_id']}", 
            200,
            print_response=True
        )

    # Mentorship System Tests
    def test_create_mentorship_request(self):
        """Test creating a mentorship request"""
        if "invention_id" not in self.test_data or "mentor_name" not in self.test_data:
            print("❌ Skipping test_create_mentorship_request - Missing required data")
            return False, {}
        
        data = {
            "student_name": self.test_data.get("student_name", "Student Tester"),
            "mentor_name": self.test_data["mentor_name"],
            "invention_id": self.test_data["invention_id"],
            "subject": "Seeking guidance on IoT implementation",
            "message": "I would appreciate your expertise on optimizing the sensor array for my Smart IoT Garden Monitor."
        }
        
        success, response = self.run_test(
            "Create Mentorship Request", 
            "POST", 
            "mentorship-requests", 
            200, 
            data=data,
            print_response=True
        )
        
        if success:
            self.test_data["mentorship_request_id"] = response.get("id")
        
        return success, response

    def test_get_mentorship_requests(self):
        """Test getting mentorship requests"""
        if "mentor_name" not in self.test_data:
            print("❌ Skipping test_get_mentorship_requests - No mentor name available")
            return False, {}
        
        return self.run_test(
            "Get Mentorship Requests", 
            "GET", 
            f"mentorship-requests?mentor_name={self.test_data['mentor_name']}", 
            200,
            print_response=True
        )

    # Comments System Tests
    def test_create_comment(self):
        """Test creating a comment on an invention"""
        if "invention_id" not in self.test_data:
            print("❌ Skipping test_create_comment - No invention ID available")
            return False, {}
        
        data = {
            "invention_id": self.test_data["invention_id"],
            "user_name": self.test_data.get("user_name", "API Tester"),
            "content": "This is a fantastic invention! I especially like the sustainability aspect."
        }
        
        success, response = self.run_test(
            "Create Comment", 
            "POST", 
            "comments", 
            200, 
            data=data,
            print_response=True
        )
        
        if success:
            self.test_data["comment_id"] = response.get("id")
        
        return success, response

    def test_get_comments(self):
        """Test getting comments for an invention"""
        if "invention_id" not in self.test_data:
            print("❌ Skipping test_get_comments - No invention ID available")
            return False, {}
        
        return self.run_test(
            "Get Comments", 
            "GET", 
            f"comments/{self.test_data['invention_id']}", 
            200,
            print_response=True
        )

    # Group Tests
    def test_create_group(self):
        """Test creating a new group"""
        test_id = str(uuid.uuid4())[:8]
        data = {
            "name": f"IoT Innovators {test_id}",
            "description": "A group for IoT enthusiasts and inventors",
            "invention_id": self.test_data.get("invention_id", ""),
            "is_private": False,
            "tags": ["IoT", "innovation", "collaboration"]
        }
        success, response = self.run_test("Create Group", "POST", "groups", 200, data=data, print_response=True)
        if success:
            self.test_data["group_id"] = response.get("id")
        return success, response

    def test_get_groups(self):
        """Test getting all groups"""
        return self.run_test("Get Groups", "GET", "groups", 200, print_response=True)

    def test_get_group_by_id(self):
        """Test getting a specific group by ID"""
        if "group_id" not in self.test_data:
            print("❌ Skipping test_get_group_by_id - No group ID available")
            return False, {}
        
        return self.run_test(
            "Get Group by ID", 
            "GET", 
            f"groups/{self.test_data['group_id']}", 
            200,
            print_response=True
        )

    # Suggestion Tests
    def test_create_suggestion(self):
        """Test creating a new suggestion"""
        test_id = str(uuid.uuid4())[:8]
        data = {
            "title": f"Renewable Energy Storage Solution {test_id}",
            "description": "A new approach to storing renewable energy using advanced materials",
            "technology_area": "Energy/Sustainability",
            "suggested_by": self.test_data.get("user_name", "API Tester"),
            "inspiration_source": "Climate change research"
        }
        success, response = self.run_test("Create Suggestion", "POST", "suggestions", 200, data=data, print_response=True)
        if success:
            self.test_data["suggestion_id"] = response.get("id")
        return success, response

    def test_get_suggestions(self):
        """Test getting all suggestions"""
        return self.run_test("Get Suggestions", "GET", "suggestions", 200, print_response=True)

    def test_vote_suggestion(self):
        """Test voting on a suggestion"""
        if "suggestion_id" not in self.test_data:
            print("❌ Skipping test_vote_suggestion - No suggestion ID available")
            return False, {}
        
        return self.run_test(
            "Vote on Suggestion", 
            "POST", 
            f"suggestions/{self.test_data['suggestion_id']}/vote", 
            200,
            print_response=True
        )

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting InventHub API Tests...")
        
        # Basic connectivity test
        self.test_api_root()
        
        # User Management Tests
        print("\n📋 Testing User Management...")
        self.test_create_user(role=UserRole.RESEARCHER, is_mentor=True)  # Create Dr. Sarah Chen
        self.test_create_user(role=UserRole.STUDENT)  # Create a student user
        self.test_get_users()
        self.test_get_mentors()
        self.test_get_user_by_id("mentor_id")
        
        # Enhanced Invention Tests
        print("\n📋 Testing Enhanced Inventions...")
        self.test_create_enhanced_invention()
        self.test_get_inventions()
        self.test_get_invention_by_id()
        self.test_get_public_inventions()
        self.test_get_inventions_with_filters()
        self.test_search_inventions()
        
        # Voting System Tests
        print("\n📋 Testing Voting System...")
        self.test_vote_invention("up")
        self.test_vote_invention("down")
        self.test_get_invention_votes()
        
        # Rating System Tests
        print("\n📋 Testing Rating System...")
        self.test_rate_invention(5, "Excellent invention with great potential!")
        self.test_get_invention_ratings()
        
        # Peer Review System Tests
        print("\n📋 Testing Peer Review System...")
        self.test_create_peer_review()
        self.test_submit_peer_review()
        self.test_get_peer_reviews()
        
        # Mentorship System Tests
        print("\n📋 Testing Mentorship System...")
        self.test_create_mentorship_request()
        self.test_get_mentorship_requests()
        
        # Comments System Tests
        print("\n📋 Testing Comments System...")
        self.test_create_comment()
        self.test_get_comments()
        
        # Group Tests
        print("\n📋 Testing Groups...")
        self.test_create_group()
        self.test_get_groups()
        self.test_get_group_by_id()
        
        # Suggestion Tests
        print("\n📋 Testing Suggestions...")
        self.test_create_suggestion()
        self.test_get_suggestions()
        self.test_vote_suggestion()
        
        # Print results
        print(f"\n📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = InventHubAPITester()
    tester.run_all_tests()