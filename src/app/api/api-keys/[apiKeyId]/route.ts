import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '../../../../lib/jwt';
import { revokeApiKey } from '../../../../lib/apiKeys';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { apiKeyId: string } }
) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify the token
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get the API key ID from the URL
    const { apiKeyId } = params;

    // Revoke the API key
    const success = await revokeApiKey(decoded.userId, apiKeyId);

    if (!success) {
      return NextResponse.json(
        { error: 'API key not found or already revoked' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'API key revoked successfully'
    });
  } catch (error) {
    console.error('API key revocation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 