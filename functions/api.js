const express = require('express');
const serverless = require('serverless-http');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Show Schema
const showSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  imageUrl: { type: String },
  genre: { type: String },
});

const Show = mongoose.model('Show', showSchema);

// Define Vote Schema
const voteSchema = new mongoose.Schema({
  showId: { type: mongoose.Schema.Types.ObjectId, ref: 'Show', required: true },
  userId: { type: String, required: true },
  date: { type: Date, default: Date.now }
});

const Vote = mongoose.model('Vote', voteSchema);

// Define Daily Selection Schema
const dailySelectionSchema = new mongoose.Schema({
  date: { type: Date, required: true, unique: true },
  shows: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Show' }]
});

const DailySelection = mongoose.model('DailySelection', dailySelectionSchema);

// Middleware to verify user
const authenticateUser = (req, res, next) => {
  const token = req.cookies.token;
  
  if (!token) {
    // If no token, create a new anonymous user ID
    const userId = require('crypto').randomBytes(16).toString('hex');
    const newToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.cookie('token', newToken, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    req.userId = userId;
    return next();
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    // If token is invalid, create a new one
    const userId = require('crypto').randomBytes(16).toString('hex');
    const newToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.cookie('token', newToken, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    req.userId = userId;
    next();
  }
};

// Function to check if voting is open
const isVotingOpen = () => {
  const now = new Date();
  const hours = now.getHours();
  return hours >= 6 && hours < 18; // 6am to 6pm
};

// Function to get today's date without time
const getTodayDate = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

// API Routes

// Get today's random shows
app.get('/api/daily-shows', authenticateUser, async (req, res) => {
  try {
    const today = getTodayDate();
    
    // Check if we already have a selection for today
    let dailySelection = await DailySelection.findOne({ date: today }).populate('shows');
    
    if (!dailySelection) {
      // If not, create a new random selection
      const allShows = await Show.find();
      
      // Randomly select 10 shows
      const shuffled = allShows.sort(() => 0.5 - Math.random());
      const selectedShows = shuffled.slice(0, 10);
      
      dailySelection = await DailySelection.create({
        date: today,
        shows: selectedShows.map(show => show._id)
      });
      
      // Populate the shows
      dailySelection = await DailySelection.findById(dailySelection._id).populate('shows');
    }
    
    res.json(dailySelection.shows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit a vote
app.post('/api/vote', authenticateUser, async (req, res) => {
  try {
    if (!isVotingOpen()) {
      return res.status(403).json({ error: 'Voting is closed. Voting is open from 6am to 6pm.' });
    }
    
    const { showId } = req.body;
    const userId = req.userId;
    const today = getTodayDate();
    
    // Check if user has already voted today
    const existingVote = await Vote.findOne({
      userId,
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    });
    
    if (existingVote) {
      return res.status(403).json({ error: 'You have already voted today.' });
    }
    
    // Check if the show is in today's selection
    const dailySelection = await DailySelection.findOne({ date: today });
    if (!dailySelection || !dailySelection.shows.includes(showId)) {
      return res.status(400).json({ error: 'Invalid show selection.' });
    }
    
    // Create the vote
    const vote = await Vote.create({
      showId,
      userId,
      date: new Date()
    });
    
    res.status(201).json({ message: 'Vote recorded successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get voting results
app.get('/api/results', async (req, res) => {
  try {
    const today = getTodayDate();
    const now = new Date();
    const hours = now.getHours();
    
    // Only show results after 7pm
    if (hours < 19) {
      return res.status(403).json({ 
        error: 'Results will be available at 7pm.',
        availableAt: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 0, 0)
      });
    }
    
    // Get today's selection
    const dailySelection = await DailySelection.findOne({ date: today }).populate('shows');
    
    if (!dailySelection) {
      return res.status(404).json({ error: 'No shows were selected today.' });
    }
    
    // Count votes for each show
    const results = await Vote.aggregate([
      { 
        $match: { 
          date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
        } 
      },
      { 
        $group: { 
          _id: '$showId', 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { count: -1 } }
    ]);
    
    // Map results to show details
    const detailedResults = await Promise.all(results.map(async (result) => {
      const show = await Show.findById(result._id);
      return {
        show,
        votes: result.count
      };
    }));
    
    res.json(detailedResults);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin route to add shows (would need proper admin authentication in production)
app.post('/api/admin/shows', async (req, res) => {
  try {
    const { title, description, imageUrl, genre } = req.body;
    
    const show = await Show.create({
      title,
      description,
      imageUrl,
      genre
    });
    
    res.status(201).json(show);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// For local development
if (process.env.NODE_ENV === 'development') {
  app.listen(3001, () => {
    console.log('Server running on port 3001');
  });
}

// For Netlify Functions
module.exports.handler = serverless(app);