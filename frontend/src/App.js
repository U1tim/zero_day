import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, useGLTF } from '@react-three/drei';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// 3D Model Viewer Component
const ModelViewer = ({ modelPath }) => {
  const { scene } = useGLTF(modelPath);
  return <primitive object={scene} scale={[1, 1, 1]} />;
};

// File Upload Component
const ModelUploader = ({ inventionId, onUploadSuccess }) => {
  const [uploading, setUploading] = useState(false);
  
  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    const formData = new FormData();
    formData.append('file', file);
    
    setUploading(true);
    try {
      await axios.post(`${API}/inventions/${inventionId}/upload-model`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onUploadSuccess();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed: ' + (error.response?.data?.detail || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'model/gltf-binary': ['.glb'],
      'model/gltf+json': ['.gltf'],
      'application/octet-stream': ['.obj', '.fbx', '.stl']
    },
    maxSize: 10 * 1024 * 1024 * 1024
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
      }`}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <div className="text-blue-600">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          Uploading model...
        </div>
      ) : (
        <div>
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p className="text-gray-600">
            {isDragActive ? 'Drop the 3D model here...' : 'Drag & drop a 3D model, or click to select'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Supports GLB, GLTF, OBJ, FBX, STL (max 10GB)
          </p>
        </div>
      )}
    </div>
  );
};

// Star Rating Component
const StarRating = ({ rating, onRatingChange, readOnly = false }) => {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex items-center space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          className={`text-2xl ${
            star <= (hoverRating || rating) ? 'text-yellow-400' : 'text-gray-300'
          } ${!readOnly ? 'hover:text-yellow-400 cursor-pointer' : 'cursor-default'}`}
          onMouseEnter={() => !readOnly && setHoverRating(star)}
          onMouseLeave={() => !readOnly && setHoverRating(0)}
          onClick={() => !readOnly && onRatingChange && onRatingChange(star)}
        >
          ★
        </button>
      ))}
      {rating > 0 && <span className="text-sm text-gray-600 ml-2">({rating}/5)</span>}
    </div>
  );
};

// Vote Component
const VoteComponent = ({ invention, onVote }) => {
  const [userVote, setUserVote] = useState(null);

  const handleVote = async (voteType) => {
    try {
      await axios.post(`${API}/inventions/${invention.id}/vote`, {
        invention_id: invention.id,
        user_name: "Current User", // In real app, get from auth
        vote_type: voteType
      });
      setUserVote(voteType);
      onVote();
    } catch (error) {
      console.error('Vote failed:', error);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-2">
      <button
        onClick={() => handleVote('up')}
        className={`p-2 rounded-full transition-colors ${
          userVote === 'up' ? 'bg-green-100 text-green-600' : 'hover:bg-gray-100'
        }`}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
      </button>
      <span className="text-sm font-medium">{invention.votes_up - invention.votes_down}</span>
      <button
        onClick={() => handleVote('down')}
        className={`p-2 rounded-full transition-colors ${
          userVote === 'down' ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100'
        }`}
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
};

// Comment Component
const CommentSection = ({ inventionId }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  const loadComments = async () => {
    try {
      const response = await axios.get(`${API}/comments/${inventionId}`);
      setComments(response.data);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      await axios.post(`${API}/comments`, {
        invention_id: inventionId,
        user_name: "Current User",
        content: newComment
      });
      setNewComment('');
      loadComments();
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [inventionId]);

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold">Comments</h4>
      
      <form onSubmit={handleAddComment} className="space-y-3">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your thoughts, suggestions, or questions..."
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          rows="3"
        />
        <button
          type="submit"
          disabled={loading || !newComment.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Posting...' : 'Post Comment'}
        </button>
      </form>

      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">{comment.user_name}</span>
              <span className="text-sm text-gray-500">
                {new Date(comment.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-gray-700">{comment.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Peer Review Component
const PeerReviewForm = ({ inventionId, onSubmit }) => {
  const [review, setReview] = useState({
    technical_score: 0,
    innovation_score: 0,
    feasibility_score: 0,
    strengths: '',
    weaknesses: '',
    suggestions: '',
    detailed_feedback: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Create review request first
      const response = await axios.post(`${API}/peer-reviews`, {
        invention_id: inventionId,
        reviewer_name: "Current User"
      });
      
      // Update with detailed review
      await axios.put(`${API}/peer-reviews/${response.data.id}`, review);
      onSubmit();
    } catch (error) {
      console.error('Failed to submit review:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h3 className="text-xl font-semibold">Peer Review</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Technical Quality (1-10)</label>
          <input
            type="number"
            min="1"
            max="10"
            value={review.technical_score}
            onChange={(e) => setReview({...review, technical_score: parseInt(e.target.value)})}
            className="w-full p-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Innovation (1-10)</label>
          <input
            type="number"
            min="1"
            max="10"
            value={review.innovation_score}
            onChange={(e) => setReview({...review, innovation_score: parseInt(e.target.value)})}
            className="w-full p-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Feasibility (1-10)</label>
          <input
            type="number"
            min="1"
            max="10"
            value={review.feasibility_score}
            onChange={(e) => setReview({...review, feasibility_score: parseInt(e.target.value)})}
            className="w-full p-2 border border-gray-300 rounded-lg"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Strengths</label>
        <textarea
          value={review.strengths}
          onChange={(e) => setReview({...review, strengths: e.target.value})}
          className="w-full p-3 border border-gray-300 rounded-lg"
          rows="3"
          placeholder="What are the key strengths of this invention?"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Areas for Improvement</label>
        <textarea
          value={review.weaknesses}
          onChange={(e) => setReview({...review, weaknesses: e.target.value})}
          className="w-full p-3 border border-gray-300 rounded-lg"
          rows="3"
          placeholder="What could be improved?"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Suggestions</label>
        <textarea
          value={review.suggestions}
          onChange={(e) => setReview({...review, suggestions: e.target.value})}
          className="w-full p-3 border border-gray-300 rounded-lg"
          rows="3"
          placeholder="Your recommendations for enhancement"
        />
      </div>

      <button
        type="submit"
        className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700"
      >
        Submit Review
      </button>
    </form>
  );
};

// Enhanced Invention Card Component
const InventionCard = ({ invention, onClick, onVote }) => (
  <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
    <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 cursor-pointer" onClick={() => onClick(invention)}>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{invention.title}</h3>
          {invention.is_public && (
            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Public</span>
          )}
        </div>
        <VoteComponent invention={invention} onVote={onVote} />
      </div>
      
      <div className="cursor-pointer" onClick={() => onClick(invention)}>
        <p className="text-gray-600 mb-4 line-clamp-3">{invention.description}</p>
        
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500">by {invention.creator_name}</span>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">👁 {invention.view_count}</span>
            {invention.average_rating > 0 && (
              <StarRating rating={invention.average_rating} readOnly />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          {invention.model_file_path && (
            <div className="flex items-center text-blue-600 text-sm">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
              3D Model
            </div>
          )}
          <div className="flex items-center space-x-2">
            {invention.collaboration_open && (
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">Open to Collaborate</span>
            )}
            {invention.seeking_mentorship && (
              <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">Seeking Mentor</span>
            )}
          </div>
        </div>

        {invention.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {invention.tags.map((tag, index) => (
              <span key={index} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

// User Profile Card
const UserProfileCard = ({ user, onMentorRequest }) => (
  <div className="bg-white rounded-lg shadow-md p-6">
    <div className="flex items-center space-x-4 mb-4">
      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
        <span className="text-white font-semibold">{user.full_name?.[0] || user.username[0]}</span>
      </div>
      <div>
        <h3 className="font-semibold text-gray-900">{user.full_name || user.username}</h3>
        <p className="text-sm text-gray-600">{user.role}</p>
        {user.institution && <p className="text-xs text-gray-500">{user.institution}</p>}
      </div>
    </div>
    
    {user.bio && <p className="text-gray-700 mb-4">{user.bio}</p>}
    
    {user.skills.length > 0 && (
      <div className="mb-4">
        <h4 className="text-sm font-medium mb-2">Skills</h4>
        <div className="flex flex-wrap gap-1">
          {user.skills.map((skill, index) => (
            <span key={index} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
              {skill}
            </span>
          ))}
        </div>
      </div>
    )}
    
    {user.is_mentor && (
      <button
        onClick={() => onMentorRequest(user)}
        className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700"
      >
        Request Mentorship
      </button>
    )}
  </div>
);

// Search and Filter Component
const SearchAndFilter = ({ onSearch, onFilter }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    tags: '',
    seeking_mentorship: null,
    collaboration_open: null,
    sort_by: 'created_at'
  });

  const handleSearch = (e) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilter(newFilters);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex space-x-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search inventions, creators, tags..."
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            Search
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <select
          value={filters.category}
          onChange={(e) => handleFilterChange('category', e.target.value)}
          className="p-2 border border-gray-300 rounded-lg"
        >
          <option value="">All Categories</option>
          <option value="IoT">IoT</option>
          <option value="AI">AI/ML</option>
          <option value="Healthcare">Healthcare</option>
          <option value="Sustainability">Sustainability</option>
          <option value="Robotics">Robotics</option>
        </select>

        <select
          value={filters.seeking_mentorship === null ? '' : filters.seeking_mentorship.toString()}
          onChange={(e) => handleFilterChange('seeking_mentorship', e.target.value === '' ? null : e.target.value === 'true')}
          className="p-2 border border-gray-300 rounded-lg"
        >
          <option value="">Mentorship Status</option>
          <option value="true">Seeking Mentorship</option>
          <option value="false">Not Seeking</option>
        </select>

        <select
          value={filters.collaboration_open === null ? '' : filters.collaboration_open.toString()}
          onChange={(e) => handleFilterChange('collaboration_open', e.target.value === '' ? null : e.target.value === 'true')}
          className="p-2 border border-gray-300 rounded-lg"
        >
          <option value="">Collaboration</option>
          <option value="true">Open to Collaborate</option>
          <option value="false">Not Open</option>
        </select>

        <input
          type="text"
          value={filters.tags}
          onChange={(e) => handleFilterChange('tags', e.target.value)}
          placeholder="Filter by tags..."
          className="p-2 border border-gray-300 rounded-lg"
        />

        <select
          value={filters.sort_by}
          onChange={(e) => handleFilterChange('sort_by', e.target.value)}
          className="p-2 border border-gray-300 rounded-lg"
        >
          <option value="created_at">Newest</option>
          <option value="votes_up">Most Voted</option>
          <option value="average_rating">Highest Rated</option>
          <option value="view_count">Most Viewed</option>
        </select>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [currentView, setCurrentView] = useState('home');
  const [inventions, setInventions] = useState([]);
  const [filteredInventions, setFilteredInventions] = useState([]);
  const [selectedInvention, setSelectedInvention] = useState(null);
  const [groups, setGroups] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [users, setUsers] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  // Form states
  const [newInvention, setNewInvention] = useState({
    title: '',
    description: '',
    creator_name: '',
    is_public: false,
    tags: [],
    category: '',
    difficulty_level: '',
    estimated_cost: '',
    development_stage: '',
    collaboration_open: true,
    seeking_mentorship: false
  });
  
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    invention_id: '',
    is_private: false,
    tags: []
  });

  const [newSuggestion, setNewSuggestion] = useState({
    title: '',
    description: '',
    technology_area: '',
    suggested_by: '',
    inspiration_source: ''
  });

  const [mentorshipRequest, setMentorshipRequest] = useState({
    student_name: '',
    mentor_name: '',
    invention_id: '',
    subject: '',
    message: ''
  });

  // Load data functions
  const loadInventions = async (params = {}) => {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== '') {
          queryParams.append(key, value);
        }
      });
      
      const response = await axios.get(`${API}/inventions?${queryParams}`);
      setInventions(response.data);
      setFilteredInventions(response.data);
    } catch (error) {
      console.error('Failed to load inventions:', error);
    }
  };

  const searchInventions = async (query) => {
    if (!query.trim()) {
      setFilteredInventions(inventions);
      return;
    }
    
    try {
      const response = await axios.get(`${API}/inventions/search?q=${encodeURIComponent(query)}`);
      setFilteredInventions(response.data);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const filterInventions = (filters) => {
    loadInventions(filters);
  };

  const loadGroups = async () => {
    try {
      const response = await axios.get(`${API}/groups`);
      setGroups(response.data);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  };

  const loadSuggestions = async () => {
    try {
      const response = await axios.get(`${API}/suggestions`);
      setSuggestions(response.data);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadMentors = async () => {
    try {
      const response = await axios.get(`${API}/users?is_mentor=true`);
      setMentors(response.data);
    } catch (error) {
      console.error('Failed to load mentors:', error);
    }
  };

  useEffect(() => {
    loadInventions();
    loadGroups();
    loadSuggestions();
    loadUsers();
    loadMentors();
  }, []);

  // Create functions
  const handleCreateInvention = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/inventions`, newInvention);
      setInventions([response.data, ...inventions]);
      setNewInvention({
        title: '', description: '', creator_name: '', is_public: false, tags: [],
        category: '', difficulty_level: '', estimated_cost: '', development_stage: '',
        collaboration_open: true, seeking_mentorship: false
      });
      setCurrentView('home');
    } catch (error) {
      console.error('Failed to create invention:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/groups`, newGroup);
      setGroups([response.data, ...groups]);
      setNewGroup({ name: '', description: '', invention_id: '', is_private: false, tags: [] });
      setCurrentView('collaborate');
    } catch (error) {
      console.error('Failed to create group:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuggestion = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/suggestions`, newSuggestion);
      setSuggestions([response.data, ...suggestions]);
      setNewSuggestion({ title: '', description: '', technology_area: '', suggested_by: '', inspiration_source: '' });
      setCurrentView('inspire');
    } catch (error) {
      console.error('Failed to create suggestion:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMentorshipRequest = async (mentor) => {
    setMentorshipRequest({
      ...mentorshipRequest,
      mentor_name: mentor.username,
      student_name: "Current User"
    });
    setCurrentView('request-mentorship');
  };

  const submitMentorshipRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/mentorship-requests`, mentorshipRequest);
      alert('Mentorship request sent successfully!');
      setMentorshipRequest({ student_name: '', mentor_name: '', invention_id: '', subject: '', message: '' });
      setCurrentView('mentors');
    } catch (error) {
      console.error('Failed to send mentorship request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRateInvention = async (inventionId, rating, reviewText) => {
    try {
      await axios.post(`${API}/inventions/${inventionId}/rate`, {
        invention_id: inventionId,
        user_name: "Current User",
        rating: rating,
        review_text: reviewText
      });
      loadInventions(); // Reload to get updated ratings
    } catch (error) {
      console.error('Failed to rate invention:', error);
    }
  };

  // Navigation Component
  const Navigation = () => (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-blue-600">InventHub</h1>
          </div>
          <div className="flex space-x-8 items-center">
            <button
              onClick={() => setCurrentView('home')}
              className={`px-3 py-2 text-sm font-medium ${currentView === 'home' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Inventions
            </button>
            <button
              onClick={() => setCurrentView('collaborate')}
              className={`px-3 py-2 text-sm font-medium ${currentView === 'collaborate' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Collaborate
            </button>
            <button
              onClick={() => setCurrentView('inspire')}
              className={`px-3 py-2 text-sm font-medium ${currentView === 'inspire' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Get Inspired
            </button>
            <button
              onClick={() => setCurrentView('mentors')}
              className={`px-3 py-2 text-sm font-medium ${currentView === 'mentors' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Find Mentors
            </button>
          </div>
        </div>
      </div>
    </nav>
  );

  // Home View - Enhanced Inventions
  const HomeView = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-8 mb-8 text-white">
        <div className="absolute inset-0 rounded-xl overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1611162618071-b39a2ec055fb" 
            alt="3D Innovation" 
            className="w-full h-full object-cover opacity-20"
          />
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-4">Welcome to InventHub</h2>
          <p className="text-xl mb-6">Collaborate, Vote, Review, and Innovate with 3D Models</p>
          <div className="flex space-x-4">
            <button
              onClick={() => setCurrentView('create')}
              className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Share Your Invention
            </button>
            <button
              onClick={() => setCurrentView('mentors')}
              className="bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-800 transition-colors"
            >
              Find a Mentor
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <SearchAndFilter onSearch={searchInventions} onFilter={filterInventions} />

      {/* Inventions Grid */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-2xl font-bold text-gray-900">Recent Inventions</h3>
        <button
          onClick={() => setCurrentView('create')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Invention
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredInventions.map((invention) => (
          <InventionCard
            key={invention.id}
            invention={invention}
            onClick={setSelectedInvention}
            onVote={loadInventions}
          />
        ))}
      </div>
    </div>
  );

  // Enhanced Create Invention View
  const CreateView = () => (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Share Your Invention</h2>
      
      <form onSubmit={handleCreateInvention} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Invention Title</label>
          <input
            type="text"
            value={newInvention.title}
            onChange={(e) => setNewInvention({ ...newInvention, title: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Smart Water Purification Device"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={newInvention.description}
            onChange={(e) => setNewInvention({ ...newInvention, description: e.target.value })}
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe your invention, its purpose, and how it works..."
            required
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
            <input
              type="text"
              value={newInvention.creator_name}
              onChange={(e) => setNewInvention({ ...newInvention, creator_name: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Your name or research team"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={newInvention.category}
              onChange={(e) => setNewInvention({ ...newInvention, category: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select category...</option>
              <option value="IoT">IoT & Hardware</option>
              <option value="AI">AI & Machine Learning</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Sustainability">Sustainability</option>
              <option value="Robotics">Robotics</option>
              <option value="Materials">Materials Science</option>
              <option value="Energy">Energy & Power</option>
              <option value="Transportation">Transportation</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty Level</label>
            <select
              value={newInvention.difficulty_level}
              onChange={(e) => setNewInvention({ ...newInvention, difficulty_level: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select difficulty...</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
              <option value="Expert">Expert</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Cost</label>
            <select
              value={newInvention.estimated_cost}
              onChange={(e) => setNewInvention({ ...newInvention, estimated_cost: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select cost range...</option>
              <option value="Under $100">Under $100</option>
              <option value="$100-$500">$100-$500</option>
              <option value="$500-$1000">$500-$1000</option>
              <option value="$1000-$5000">$1000-$5000</option>
              <option value="Over $5000">Over $5000</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Development Stage</label>
            <select
              value={newInvention.development_stage}
              onChange={(e) => setNewInvention({ ...newInvention, development_stage: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select stage...</option>
              <option value="Concept">Concept</option>
              <option value="Design">Design</option>
              <option value="Prototype">Prototype</option>
              <option value="Testing">Testing</option>
              <option value="Production">Production</option>
            </select>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
          <input
            type="text"
            onChange={(e) => setNewInvention({ ...newInvention, tags: e.target.value.split(',').map(tag => tag.trim()) })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., IoT, Sustainability, Healthcare"
          />
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_public"
              checked={newInvention.is_public}
              onChange={(e) => setNewInvention({ ...newInvention, is_public: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_public" className="ml-2 block text-sm text-gray-900">
              Make this invention public (others can discover and get inspired)
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="collaboration_open"
              checked={newInvention.collaboration_open}
              onChange={(e) => setNewInvention({ ...newInvention, collaboration_open: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="collaboration_open" className="ml-2 block text-sm text-gray-900">
              Open to collaboration (allow others to contribute)
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="seeking_mentorship"
              checked={newInvention.seeking_mentorship}
              onChange={(e) => setNewInvention({ ...newInvention, seeking_mentorship: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="seeking_mentorship" className="ml-2 block text-sm text-gray-900">
              Seeking mentorship (looking for expert guidance)
            </label>
          </div>
        </div>
        
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => setCurrentView('home')}
            className="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating...' : 'Create Invention'}
          </button>
        </div>
      </form>
    </div>
  );

  // Enhanced Invention Detail View
  const InventionDetailView = () => {
    const [userRating, setUserRating] = useState(0);
    const [reviewText, setReviewText] = useState('');

    const handleRatingSubmit = () => {
      if (userRating > 0) {
        handleRateInvention(selectedInvention.id, userRating, reviewText);
        setUserRating(0);
        setReviewText('');
      }
    };

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-start mb-8">
          <div>
            <button
              onClick={() => setSelectedInvention(null)}
              className="text-blue-600 hover:text-blue-800 mb-4"
            >
              ← Back to Inventions
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{selectedInvention.title}</h1>
            <p className="text-gray-600 mt-2">by {selectedInvention.creator_name}</p>
            <div className="flex items-center space-x-4 mt-2">
              <span className="text-sm text-gray-500">👁 {selectedInvention.view_count} views</span>
              {selectedInvention.average_rating > 0 && (
                <StarRating rating={selectedInvention.average_rating} readOnly />
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {selectedInvention.is_public && (
              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">Public</span>
            )}
            <VoteComponent invention={selectedInvention} onVote={loadInventions} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 3D Model Viewer */}
          <div className="bg-gray-100 rounded-lg p-4 h-96">
            {selectedInvention.model_file_path ? (
              <Canvas camera={{ position: [0, 0, 5] }}>
                <ambientLight intensity={0.5} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
                <ModelViewer modelPath={selectedInvention.model_file_path} />
                <OrbitControls />
                <Environment preset="studio" />
              </Canvas>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-gray-500 mb-4">No 3D model uploaded yet</p>
                  <ModelUploader 
                    inventionId={selectedInvention.id} 
                    onUploadSuccess={loadInventions}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Invention Details */}
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold mb-4">Description</h3>
              <p className="text-gray-700">{selectedInvention.description}</p>
            </div>
            
            {/* Rating Section */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-lg font-medium mb-3">Rate This Invention</h4>
              <StarRating rating={userRating} onRatingChange={setUserRating} />
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your thoughts about this invention..."
                className="w-full mt-3 p-3 border border-gray-300 rounded-lg"
                rows="3"
              />
              <button
                onClick={handleRatingSubmit}
                disabled={userRating === 0}
                className="mt-3 bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 disabled:opacity-50"
              >
                Submit Rating
              </button>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setShowReviewForm(true)}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                Peer Review
              </button>
              
              <button
                onClick={() => {
                  setNewGroup({ ...newGroup, invention_id: selectedInvention.id });
                  setCurrentView('create-group');
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Start Discussion
              </button>
              
              {selectedInvention.seeking_mentorship && (
                <button
                  onClick={() => setCurrentView('mentors')}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                >
                  Find Mentor
                </button>
              )}
            </div>

            {/* Tags and Metadata */}
            {selectedInvention.tags.length > 0 && (
              <div>
                <h4 className="text-lg font-medium mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedInvention.tags.map((tag, index) => (
                    <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Peer Review Form */}
        {showReviewForm && (
          <div className="mt-8 bg-white border rounded-lg p-6">
            <PeerReviewForm 
              inventionId={selectedInvention.id}
              onSubmit={() => {
                setShowReviewForm(false);
                alert('Review submitted successfully!');
              }}
            />
          </div>
        )}

        {/* Comments Section */}
        <div className="mt-8">
          <CommentSection inventionId={selectedInvention.id} />
        </div>
      </div>
    );
  };

  // Find Mentors View
  const MentorsView = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Find a Mentor</h2>
        <p className="text-gray-600">Connect with experienced professionals and researchers who can guide your innovation journey.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mentors.map((mentor) => (
          <UserProfileCard
            key={mentor.id}
            user={mentor}
            onMentorRequest={handleMentorshipRequest}
          />
        ))}
      </div>
    </div>
  );

  // Mentorship Request View
  const MentorshipRequestView = () => (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Request Mentorship</h2>
      
      <form onSubmit={submitMentorshipRequest} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Mentor</label>
          <input
            type="text"
            value={mentorshipRequest.mentor_name}
            readOnly
            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
          <input
            type="text"
            value={mentorshipRequest.subject}
            onChange={(e) => setMentorshipRequest({ ...mentorshipRequest, subject: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="What would you like mentorship on?"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
          <textarea
            value={mentorshipRequest.message}
            onChange={(e) => setMentorshipRequest({ ...mentorshipRequest, message: e.target.value })}
            rows={6}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="Introduce yourself and explain what kind of guidance you're seeking..."
            required
          />
        </div>
        
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => setCurrentView('mentors')}
            className="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Sending...' : 'Send Request'}
          </button>
        </div>
      </form>
    </div>
  );

  // Other view components remain the same but with enhanced features...
  // [Keeping the same structure for CollaborateView, CreateGroupView, InspireView, CreateSuggestionView]
  
  const CollaborateView = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Discussion Groups</h2>
        <button
          onClick={() => setCurrentView('create-group')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + New Group
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groups.map((group) => (
          <div key={group.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{group.name}</h3>
            <p className="text-gray-600 mb-4">{group.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{group.members.length} members</span>
              <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                Join Discussion →
              </button>
            </div>
            {group.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {group.tags.map((tag, index) => (
                  <span key={index} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const CreateGroupView = () => (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Create Discussion Group</h2>
      
      <form onSubmit={handleCreateGroup} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Group Name</label>
          <input
            type="text"
            value={newGroup.name}
            onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., IoT Inventors Forum"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={newGroup.description}
            onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="What will this group discuss? What are the goals?"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Link to Invention (Optional)</label>
          <select
            value={newGroup.invention_id}
            onChange={(e) => setNewGroup({ ...newGroup, invention_id: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select an invention...</option>
            {inventions.map((invention) => (
              <option key={invention.id} value={invention.id}>
                {invention.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
          <input
            type="text"
            onChange={(e) => setNewGroup({ ...newGroup, tags: e.target.value.split(',').map(tag => tag.trim()) })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., AI, Research, Collaboration"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="is_private"
            checked={newGroup.is_private}
            onChange={(e) => setNewGroup({ ...newGroup, is_private: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="is_private" className="ml-2 block text-sm text-gray-900">
            Make this group private (invite-only)
          </label>
        </div>
        
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => setCurrentView('collaborate')}
            className="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </form>
    </div>
  );

  const InspireView = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Community Inspiration</h2>
        <button
          onClick={() => setCurrentView('create-suggestion')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Share Idea
        </button>
      </div>
      
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-8 mb-8 text-white">
        <h3 className="text-2xl font-bold mb-4">Get Inspired by Current Technology</h3>
        <p className="text-lg mb-4">Discover invention ideas shared by the community based on cutting-edge technology trends</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {suggestions.map((suggestion) => (
          <div key={suggestion.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">{suggestion.title}</h3>
              <button
                onClick={() => axios.post(`${API}/suggestions/${suggestion.id}/vote`)}
                className="text-gray-400 hover:text-blue-600"
              >
                👍 {suggestion.votes}
              </button>
            </div>
            <div className="mb-3">
              <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                {suggestion.technology_area}
              </span>
            </div>
            <p className="text-gray-600 mb-4">{suggestion.description}</p>
            <div className="text-sm text-gray-500">
              <p>Suggested by: {suggestion.suggested_by}</p>
              {suggestion.inspiration_source && (
                <p className="mt-1">Inspired by: {suggestion.inspiration_source}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const CreateSuggestionView = () => (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Share Your Invention Idea</h2>
      
      <form onSubmit={handleCreateSuggestion} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Invention Idea Title</label>
          <input
            type="text"
            value={newSuggestion.title}
            onChange={(e) => setNewSuggestion({ ...newSuggestion, title: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., AI-Powered Vertical Farming System"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={newSuggestion.description}
            onChange={(e) => setNewSuggestion({ ...newSuggestion, description: e.target.value })}
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe the invention idea and how it could work..."
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Technology Area</label>
          <select
            value={newSuggestion.technology_area}
            onChange={(e) => setNewSuggestion({ ...newSuggestion, technology_area: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            required
          >
            <option value="">Select technology area...</option>
            <option value="AI/Machine Learning">AI/Machine Learning</option>
            <option value="IoT/Hardware">IoT/Hardware</option>
            <option value="Biotechnology">Biotechnology</option>
            <option value="Renewable Energy">Renewable Energy</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Transportation">Transportation</option>
            <option value="Sustainability">Sustainability</option>
            <option value="Robotics">Robotics</option>
            <option value="Materials Science">Materials Science</option>
            <option value="Other">Other</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Your Name</label>
          <input
            type="text"
            value={newSuggestion.suggested_by}
            onChange={(e) => setNewSuggestion({ ...newSuggestion, suggested_by: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="Your name or team"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Inspiration Source (Optional)</label>
          <input
            type="text"
            value={newSuggestion.inspiration_source}
            onChange={(e) => setNewSuggestion({ ...newSuggestion, inspiration_source: e.target.value })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., Recent research paper, news article, existing product"
          />
        </div>
        
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={() => setCurrentView('inspire')}
            className="flex-1 bg-gray-300 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Sharing...' : 'Share Idea'}
          </button>
        </div>
      </form>
    </div>
  );

  // Render based on current view
  const renderView = () => {
    if (selectedInvention) {
      return <InventionDetailView />;
    }
    
    switch (currentView) {
      case 'home':
        return <HomeView />;
      case 'create':
        return <CreateView />;
      case 'collaborate':
        return <CollaborateView />;
      case 'create-group':
        return <CreateGroupView />;
      case 'inspire':
        return <InspireView />;
      case 'create-suggestion':
        return <CreateSuggestionView />;
      case 'mentors':
        return <MentorsView />;
      case 'request-mentorship':
        return <MentorshipRequestView />;
      default:
        return <HomeView />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      {renderView()}
    </div>
  );
}

export default App;
