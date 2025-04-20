import { useState, useEffect, useCallback } from 'react';
import Track, { ITrack } from '@/models/Track';
import { TrackUpdater, createTrackUpdater } from '@/utils/trackUpdater';

/**
 * React hook to use the TrackUpdater utility
 * @param trackId The ID of the track to update
 * @param interval The interval in seconds between updates
 * @param apiKey The API key for authentication
 * @param authToken The authentication token
 * @returns An object containing the track, loading state, error state, and control functions
 */
export function useTrackUpdater(
  trackId: string | null,
  interval: number,
  apiKey: string,
  authToken: string
) {
  const [track, setTrack] = useState<ITrack | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [trackUpdater, setTrackUpdater] = useState<TrackUpdater | null>(null);

  // Create a new TrackUpdater instance when the trackId, interval, apiKey, or authToken changes
  useEffect(() => {
    if (!trackId) {
      return;
    }

    const updater = createTrackUpdater(trackId, interval, apiKey, authToken);
    
    // Set up the onUpdate callback
    updater.setOnUpdate((updatedTrack) => {
      setTrack(updatedTrack);
      setIsLoading(false);
    });
    
    // Set up the onError callback
    updater.setOnError((err) => {
      setError(err);
      setIsLoading(false);
    });
    
    setTrackUpdater(updater);
    
    // Clean up the TrackUpdater instance when the component unmounts
    return () => {
      updater.stop();
    };
  }, [trackId, interval, apiKey, authToken]);

  // Start the automatic tracking updates when the trackUpdater changes
  useEffect(() => {
    if (trackUpdater) {
      setIsLoading(true);
      trackUpdater.start();
    }
    
    return () => {
      if (trackUpdater) {
        trackUpdater.stop();
      }
    };
  }, [trackUpdater]);

  // Function to manually update the track
  const updateTrack = useCallback(async () => {
    if (!trackId) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/track/${trackId}/update`, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to update track: ${errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      setTrack(data.track);
    } catch (err) {
      console.error('Error updating track:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [trackId, apiKey, authToken]);

  // Function to stop tracking
  const stopTracking = useCallback(async () => {
    if (!trackId) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/track/${trackId}/stop`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to stop tracking: ${errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      setTrack(data.track);
      
      // Stop the automatic tracking updates
      if (trackUpdater) {
        trackUpdater.stop();
      }
    } catch (err) {
      console.error('Error stopping tracking:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [trackId, apiKey, authToken, trackUpdater]);

  return {
    track,
    isLoading,
    error,
    updateTrack,
    stopTracking
  };
} 