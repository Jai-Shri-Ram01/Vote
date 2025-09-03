import React, { useState, useEffect } from 'react';
import './App.css';
import ShowCard from './components/ShowCard';
import ResultsPage from './components/ResultsPage';

function App() {
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [votedShow, setVotedShow] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState([]);
  const [votingOpen, setVotingOpen] = useState(false);
  const [timeUntilResults, setTimeUntilResults] = useState('');
  
  const API_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3001/api' 
    : '/.netlify/functions/api';
  
  // Check if voting is open
  useEffect(() => {
    const checkVotingStatus = () => {
      const now = new Date();
      const hours = now.getHours();
      
      // Voting open from 6am to 6pm
      setVotingOpen(hours >= 6 && hours < 18);
      
      // Calculate time until results
      if (hours < 19) {
        const today = new Date();
        const resultsTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 19, 0, 0);
        const timeLeft = resultsTime - now;
        
        const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        
        setTimeUntilResults(`${hoursLeft}h ${minutesLeft}m`);
      } else {
        setTimeUntilResults('');
      }
    };
    
    checkVotingStatus();
    const interval = setInterval(checkVotingStatus, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);
  
  // Fetch today's shows
  useEffect(() => {
    const fetchShows = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/daily-shows`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch shows');
        }
        
        const data = await response.json();
        setShows(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchShows();
  }, [API_URL]);
  
  // Check if user has already voted
  useEffect(() => {
    const checkVoteStatus = async () => {
      try {
        // We'll use localStorage to remember if the user voted
        const voted = localStorage.getItem('voted');
        if (voted) {
          setVotedShow(JSON.parse(voted));
        }
      } catch (err) {
        console.error('Error checking vote status:', err);
      }
    };
    
    checkVoteStatus();
  }, []);
  
  // Handle voting
  const handleVote = async (showId) => {
    if (!votingOpen) {
      setError('Voting is currently closed. Voting is open from 6am to 6pm.');
      return;
    }
    
    if (votedShow) {
      setError('You have already voted today.');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ showId })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit vote');
      }
      
      const selectedShow = shows.find(show => show._id === showId);
      setVotedShow(selectedShow);
      localStorage.setItem('voted', JSON.stringify(selectedShow));
    } catch (err) {
      setError(err.message);
    }
  };
  
  // Fetch results
  const fetchResults = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/results`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch results');
      }
      
      const data = await response.json();
      setResults(data);
      setShowResults(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Toggle between shows and results
  const toggleResults = () => {
    if (!showResults) {
      fetchResults();
    } else {
      setShowResults(false);
    }
  };
  
  if (loading) {
    return <div className="loading">Loading...</div>;
  }
  
  if (error) {
    return <div className="error">{error}</div>;
  }
  
  return (
    <div className="App">
      <header className="App-header">
        <h1>Daily TV Show Voting</h1>
        <div className="status-bar">
          {votingOpen ? (
            <span className="voting-open">Voting is OPEN</span>
          ) : (
            <span className="voting-closed">Voting is CLOSED</span>
          )}
          
          {timeUntilResults && (
            <span className="results-countdown">Results in: {timeUntilResults}</span>
          )}
          
          <button 
            className="toggle-button" 
            onClick={toggleResults}
          >
            {showResults ? 'View Shows' : 'View Results'}
          </button>
        </div>
      </header>
      
      <main>
        {showResults ? (
          <ResultsPage results={results} />
        ) : (
          <div className="shows-container">
            {votedShow ? (
              <div className="voted-message">
                <h2>Thank you for voting!</h2>
                <p>You voted for: <strong>{votedShow.title}</strong></p>
                <p>Results will be available at 7pm.</p>
              </div>
            ) : (
              <>
                <h2>Today's Shows</h2>
                <p>Select one show to vote:</p>
                <div className="shows-grid">
                  {shows.map(show => (
                    <ShowCard 
                      key={show._id} 
                      show={show} 
                      onVote={handleVote} 
                      votingOpen={votingOpen}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;