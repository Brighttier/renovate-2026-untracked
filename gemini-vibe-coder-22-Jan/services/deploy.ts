import { DeploymentStatus } from "../types";

/**
 * Simulates the Firebase App Hosting deployment pipeline
 */
export const deployToProductionMock = (
  siteId: string, 
  onStatusUpdate: (status: DeploymentStatus) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    
    // Step 1: Create Version
    onStatusUpdate({ step: 'version', message: 'Creating new version...' });
    
    setTimeout(() => {
      // Step 2: Upload Content
      onStatusUpdate({ step: 'upload', message: 'Uploading assets to content addressable storage...' });
      
      setTimeout(() => {
        // Step 3: Finalize
        onStatusUpdate({ step: 'finalizing', message: 'Finalizing release and propagating to CDN...' });
        
        setTimeout(() => {
          // Complete
          const liveUrl = `https://${siteId}.web.app`;
          onStatusUpdate({ step: 'complete', url: liveUrl, message: 'Deployment successful!' });
          resolve(liveUrl);
        }, 2000);
        
      }, 1500);
      
    }, 1500);
  });
};