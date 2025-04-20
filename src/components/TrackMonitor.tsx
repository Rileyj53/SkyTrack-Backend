import React, { useState } from 'react';
import { useTrackUpdater } from '@/hooks/useTrackUpdater';

interface TrackMonitorProps {
  trackId: string;
  interval?: number;
  apiKey: string;
  authToken: string;
}

export const TrackMonitor: React.FC<TrackMonitorProps> = ({
  trackId,
  interval = 30,
  apiKey,
  authToken
}) => {
  const { track, isLoading, error, updateTrack, stopTracking } = useTrackUpdater(
    trackId,
    interval,
    apiKey,
    authToken
  );

  const [showDetails, setShowDetails] = useState(false);

  if (isLoading && !track) {
    return <div>Loading track data...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Error</h3>
        <p>{error.message}</p>
        <button onClick={updateTrack}>Retry</button>
      </div>
    );
  }

  if (!track) {
    return <div>No track data available</div>;
  }

  return (
    <div className="track-monitor">
      <div className="track-header">
        <h2>Track: {track.tail_number}</h2>
        <div className="track-status">
          <span className={`status-badge ${track.status.toLowerCase()}`}>
            {track.status}
          </span>
          <button onClick={updateTrack} disabled={isLoading}>
            {isLoading ? 'Updating...' : 'Update Now'}
          </button>
          <button onClick={stopTracking} disabled={isLoading || track.status === 'Completed' || track.status === 'Cancelled'}>
            Stop Tracking
          </button>
        </div>
      </div>

      <div className="track-info">
        <div className="info-row">
          <span className="info-label">Flight ID:</span>
          <span className="info-value">{track.fa_flight_id || 'N/A'}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Date:</span>
          <span className="info-value">{new Date(track.date).toLocaleDateString()}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Start Time:</span>
          <span className="info-value">{new Date(track.start_time).toLocaleTimeString()}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Origin:</span>
          <span className="info-value">
            {track.origin ? `${track.origin.code} - ${track.origin.name}` : 'N/A'}
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Destination:</span>
          <span className="info-value">
            {track.destination ? `${track.destination.code} - ${track.destination.name}` : 'N/A'}
          </span>
        </div>
      </div>

      <div className="track-actions">
        <button onClick={() => setShowDetails(!showDetails)}>
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {showDetails && (
        <div className="track-details">
          <h3>Flight Details</h3>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Scheduled Off:</span>
              <span className="detail-value">
                {track.scheduled_off ? new Date(track.scheduled_off).toLocaleString() : 'N/A'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Estimated Off:</span>
              <span className="detail-value">
                {track.estimated_off ? new Date(track.estimated_off).toLocaleString() : 'N/A'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Actual Off:</span>
              <span className="detail-value">
                {track.actual_off ? new Date(track.actual_off).toLocaleString() : 'N/A'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Scheduled On:</span>
              <span className="detail-value">
                {track.scheduled_on ? new Date(track.scheduled_on).toLocaleString() : 'N/A'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Estimated On:</span>
              <span className="detail-value">
                {track.estimated_on ? new Date(track.estimated_on).toLocaleString() : 'N/A'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Actual On:</span>
              <span className="detail-value">
                {track.actual_on ? new Date(track.actual_on).toLocaleString() : 'N/A'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Flight Type:</span>
              <span className="detail-value">{track.flight_type || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Route:</span>
              <span className="detail-value">{track.route || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Distance:</span>
              <span className="detail-value">{track.distance ? `${track.distance} nm` : 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Duration:</span>
              <span className="detail-value">{track.duration ? `${track.duration} minutes` : 'N/A'}</span>
            </div>
          </div>

          <h3>Tracking Data</h3>
          <div className="tracking-data">
            {track.tracking && track.tracking.length > 0 ? (
              <div className="tracking-points">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Altitude</th>
                      <th>Ground Speed</th>
                      <th>Heading</th>
                      <th>Latitude</th>
                      <th>Longitude</th>
                    </tr>
                  </thead>
                  <tbody>
                    {track.tracking.map((point, index) => (
                      <tr key={index}>
                        <td>{new Date(point.timestamp).toLocaleTimeString()}</td>
                        <td>{point.altitude ? `${point.altitude} ft` : 'N/A'}</td>
                        <td>{point.ground_speed ? `${point.ground_speed} kts` : 'N/A'}</td>
                        <td>{point.heading ? `${point.heading}°` : 'N/A'}</td>
                        <td>{point.latitude || 'N/A'}</td>
                        <td>{point.longitude || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No tracking data available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 