const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./server/db/pool');
const authRoutes = require('./server/routes/auth');
const customerRoutes = require('./server/routes/customer');
const itRoutes = require('./server/routes/it');

const app = express();


const PORT = 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'xbank_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 4 } // 4 hours
}));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});


// Simple /api/me for role guard on frontends
app.get('/api/me', (req, res) => {
  if (!req.session || !req.session.user) return res.status(401).json({ message: 'Not logged in' });
  res.json({ user: req.session.user });
});

// Routes
app.use('/api', authRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/it', itRoutes);


// Starting the server
db.query("SELECT 1")
    .then(() => {
        console.log('Successfully connected to db');
        app.listen(PORT, () => 
            console.log(`Server running at http://localhost:${PORT}`));
    })
    .catch(err => console.log('DB connection failed. \n' + err));