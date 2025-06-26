// // api/run_query.js

// const express = require('express');
// const { Client } = require('pg');
// const { URL } = require('url');

// // Vercel-specific Express handler
// const { createServer } = require('@vercel/node');  // ✅ install this

// require('dotenv').config();

// const app = express();

// app.get('/', (req, res) => {
//   res.json({ success: true, message: 'API is working!' });
// });

// app.get('/api/run_query/:sql', async (req, res) => {
//   const sql = decodeURIComponent(req.params.sql);

//   const dbUrl = new URL(process.env.DATABASE_URL);

//   const client = new Client({
//     user: dbUrl.username,
//     password: dbUrl.password,
//     host: dbUrl.hostname,
//     port: dbUrl.port,
//     database: dbUrl.pathname.slice(1),
//     ssl: {
//       rejectUnauthorized: false,
//     },
//   });

//   try {
//     await client.connect();
//     const result = await client.query(sql);
//     res.json({ success: true, rows: result.rows });
//   } catch (err) {
//     console.error('SQL Error:', err);
//     res.status(500).json({ success: false, error: err.message });
//   } finally {
//     await client.end();
//   }
// });

// // ✅ Use Vercel’s expected export
// module.exports = createServer(app);


require('dotenv').config();
const express = require('express');
const { Client } = require('pg');
const { createServer } = require('@vercel/node');

const app = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'healthy',
    message: 'Query API is running',
    timestamp: new Date().toISOString()
  });
});

// Secure query endpoint
app.get('/api/query', async (req, res) => {
  // Validate required parameters
  const { table, limit = 100 } = req.query;
  
  if (!table) {
    return res.status(400).json({ 
      error: 'Missing required parameter: table',
      example: '/api/query?table=users&limit=10'
    });
  }

  // Validate limit is a number
  if (isNaN(limit) || limit > 1000) {
    return res.status(400).json({ 
      error: 'Limit must be a number less than 1000' 
    });
  }

  // Configure database connection
  const dbConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  };

  const client = new Client(dbConfig);

  try {
    // Connect with timeout
    await Promise.race([
      client.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      )
    ]);

    // Execute parameterized query
    const result = await client.query({
      text: `SELECT * FROM $1 LIMIT $2`,
      values: [table, parseInt(limit)],
      rowMode: 'array' // More secure than object mode
    });

    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount
    });

  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      hint: 'Check server logs for details'
    });
  } finally {
    await client.end().catch(console.error);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    requestId: req.id 
  });
});

// Export for Vercel
module.exports = createServer(app);

// Configuration for Vercel
module.exports.config = {
  maxDuration: 10, // 10s timeout (Hobby plan max)
};