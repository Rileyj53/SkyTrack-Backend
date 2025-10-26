/**
 * Global error handler for unhandled exceptions and promise rejections
 * This should be imported in your app entry point (e.g., src/app/layout.tsx)
 */
export function setupGlobalErrorHandling() {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', {
      reason,
      promise,
      timestamp: new Date().toISOString(),
    });
    
    // In production, you might want to send this to an error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: sendToErrorTrackingService(reason, 'unhandledRejection');
    }
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      timestamp: new Date().toISOString(),
    });
    
    // In production, you might want to send this to an error tracking service
    if (process.env.NODE_ENV === 'production') {
      // Example: sendToErrorTrackingService(error, 'uncaughtException');
    }
    
    // For uncaught exceptions, we should exit the process in production
    // This prevents the application from running in an inconsistent state
    if (process.env.NODE_ENV === 'production') {
      // Give time for logs to be written
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    }
  });
} 