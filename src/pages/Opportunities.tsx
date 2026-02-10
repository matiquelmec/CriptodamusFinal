import React from 'react';
import { useNavigate } from 'react-router-dom';
import ActiveTradesPanel from '../components/opportunities/ActiveTradesPanel';
import PerformanceStats from '../components/opportunities/PerformanceStats';
import OpportunitySection from '../components/opportunities/OpportunitySection';
import SystemAlertsBanner from '../components/SystemAlertsBanner';
import SystemStatusIndicator from '../components/SystemStatusIndicator';
import { MarketIntelligencePanel } from '../components/MarketIntelligencePanel';

const Opportunities: React.FC = () => {
    const navigate = useNavigate();

    const handleSelectOpportunity = (symbol: string) => {
        // Navigate to dashboard with the selected symbol
        navigate(`/?symbol=${symbol}`);
    };

    return (
        <div className="h-full overflow-y-auto pb-24 custom-scrollbar flex flex-col gap-4">
            <SystemAlertsBanner />
            <SystemStatusIndicator />
            {/* Market Intelligence - Correlation & Rotation Analysis */}
            <MarketIntelligencePanel />
            {/* Live Control Room Panel */}
            <ActiveTradesPanel />
            {/* Performance Monitor Panel */}
            <PerformanceStats />
            {/* Signals Section */}
            <OpportunitySection onSelectOpportunity={handleSelectOpportunity} />
        </div>
    );
};

export default Opportunities;
