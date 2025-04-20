import { NextRequest, NextResponse } from 'next/server';
import { Resource, Permission, enforcePermission } from './permissions';

// Higher-order function to wrap API routes with permission checks
export const withPermissions = (
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  resource: Resource,
  permission: Permission
) => {
  return async (req: NextRequest, ...args: any[]) => {
    // Check if the user has permission to access this resource
    const permissionError = await enforcePermission(req, resource, permission);
    
    if (permissionError) {
      return permissionError;
    }
    
    // If permission check passes, call the original handler
    return handler(req, ...args);
  };
};

// Higher-order function to wrap API routes with multiple permission checks
export const withMultiplePermissions = (
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  permissions: { resource: Resource; permission: Permission }[]
) => {
  return async (req: NextRequest, ...args: any[]) => {
    // Check if the user has permission to access all required resources
    for (const { resource, permission } of permissions) {
      const permissionError = await enforcePermission(req, resource, permission);
      
      if (permissionError) {
        return permissionError;
      }
    }
    
    // If all permission checks pass, call the original handler
    return handler(req, ...args);
  };
}; 