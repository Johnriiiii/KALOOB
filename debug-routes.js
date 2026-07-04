import express from 'express';
import memberRoutes from './server/src/routes/members.routes.js';
import chapelRoutes from './server/src/routes/chapels.routes.js';

const app = express();
app.use(express.json());

console.log('memberRoutes:', typeof memberRoutes, memberRoutes?.constructor?.name);
console.log('chapelRoutes:', typeof chapelRoutes, chapelRoutes?.constructor?.name);

app.use('/api/members', memberRoutes);
app.use('/api/chapels', chapelRoutes);

// Test if routes are mounted
const request = (method, path) => {
  return new Promise((resolve) => {
    const req = {
      method,
      path,
      headers: { 'x-bypass-auth': 'true' },
      get: (key) => req.headers[key.toLowerCase()],
      query: {},
    };
    const res = {
      statusCode: 200,
      json: (data) => resolve({ status: res.statusCode, data }),
      status: (code) => { res.statusCode = code; return res; },
    };
    const next = (err) => resolve({ status: err ? 500 : 404, error: err?.message || 'not found' });
    
    // Find matching route
    app._router.stack.forEach(layer => {
      if (layer.route) {
        console.log('Found route:', layer.route.path, Object.keys(layer.route.methods));
      }
    });
  });
};

console.log('\nApp stack:');
app._router.stack.forEach((layer, i) => {
  if (layer.route) {
    console.log(i, 'route:', layer.route.path, Object.keys(layer.route.methods));
  } else if (layer.name === 'router') {
    console.log(i, 'router mounted at:', layer.regexp);
  } else {
    console.log(i, 'middleware:', layer.name);
  }
});
