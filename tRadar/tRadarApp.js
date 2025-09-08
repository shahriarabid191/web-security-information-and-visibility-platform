const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./server/db/pool');
const bodyparser = require('body-parser');
const authRouter = require('./server/routes/auth');
const bankRouter = require('./server/routes/bank');
const risksRoutes = require('./controllers/risks.controller');

const PORT = 3000;

const app = express();
const __dirnameResolved = path.resolve();

// --- parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- session (dev only)
app.use(session({
  secret: 'my_dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 }
}));

// --- static assets first
app.use(express.static(path.join(__dirnameResolved, 'public')));

// optional: redirect root to login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirnameResolved, 'public', 'login.html'));
});
app.use('/api/risks', risksRoutes)

// --- routers FIRST so we can protect /dashboard.html
app.use('/', authRouter);     // provides /login, /logout, /dashboard.html
app.use('/api', authRouter);  // also available under /api if you prefer
app.use('/api', bankRouter);  // /api/bank/signup

// --- 404
app.use((req, res) => res.status(404).json({ message: 'Not Found' }));

// Starting the server
db.query("SELECT 1")
    .then(() => {
        console.log('Successfully connected to db');
        app.listen(PORT, () => 
            console.log(`Server running at http://localhost:${PORT}`));
    })
    .catch(err => console.log('DB connection failed. \n' + err));




const { connectToXBank } = require('./services/wsClient.service');

connectToXBank(); 
