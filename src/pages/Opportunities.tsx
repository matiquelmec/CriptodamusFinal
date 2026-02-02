import React from 'react';
import { useNavigate } from 'react-router-dom';
import OpportunityFinder from '../components/OpportunityFinder';
import ActiveTradesPanel from '../components/opportunities/ActiveTradesPanel';
import PerformanceStats from '../components/opportunities/PerformanceStats';
import SystemAlertsBanner from '../components/SystemAlertsBanner';

const Opportunities: React.FC = () => {
    const navigate = useNavigate();

    const handleSelectOpportunity = (symbol: string) => {
        // Navigate to dashboard with the selected symbol
        navigate(`/?symbol=${symbol}`);
    };

    return (
        <div className="h-full overflow-y-auto pb-24 custom-scrollbar flex flex-col gap-4">
            <SystemAlertsBanner />
            {/* Live Control Room Panel */}
            <ActiveTradesPanel />
            {/* Performance Monitor Panel */}
            <PerformanceStats />
            {/* Opportunities Section */}
            <OpportunityFinder onSelectOpportunity={handleSelectOpportunity} />
        </div>
    );
};

export default Opportunities;
