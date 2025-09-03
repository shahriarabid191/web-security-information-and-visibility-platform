const express = require('express'),
    app = express(),
    bodyparser = require('body-parser'),
    path = require('path'), 
    PORT = 5000,
    db = require('./models/db'),
    risksRoutes = require('./controllers/risks.controller');


// Middleware
app.use(bodyparser.json())

app.use('/api/risks', risksRoutes)

app.use((err, req, res, next) => {
    console.log(err)
    res.status(err.status || 500).send('Something went wrong!')
})

app.use(express.static(path.join(__dirname, 'public'))); // Serving static files from public folder

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Starting the server
db.query("SELECT 1")
    .then(() => {
        console.log('Successfully connected to db');
        app.listen(PORT, () => 
            console.log(`Server running at http://localhost:${PORT}`));
    })
    .catch(err => console.log('DB connection failed. \n' + err));
