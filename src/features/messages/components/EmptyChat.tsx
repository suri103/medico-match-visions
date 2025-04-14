
import React from 'react';
import { Video } from 'lucide-react';

const EmptyChat: React.FC = () => {
  return (
    <div className="flex-grow flex flex-col items-center justify-center bg-white rounded-lg shadow-sm h-full p-6">
      <Video className="h-16 w-16 text-gray-300 mb-4" />
      <h3 className="text-xl font-medium text-gray-700 mb-2 text-center">Select a conversation</h3>
      <p className="text-gray-500 text-center mb-6">Choose a chat from the list to start messaging</p>
      
      <div className="w-full max-w-md p-6 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-800 mb-3 text-center">Quick Start Guide</h4>
        <ul className="text-sm text-gray-600 space-y-2">
          {[
            "Use the search bar to find specific contacts",
            "Check the \"What's New\" tab for your latest notifications",
            "Bulk select messages using the checkboxes for batch actions",
            "Start video calls directly from the chat interface"
          ].map((tip, index) => (
            <li key={index} className="flex items-start">
              <div className="mr-2 mt-0.5 text-mediblue-500">•</div>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default EmptyChat;
