import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, AuthenticatedRequest } from '../src/middleware/auth.middleware';

describe('Authentication Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  it('should authenticate valid JWT token', () => {
    const userId = 1;
    const email = 'test@example.com';
    const validToken = jwt.sign({ userId, email }, process.env.JWT_SECRET || 'your_jwt_secret');

    mockReq.headers = {
      authorization: `Bearer ${validToken}`
    };

    authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockReq.userId).toBe(userId);
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should return 401 for missing authorization header', () => {
    authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Unauthorized: No token provided.'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 for malformed authorization header', () => {
    mockReq.headers = {
      authorization: 'InvalidHeader'
    };

    authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Unauthorized: No token provided.'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 for invalid JWT token', () => {
    mockReq.headers = {
      authorization: 'Bearer invalid.jwt.token'
    };

    authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Unauthorized: Invalid token.'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 for expired JWT token', (done) => {
    const expiredToken = jwt.sign(
      { userId: 1, email: 'test@example.com' },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '-1s' } // Already expired
    );

    mockReq.headers = {
      authorization: `Bearer ${expiredToken}`
    };

    authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Unauthorized: Invalid token.'
    });
    expect(mockNext).not.toHaveBeenCalled();
    done();
  });

  it('should handle bearer token with different case', () => {
    const userId = 1;
    const email = 'test@example.com';
    const validToken = jwt.sign({ userId, email }, process.env.JWT_SECRET || 'your_jwt_secret');

    mockReq.headers = {
      authorization: `bearer ${validToken}` // lowercase 'bearer'
    };

    authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

    // Should still fail as we expect 'Bearer ' with capital B
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Unauthorized: No token provided.'
    });
    expect(mockNext).not.toHaveBeenCalled();
  });
});