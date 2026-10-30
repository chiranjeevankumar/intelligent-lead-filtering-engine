import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

const isProduction = process.env.NODE_ENV === 'production';
const allowMockAuth = process.env.MOCK_AUTH_ENABLED === 'true' || (!isProduction && process.env.ALLOW_MOCK_AUTH_IN_PROD !== 'false');

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (allowMockAuth) {
      req.user = { uid: 'dev-user-uid', email: 'dev@example.com' } as any;
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer authentication header' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();

  if (token === 'mock-token' || !token) {
    if (allowMockAuth) {
      req.user = { uid: 'dev-user-uid', email: 'dev@example.com' } as any;
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized: Mock tokens are disabled in production' });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    if (allowMockAuth) {
      console.warn('Firebase ID token verification failed; applying development mock fallback.');
      req.user = { uid: 'dev-user-uid', email: 'dev@example.com' } as any;
      return next();
    }
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid authentication token' });
  }
};
