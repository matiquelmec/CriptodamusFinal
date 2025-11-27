
import React, { useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationSystemProps {
  notifications: AppNotification[];
  onDismiss: (id: string) => void;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({ notifications, onDismiss }) => {
  
  // Auto-dismiss logic
  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        onDismiss(notifications[0].id);
      }, 5000); // 5 seconds display time
      return () => clearTimeout(timer);
    }
  }, [notifications, onDismiss]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {notifications.map((n) => (
        <div 
          key={n.id}
          className={`pointer-events-auto rounded-xl border p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-right duration-300 flex items-start gap-3 relative ${
            n.type === 'SUCCESS' ? 'bg-success/10 border-success/30 text-success' :
            n.type === 'ERROR' ? 'bg-danger/10 border-danger/30 text-danger' :
            n.type === 'WARNING' ? 'bg-warning/10 border-warning/30 text-warning' :
            'bg-surface border-border text-primary'
          }`}
        >
          {/* Icon */}
          <div className="mt-0.5">
             {n.type === 'SUCCESS' && <CheckCircle size={20} />}
             {n.type === 'ERROR' && <AlertOctagon size={20} />}
             {n.type === 'WARNING' && <AlertTriangle size={20} />}
             {n.type === 'INFO' && <Info size={20} />}
          </div>

          {/* Content */}
          <div className="flex-1 pr-4">
            <h4 className="font-mono font-bold text-sm uppercase tracking-wide">{n.title}</h4>
            <p className="text-xs opacity-90 mt-1 font-sans leading-relaxed">{n.message}</p>
          </div>

          {/* Dismiss Button */}
          <button 
            onClick={() => onDismiss(n.id)}
            className="absolute top-2 right-2 p-1 opacity-50 hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
          
          {/* Progress Bar (Visual Timer) */}
          <div className="absolute bottom-0 left-0 h-0.5 bg-current opacity-30 animate-[width_5s_linear_forwards]" style={{width: '100%'}}></div>
        </div>
      ))}
    </div>
  );
};

export default NotificationSystem;
