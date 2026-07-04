import jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET ?? 'kaloob-secret';

export function createToken(payload) {
  return jwt.sign(payload, jwtSecret, { expiresIn: '8h' });
}

export function verifyToken(request, response, next) {
  const authHeader = request.headers.authorization || '';
  // Support token via Authorization header or via `?token=` query (for EventSource)
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (request.query && request.query.token) {
    token = String(request.query.token);
  }

  if (!token) {
    return response.status(401).json({ message: 'Missing token' });
  }
  try {
    request.user = jwt.verify(token, jwtSecret);
    next();
  } catch (error) {
    return response.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireRole(role) {
  return (request, response, next) => {
    if (!request.user || request.user.role !== role) {
      return response.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}
