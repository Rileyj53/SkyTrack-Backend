'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { TrackMonitor } from '@/components/TrackMonitor';
import '@/styles/TrackMonitor.css';

export default function TrackPage() {
  const params = useParams();
  const trackId = params.trackId as string;
  
  // In a real application, you would get these from your authentication system
  const [apiKey, setApiKey] = useState<string>('');
  const [authToken, setAuthToken] = useState<string>('');
  const [interval, setInterval] = useState<number>(30);
  
  // Load API key and auth token from localStorage or environment variables
  useEffect(() => {
    // This is just for demonstration purposes
    // In a real application, you would get these from your authentication system
    const storedApiKey = localStorage.getItem('apiKey') || '';
    const storedAuthToken = localStorage.getItem('authToken') || '';
    
    setApiKey(storedApiKey);
    setAuthToken(storedAuthToken);
  }, []);
  
  // Handle interval change
  const handleIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setInterval(parseInt(e.target.value, 10));
  };
  
  if (!apiKey || !authToken) {
    return (
      <div className="auth-container">
        <h2>Authentication Required</h2>
        <p>Please provide your API key and authentication token to view this track.</p>
        <div className="auth-form">
          <div className="form-group">
            <label htmlFor="apiKey">API Key:</label>
            <input
              type="text"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
            />
          </div>
          <div className="form-group">
            <label htmlFor="authToken">Auth Token:</label>
            <input
              type="text"
              id="authToken"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="Enter your authentication token"
            />
          </div>
          <button
            onClick={() => {
              localStorage.setItem('apiKey', apiKey);
              localStorage.setItem('authToken', authToken);
            }}
          >
            Save
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="track-page">
      <div className="track-controls">
        <h1>Track Monitor</h1>
        <div className="interval-selector">
          <label htmlFor="interval">Update Interval:</label>
          <select id="interval" value={interval} onChange={handleIntervalChange}>
            <option value="10">10 seconds</option>
            <option value="30">30 seconds</option>
            <option value="60">1 minute</option>
            <option value="300">5 minutes</option>
          </select>
        </div>
      </div>
      
      {trackId ? (
        <TrackMonitor
          trackId={trackId}
          interval={interval}
          apiKey={apiKey}
          authToken={authToken}
        />
      ) : (
        <div className="error-message">
          <p>No track ID provided. Please select a track to monitor.</p>
        </div>
      )}
    </div>
  );
} 