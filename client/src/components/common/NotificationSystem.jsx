import React from 'react';
import { useUI } from '../../context/UIContext';
import { X, AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

const icons = {
    info: <Info className="w-5 h-5 text-blue-500" />,
    success: <CheckCircle2 className="w-5 h-5 text-green-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />
};

const bgColors = {
    info: 'bg-blue-50 border-blue-100/50 text-blue-800',
    success: 'bg-green-50 border-green-100/50 text-green-800',
    warning: 'bg-yellow-50 border-yellow-100/50 text-yellow-800',
    error: 'bg-red-50 border-red-100/50 text-red-800'
};

const NotificationSystem = () => {
    const { notifications, removeNotification } = useUI();

    if (notifications.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end space-y-3 pointer-events-none">
            {notifications.map((notif) => (
                <div
                    key={notif.id}
                    className={`max-w-sm w-full p-4 rounded-lg shadow-lg border backdrop-blur-md pointer-events-auto flex items-start gap-3 transition-all duration-300 transform translate-y-0 opacity-100 ${bgColors[notif.type] || bgColors.info}`}
                >
                    <div className="flex-shrink-0 mt-0.5">
                        {icons[notif.type] || icons.info}
                    </div>
                    <div className="flex-1 font-medium text-sm">
                        {notif.message}
                    </div>
                    <button
                        onClick={() => removeNotification(notif.id)}
                        className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};

export default NotificationSystem;
