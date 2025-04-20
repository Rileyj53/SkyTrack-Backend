import Track, { ITrack } from '@/models/Track';

/**
 * Utility class to handle automatic tracking updates
 */
export class TrackUpdater {
  private trackId: string;
  private interval: number;
  private apiKey: string;
  private authToken: string;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private onUpdate: ((track: ITrack) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;

  /**
   * Create a new TrackUpdater instance
   * @param trackId The ID of the track to update
   * @param interval The interval in seconds between updates
   * @param apiKey The API key for authentication
   * @param authToken The authentication token
   */
  constructor(
    trackId: string,
    interval: number,
    apiKey: string,
    authToken: string
  ) {
    this.trackId = trackId;
    this.interval = interval;
    this.apiKey = apiKey;
    this.authToken = authToken;
  }

  /**
   * Set a callback function to be called when the track is updated
   * @param callback The callback function
   */
  public setOnUpdate(callback: (track: ITrack) => void): void {
    this.onUpdate = callback;
  }

  /**
   * Set a callback function to be called when an error occurs
   * @param callback The callback function
   */
  public setOnError(callback: (error: Error) => void): void {
    this.onError = callback;
  }

  /**
   * Start the automatic tracking updates
   */
  public start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    // Perform the first update immediately
    this.updateTrack();
    
    // Set up the interval for subsequent updates
    this.intervalId = setInterval(() => {
      this.updateTrack();
    }, this.interval * 1000);
  }

  /**
   * Stop the automatic tracking updates
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Update the track by calling the update endpoint
   */
  private async updateTrack(): Promise<void> {
    try {
      const response = await fetch(`/api/track/${this.trackId}/update`, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'Authorization': `Bearer ${this.authToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to update track: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();
      
      // Call the onUpdate callback if it's set
      if (this.onUpdate && data.track) {
        this.onUpdate(data.track);
      }
    } catch (error) {
      console.error('Error updating track:', error);
      
      // Call the onError callback if it's set
      if (this.onError && error instanceof Error) {
        this.onError(error);
      }
    }
  }
}

/**
 * Create a new TrackUpdater instance
 * @param trackId The ID of the track to update
 * @param interval The interval in seconds between updates
 * @param apiKey The API key for authentication
 * @param authToken The authentication token
 * @returns A new TrackUpdater instance
 */
export function createTrackUpdater(
  trackId: string,
  interval: number,
  apiKey: string,
  authToken: string
): TrackUpdater {
  return new TrackUpdater(trackId, interval, apiKey, authToken);
} 