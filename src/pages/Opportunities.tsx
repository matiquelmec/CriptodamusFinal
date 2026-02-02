import React from 'react';
import { useNavigate } from 'react-router-dom';
import OpportunityFinder from '../components/OpportunityFinder';
import ActiveTradesPanel from '../components/opportunities/ActiveTradesPanel'; // NEW Import

const Opportunities: React.FC = () => {
    const navigate = useNavigate();

    const handleSelectOpportunity = (symbol: string) => {
        // Navigate to dashboard with the selected symbol
        navigate(`/?symbol=${symbol}`);
    };

    return (
        <div className="h-auto md:h-full min-h-[600px] mb-24 lg:mb-0">
            {/* NEW: Live Control Room Panel */}
            <ActiveTradesPanel />
            <OpportunityFinder onSelectOpportunity={handleSelectOpportunity} />
        </div>
    );
};

export default Opportunities;
