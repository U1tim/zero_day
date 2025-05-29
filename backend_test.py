import requests
import unittest
import json
import uuid
from datetime import datetime

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

    def test_api_root(self):
        """Test the API root endpoint"""
        return self.run_test("API Root", "GET", "", 200, print_response=True)

    def test_get_inventions(self):
        """Test getting all inventions"""
        return self.run_test("Get Inventions", "GET", "inventions", 200, print_response=True)

    def test_create_invention(self):
        """Test creating a new invention"""
        test_id = str(uuid.uuid4())[:8]
        data = {
            "title": f"Test Invention {test_id}",
            "description": "This is a test invention created by the API tester",
            "creator_name": "API Tester",
            "is_public": True,
            "tags": ["test", "api", "automation"]
        }
        success, response = self.run_test("Create Invention", "POST", "inventions", 200, data=data, print_response=True)
        if success:
            self.test_data["invention_id"] = response.get("id")
        return success, response

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

    def test_create_group(self):
        """Test creating a new group"""
        test_id = str(uuid.uuid4())[:8]
        data = {
            "name": f"Test Group {test_id}",
            "description": "This is a test group created by the API tester",
            "invention_id": self.test_data.get("invention_id", "")
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

    def test_create_suggestion(self):
        """Test creating a new suggestion"""
        test_id = str(uuid.uuid4())[:8]
        data = {
            "title": f"Test Suggestion {test_id}",
            "description": "This is a test suggestion created by the API tester",
            "technology_area": "AI/Machine Learning",
            "suggested_by": "API Tester",
            "inspiration_source": "Automated Testing"
        }
        success, response = self.run_test("Create Suggestion", "POST", "suggestions", 200, data=data, print_response=True)
        if success:
            self.test_data["suggestion_id"] = response.get("id")
        return success, response

    def test_get_suggestions(self):
        """Test getting all suggestions"""
        return self.run_test("Get Suggestions", "GET", "suggestions", 200, print_response=True)

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting InventHub API Tests...")
        
        # Basic connectivity test
        self.test_api_root()
        
        # Invention tests
        self.test_get_inventions()
        self.test_create_invention()
        self.test_get_invention_by_id()
        self.test_get_public_inventions()
        
        # Group tests
        self.test_get_groups()
        self.test_create_group()
        self.test_get_group_by_id()
        
        # Suggestion tests
        self.test_get_suggestions()
        self.test_create_suggestion()
        
        # Print results
        print(f"\n📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        return self.tests_passed == self.tests_run

if __name__ == "__main__":
    tester = InventHubAPITester()
    tester.run_all_tests()