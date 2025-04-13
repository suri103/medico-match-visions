
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Video, 
  Send, 
  Smile, 
  Paperclip, 
  MoreVertical, 
  X,
  ArrowLeft,
  Calendar,
  Phone
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from 'date-fns';

type Message = {
  id: string;
  content: string;
  sender: 'user' | 'doctor';
  timestamp: Date;
  status?: 'sent' | 'delivered' | 'read';
};

interface ChatProps {
  doctorId: string;
  doctorName: string;
  doctorImage: string;
  onStartVideoCall?: () => void;
  onClose?: () => void;
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
      content: 'What time works for you?',
      sender: 'doctor',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      status: 'read',
    },
    {
      id: '2',
      content: 'Let\'s meet next week.',
      sender: 'user',
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      status: 'read',
    },
    {
      id: '3',
      content: 'Have you read the research paper?',
      sender: 'doctor',
      timestamp: new Date(),
      status: 'delivered',
    },
  ]);
  
  const [newMessage, setNewMessage] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const handleSendMessage = () => {
    if (newMessage.trim() === '') return;
    
    const message: Message = {
      id: Date.now().toString(),
      content: newMessage,
      sender: 'user',
      timestamp: new Date(),
      status: 'sent',
    };
    
    setMessages([...messages, message]);
    setNewMessage('');
    setIsComposing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const formatMessageTime = (date: Date) => {
    const today = new Date();
    const messageDate = new Date(date);
    
    if (
      messageDate.getDate() === today.getDate() &&
      messageDate.getMonth() === today.getMonth() &&
      messageDate.getFullYear() === today.getFullYear()
    ) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    return messageDate.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[80vh] bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden mr-2"
            onClick={onClose}
          >
            <ArrowLeft size={20} />
          </Button>
          
          <Avatar className="h-10 w-10 mr-3">
            <img src={doctorImage} alt={doctorName} className="object-cover" />
          </Avatar>
          
          <div>
            <h3 className="font-medium">Dr. {doctorName}</h3>
            <p className="text-xs text-green-500">Online</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-mediblue-600"
            onClick={() => console.log('Schedule appointment')}
          >
            <Calendar size={20} />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-mediblue-600"
            onClick={() => console.log('Phone call')}
          >
            <Phone size={20} />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-mediblue-600"
            onClick={onStartVideoCall}
          >
            <Video size={20} />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical size={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => console.log('View profile')}>
                View doctor profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Clear chat')}>
                Clear chat history
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Block')}>
                Block doctor
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-500" onClick={() => console.log('Report')}>
                Report doctor
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Messages area */}
      <div className="flex-grow p-4 overflow-y-auto">
        <div className="space-y-4">
          {messages.map((message) => {
            const isSentByUser = message.sender === 'user';
            return (
              <div 
                key={message.id} 
                className={`flex ${isSentByUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className="flex max-w-[80%]">
                  {!isSentByUser && (
                    <Avatar className="h-8 w-8 mr-2 mt-1 flex-shrink-0">
                      <img src={doctorImage} alt={doctorName} />
                    </Avatar>
                  )}
                  
                  <div>
                    <div 
                      className={`rounded-2xl px-4 py-2 inline-block
                        ${isSentByUser 
                          ? 'bg-mediblue-100 text-mediblue-900 rounded-br-none' 
                          : 'bg-gray-100 rounded-bl-none'}
                      `}
                    >
                      {message.content}
                    </div>
                    <div className={`text-xs text-gray-500 mt-1 ${isSentByUser ? 'text-right' : 'text-left'}`}>
                      {formatMessageTime(message.timestamp)}
                      {isSentByUser && message.status && (
                        <span className="ml-2">
                          {message.status === 'read' && (
                            <span className="text-blue-500">✓✓</span>
                          )}
                          {message.status === 'delivered' && (
                            <span>✓✓</span>
                          )}
                          {message.status === 'sent' && (
                            <span>✓</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {isSentByUser && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 ml-1">
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => console.log('Edit')}>
                          Edit message
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => console.log('Delete')}>
                          Delete message
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>
      
      {/* Message input */}
      <div className="border-t p-3">
        {isComposing ? (
          <div className="flex flex-col space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Compose message</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setIsComposing(false)}
              >
                <X size={18} />
              </Button>
            </div>
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message here..."
              className="min-h-[120px]"
            />
            <div className="flex justify-between">
              <div className="flex space-x-1">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Paperclip size={18} />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Smile size={18} />
                </Button>
              </div>
              <Button onClick={handleSendMessage} className="bg-mediblue-600 hover:bg-mediblue-700">
                <Send size={16} className="mr-2" />
                Send
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex space-x-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10"
              onClick={() => console.log('Attach file')}
            >
              <Paperclip size={20} />
            </Button>
            <div className="flex-grow relative">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="pr-10"
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                onClick={() => console.log('Insert emoji')}
              >
                <Smile size={18} />
              </Button>
            </div>
            <Button 
              onClick={handleSendMessage} 
              className="bg-mediblue-600 hover:bg-mediblue-700 text-white w-10 h-10 rounded-full p-0 flex items-center justify-center"
              disabled={!newMessage.trim()}
            >
              <Send size={18} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
