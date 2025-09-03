import React from 'react';

function ShowCard({ show, onVote, votingOpen }) {
  return (
    <div className="show-card">
      {show.imageUrl && (
        <div className="show-image">
          <img src={show.imageUrl} alt={show.title} />
        </div>
      )}
      <div className="show-info">
        <h3>{show.title}</h3>
        <p className="show-genre">{show.genre}</p>
        <p className="show-description">{show.description}</p>
      </div>
      <button 
        className="vote-button" 
        onClick={() => onVote(show._id)}
        disabled={!votingOpen}
      >
        {votingOpen ? 'Vote' : 'Voting Closed'}
      </button>
    </div>
  );
}

export default ShowCard;