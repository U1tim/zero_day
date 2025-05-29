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
    maxSize: 10 * 1024 * 1024 * 1024 // 10GB
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

// Invention Card Component
const InventionCard = ({ invention, onClick }) => (
  <div 
    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
    onClick={() => onClick(invention)}
  >
    <div className="flex items-start justify-between mb-4">
      <h3 className="text-lg font-semibold text-gray-900">{invention.title}</h3>
      {invention.is_public && (
        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Public</span>
      )}
    </div>
    <p className="text-gray-600 mb-4 line-clamp-3">{invention.description}</p>
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">by {invention.creator_name}</span>
      {invention.model_file_path && (
        <div className="flex items-center text-blue-600 text-sm">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
          </svg>
          3D Model
        </div>
      )}
    </div>
    {invention.tags.length > 0 && (
      <div className="mt-3 flex flex-wrap gap-1">
        {invention.tags.map((tag, index) => (
          <span key={index} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
            {tag}
          </span>
        ))}
      </div>
    )}
  </div>
);

// Main App Component
function App() {
  const [currentView, setCurrentView] = useState('home');
  const [inventions, setInventions] = useState([]);
  const [selectedInvention, setSelectedInvention] = useState(null);
  const [groups, setGroups] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [newInvention, setNewInvention] = useState({
    title: '',
    description: '',
    creator_name: '',
    is_public: false,
    tags: []
  });
  
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    invention_id: ''
  });

  const [newSuggestion, setNewSuggestion] = useState({
    title: '',
    description: '',
    technology_area: '',
    suggested_by: '',
    inspiration_source: ''
  });

  // Load data
  const loadInventions = async () => {
    try {
      const response = await axios.get(`${API}/inventions`);
      setInventions(response.data);
    } catch (error) {
      console.error('Failed to load inventions:', error);
    }
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

  useEffect(() => {
    loadInventions();
    loadGroups();
    loadSuggestions();
  }, []);

  // Create new invention
  const handleCreateInvention = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/inventions`, newInvention);
      setInventions([response.data, ...inventions]);
      setNewInvention({ title: '', description: '', creator_name: '', is_public: false, tags: [] });
      setCurrentView('home');
    } catch (error) {
      console.error('Failed to create invention:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create new group
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/groups`, newGroup);
      setGroups([response.data, ...groups]);
      setNewGroup({ name: '', description: '', invention_id: '' });
      setCurrentView('collaborate');
    } catch (error) {
      console.error('Failed to create group:', error);
    } finally {
      setLoading(false);
    }
  };

  // Create new suggestion
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
          </div>
        </div>
      </div>
    </nav>
  );

  // Home View - Inventions
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
          <p className="text-xl mb-6">Collaborate on 3D inventions with students and researchers worldwide</p>
          <button
            onClick={() => setCurrentView('create')}
            className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Share Your Invention
          </button>
        </div>
      </div>

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
        {inventions.map((invention) => (
          <InventionCard
            key={invention.id}
            invention={invention}
            onClick={setSelectedInvention}
          />
        ))}
      </div>
    </div>
  );

  // Create Invention View
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Tags (comma-separated)</label>
          <input
            type="text"
            onChange={(e) => setNewInvention({ ...newInvention, tags: e.target.value.split(',').map(tag => tag.trim()) })}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., IoT, Sustainability, Healthcare"
          />
        </div>
        
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

  // Invention Detail View
  const InventionDetailView = () => (
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
        </div>
        {selectedInvention.is_public && (
          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">Public</span>
        )}
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
        <div>
          <h3 className="text-xl font-semibold mb-4">Description</h3>
          <p className="text-gray-700 mb-6">{selectedInvention.description}</p>
          
          {selectedInvention.tags.length > 0 && (
            <div className="mb-6">
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
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-lg font-medium mb-2">Collaboration</h4>
            <p className="text-gray-600 mb-4">Want to discuss this invention? Create a group!</p>
            <button
              onClick={() => {
                setNewGroup({ ...newGroup, invention_id: selectedInvention.id });
                setCurrentView('create-group');
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Discussion Group
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Collaborate View
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
          <div key={group.id} className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{group.name}</h3>
            <p className="text-gray-600 mb-4">{group.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{group.members.length} members</span>
              <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                Join Discussion →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Create Group View
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

  // Inspire View
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
          <div key={suggestion.id} className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{suggestion.title}</h3>
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

  // Create Suggestion View
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
