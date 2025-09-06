import request from 'supertest';
import express from 'express';
jest.mock('../src/modules/user/user.controller');
import userRoutes from '../src/modules/user/user.routes';
import { registerUser, loginUser } from '../src/modules/user/user.controller';

const app = express();
app.use(express.json());
app.use(userRoutes);

describe('User Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/signup', () => {
    it('should register a user successfully', async () => {
      (registerUser as jest.Mock).mockImplementation((req, res) => res.status(201).json({ id: 1, name: 'Test', email: 'test@example.com' }));
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Test', email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.email).toBe('test@example.com');
    });

    it('should return 400 for missing fields', async () => {
      (registerUser as jest.Mock).mockImplementation((req, res) => res.status(400).json({ error: 'Name, email, and password are required.' }));
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 409 for duplicate email', async () => {
      (registerUser as jest.Mock).mockImplementation((req, res) => res.status(409).json({ error: 'Email already in use.' }));
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Test', email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully', async () => {
      (loginUser as jest.Mock).mockImplementation((req, res) => res.status(200).json({ token: 'jwt-token' }));
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
    });

    it('should return 400 for missing fields', async () => {
      (loginUser as jest.Mock).mockImplementation((req, res) => res.status(400).json({ error: 'Email and password are required.' }));
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 for incorrect password', async () => {
      (loginUser as jest.Mock).mockImplementation((req, res) => res.status(401).json({ error: 'Invalid credentials.' }));
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });
  });
});
