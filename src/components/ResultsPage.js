import React from 'react';

function ResultsPage({ results }) {
  if (results.length === 0) {
    return (
      <div className="results-container">
        <h2>Today's Results</h2>
        <p>No votes have been recorded today.</p>
      </div>
    );
  }
  
  // Calculate total votes
  const totalVotes = results.reduce((sum, item) => sum + item.votes, 0);
  
  return (
    <div className="results-container">
      <h2>Today's Results</h2>
      <p>Total votes: {totalVotes}</p>
      
      <div className="results-list">
        {results.map((item, index) => (
          <div key={item.show._id} className="result-item">
            <div className="result-rank">{index + 1}</div>
            <div className="result-info">
              <h3>{item.show.title}</h3>
              <div className="result-stats">
                <span className="vote-count">{item.votes} votes</span>
                <span className="vote-percentage">
                  ({Math.round((item.votes / totalVotes) * 100)}%)
                </span>
              </div>
            </div>
            <div className="result-bar-container">
              <div 
                className="result-bar" 
                style={{ width: `${(item.votes / totalVotes) * 100}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ResultsPage;