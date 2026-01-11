
import React from 'react';
import { useNavigate } from 'react-router-dom';
import OpportunityFinder from '../components/OpportunityFinder';

const Opportunities: React.FC = () => {
    const navigate = useNavigate();

    const handleSelectOpportunity = (symbol: string) => {
        // Navigate to dashboard with the selected symbol
        navigate(`/?symbol=${symbol}`);
    };

    return (
        <div className="h-auto md:h-full min-h-[600px] mb-24 lg:mb-0">
            <OpportunityFinder onSelectOpportunity={handleSelectOpportunity} />
        </div>
    );
};

export default Opportunities;
