
import React from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { MoreVertical } from 'lucide-react';
import { formatMessageTime } from '../utils/formatTime';
import { Message } from '../hooks/useMessages';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';

interface MessageItemProps {
  chat: Message;
  isSelected: boolean;
  isActive: boolean;
  onSelect: (id: string) => void;
  onSelectMessage: (id: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({
  chat,
  isSelected,
  isActive,
  onSelect,
  onSelectMessage
}) => {
  return (
    <div 
      className={`p-3 border-b last:border-0 cursor-pointer transition-colors duration-150 
        ${isActive ? 'bg-mediblue-50 border-l-4 border-mediblue-500' : 'hover:bg-gray-50'}`}
    >
      <div className="flex items-center space-x-3">
        <Checkbox 
          checked={isSelected}
          onCheckedChange={() => onSelect(chat.id)}
          className="shrink-0"
        />
        <div 
          className="flex flex-1 items-center space-x-3 min-w-0"
          onClick={() => onSelectMessage(chat.id)}
        >
          <div className="relative">
            <Avatar className="h-12 w-12">
              <img src={chat.imageUrl} alt={chat.name} className="object-cover" />
            </Avatar>
            {chat.isOnline && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
            )}
          </div>
          
          <div className="flex-grow min-w-0">
            <div className="flex justify-between items-baseline">
              <h3 className="font-medium text-gray-900 truncate max-w-[150px]">Dr. {chat.name}</h3>
              <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                {formatMessageTime(chat.timestamp)}
              </span>
            </div>
            <p className="text-sm text-gray-500 truncate max-w-[250px]">{chat.lastMessage}</p>
          </div>
          
          {chat.unread > 0 && (
            <div className="ml-2 bg-mediblue-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {chat.unread}
            </div>
          )}
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSelect(chat.id)}>
              {isSelected ? 'Deselect' : 'Select'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => console.log('Mark as read')}>
              Mark as {chat.unread > 0 ? 'read' : 'unread'}
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-red-500 focus:text-red-500" 
              onClick={() => {
                toast({
                  title: "Message Deleted",
                  description: "The message has been deleted.",
                });
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default MessageItem;
