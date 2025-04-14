
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { LucideIcon, Star, Heart, Search } from 'lucide-react';

interface EmptyStateProps {
  type?: 'favorites' | 'likes' | 'search';
  navigateTo?: string;
  buttonText?: string;
  title?: string;
  description?: string;
  icon?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ 
  type = 'search', 
  navigateTo = '/matches', 
  buttonText = 'Browse', 
  title, 
  description, 
  icon 
}) => {
  const getIcon = (iconName?: string): LucideIcon => {
    const iconMap = {
      'favorites': Star,
      'likes': Heart,
      'search': Search
    };
    return iconMap[type as keyof typeof iconMap] || Search;
  };

  const Icon = getIcon(icon);

  const defaultTitle = type === 'favorites' 
    ? 'No favorites yet' 
    : type === 'likes' 
    ? 'No likes yet' 
    : 'No results found';

  const defaultDescription = type === 'favorites' 
    ? 'You haven\'t added any doctors to your favorites list yet. Browse matches and click the heart icon to save your favorites.'
    : type === 'likes'
    ? 'No doctors have liked your profile yet. Make sure your profile is complete to attract more potential matches.'
    : 'Modify your search criteria to find matches';

  return (
    <Card className="border-dashed">
      <CardContent className="pt-10 pb-10 text-center">
        <Icon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <CardTitle className="text-xl mb-2">
          {title || defaultTitle}
        </CardTitle>
        <CardDescription>
          {description || defaultDescription}
        </CardDescription>
        {navigateTo && (
          <Button 
            className="mt-6" 
            onClick={() => window.location.href = navigateTo}
          >
            {buttonText}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default EmptyState;
