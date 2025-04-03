
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Send, Phone, Video } from 'lucide-react';

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
}

interface ChatProps {
  doctorId: string;
  doctorName: string;
  doctorImage: string;
  onStartVideoCall: () => void;
  onClose: () => void;
}

const Chat: React.FC<ChatProps> = ({
  doctorId,
  doctorName,
  doctorImage,
  onStartVideoCall,
  onClose
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      senderId: doctorId,
      text: 'Hello! Nice to connect with you. I saw that we both specialize in Cardiology.',
      timestamp: new Date(Date.now() - 60000 * 30)
    },
    {
      id: '2',
      senderId: 'user',
      text: 'Hi Dr. ' + doctorName + '! Yes, I work at City Medical Center. Where are you practicing?',
      timestamp: new Date(Date.now() - 60000 * 25)
    },
    {
      id: '3',
      senderId: doctorId,
      text: "I'm at Memorial Hospital. I've been there for about 5 years now. Would you like to schedule a video call to chat more?",
      timestamp: new Date(Date.now() - 60000 * 20)
    }
  ]);
  
  const [newMessage, setNewMessage] = useState('');
  
  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const message: Message = {
        id: Date.now().toString(),
        senderId: 'user',
        text: newMessage.trim(),
        timestamp: new Date()
      };
      
      setMessages([...messages, message]);
      setNewMessage('');
      
      // Simulate a reply
      setTimeout(() => {
        const reply: Message = {
          id: (Date.now() + 1).toString(),
          senderId: doctorId,
          text: "That sounds interesting! I'd love to hear more about your research. Maybe we could discuss it over a video call?",
          timestamp: new Date()
        };
        
        setMessages(prevMessages => [...prevMessages, reply]);
      }, 3000);
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-white rounded-lg overflow-hidden shadow-lg">
      {/* Chat header */}
      <div className="bg-mediblue-500 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Avatar className="w-10 h-10 border-2 border-white">
            <img src={doctorImage} alt={doctorName} className="object-cover" />
          </Avatar>
          <div>
            <h3 className="font-semibold">Dr. {doctorName}</h3>
            <div className="flex items-center text-xs">
              <div className="w-2 h-2 rounded-full bg-green-400 mr-1"></div>
              <span>Online</span>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Button 
            size="sm" 
            variant="ghost"
            className="text-white hover:bg-mediblue-600"
            onClick={onStartVideoCall}
          >
            <Video size={18} />
          </Button>
          <Button 
            size="sm" 
            variant="ghost"
            className="text-white hover:bg-mediblue-600"
          >
            <Phone size={18} />
          </Button>
        </div>
      </div>
      
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map(message => (
          <div 
            key={message.id}
            className={`flex ${message.senderId === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[75%] rounded-lg px-4 py-2 ${
                message.senderId === 'user' 
                  ? 'bg-mediblue-500 text-white rounded-br-none'
                  : 'bg-gray-200 text-gray-800 rounded-bl-none'
              }`}
            >
              <p>{message.text}</p>
              <p className={`text-xs mt-1 ${
                message.senderId === 'user' ? 'text-blue-100' : 'text-gray-500'
              }`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Message input */}
      <div className="p-3 border-t">
        <div className="flex space-x-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-grow"
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <Button 
            onClick={handleSendMessage}
            className="bg-mediblue-500 hover:bg-mediblue-600"
          >
            <Send size={18} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
