import React from 'react';
import { useTranslation } from 'react-i18next';

const CourtSelector = ({ courts, selectedCourt, onSelectCourt }) => {
  const { t } = useTranslation();

  const TennisCourtIcon = ({ surface }) => (
    <svg
      viewBox="0 0 200 300"
      style={{ width: '100%', height: '100%' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Court background */}
      <rect width="200" height="300" fill="#1a5632" rx="4" />
      
      {/* Court surface - different colors based on type */}
      <rect x="20" y="30" width="160" height="240" fill={
        surface?.toLowerCase().includes('clay') ? '#C4622D' :
        surface?.toLowerCase().includes('grass') ? '#3d9970' :
        '#4a90a4'
      } rx="2" />

      {/* Service lines */}
      <line x1="100" y1="90" x2="100" y2="150" stroke="white" strokeWidth="2" />
      
      {/* Net line */}
      <line x1="20" y1="150" x2="180" y2="150" stroke="white" strokeWidth="3" />
      
      {/* Service boxes */}
      <rect x="40" y="90" width="60" height="60" fill="none" stroke="white" strokeWidth="1.5" />
      <rect x="100" y="90" width="60" height="60" fill="none" stroke="white" strokeWidth="1.5" />
      <rect x="40" y="150" width="60" height="60" fill="none" stroke="white" strokeWidth="1.5" />
      <rect x="100" y="150" width="60" height="60" fill="none" stroke="white" strokeWidth="1.5" />
      
      {/* Baseline */}
      <line x1="20" y1="30" x2="180" y2="30" stroke="white" strokeWidth="2" />
      <line x1="20" y1="270" x2="180" y2="270" stroke="white" strokeWidth="2" />

      {/*Inner Side lines*/}
      <line x1="40" y1="30" x2="40" y2="270" stroke="white" strokeWidth="2" />
      <line x1="160" y1="30" x2="160" y2="270" stroke="white" strokeWidth="2" />

      {/* Side lines */}
      <line x1="20" y1="30" x2="20" y2="270" stroke="white" strokeWidth="2" />
      <line x1="180" y1="30" x2="180" y2="270" stroke="white" strokeWidth="2" />
    </svg>
  );

  return (
    <div className="court-selector-container">
      <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>
        {t('booking.selectCourt')}
      </h3>
      <div className="court-grid">
        {courts.map((court) => (
          <div
            key={court.id}
            className={`court-visual-card ${selectedCourt?.id === court.id ? 'selected' : ''}`}
            onClick={() => onSelectCourt(court)}
          >
            {/* Tennis Court Visual */}
            <div className="court-visual-wrapper">
              <TennisCourtIcon surface={court.surface} />
            </div>

            {/* Court Info */}
            <div className="court-visual-info">
              <div className="court-visual-name">{court.name}</div>
              <div className="court-visual-number">Court {court.courtNumber}</div>
              
              {/* Price Badge */}
              <div className="court-visual-footer">
                <span className="court-price-badge">
                  ฿{court.pricePerHour}/hr
                </span>
              </div>
            </div>

            {/* Selection Indicator */}
            {selectedCourt?.id === court.id && (
              <div className="selection-check">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 6L9 17L4 12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CourtSelector;
