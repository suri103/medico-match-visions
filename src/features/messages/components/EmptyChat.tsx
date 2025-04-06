
import React from 'react';
import { Video } from 'lucide-react';

const EmptyChat: React.FC = () => {
  return (
    <div className="flex-grow flex flex-col items-center justify-center bg-white rounded-lg shadow-sm h-full">
      <Video className="h-16 w-16 text-gray-300 mb-4" />
      <h3 className="text-xl font-medium text-gray-700">Select a conversation</h3>
      <p className="text-gray-500 mt-2">Choose a chat from the list to start messaging</p>
      
      <div className="mt-8 p-6 bg-gray-50 rounded-lg max-w-lg">
        <h4 className="font-medium text-gray-800 mb-2">Quick Start Guide</h4>
        <ul className="text-sm text-gray-600 space-y-2">
          <li className="flex items-start">
            <div className="mr-2 mt-0.5 text-mediblue-500">•</div>
            <span>Use the search bar to find specific contacts</span>
          </li>
          <li className="flex items-start">
            <div className="mr-2 mt-0.5 text-mediblue-500">•</div>
            <span>Check the "What's New" tab for your latest notifications</span>
          </li>
          <li className="flex items-start">
            <div className="mr-2 mt-0.5 text-mediblue-500">•</div>
            <span>Bulk select messages using the checkboxes for batch actions</span>
          </li>
          <li className="flex items-start">
            <div className="mr-2 mt-0.5 text-mediblue-500">•</div>
            <span>Start video calls directly from the chat interface</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default EmptyChat;
