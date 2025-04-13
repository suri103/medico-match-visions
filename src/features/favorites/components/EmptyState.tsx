
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { LucideIcon, Star, Heart } from 'lucide-react';

interface EmptyStateProps {
  type: 'favorites' | 'likes';
  navigateTo: string;
  buttonText: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ type, navigateTo, buttonText }) => {
  const Icon: LucideIcon = type === 'favorites' ? Star : Heart;
  const title = type === 'favorites' ? 'No favorites yet' : 'No likes yet';
  const description = type === 'favorites' 
    ? 'You haven\'t added any doctors to your favorites list yet. Browse matches and click the heart icon to save your favorites.'
    : 'No doctors have liked your profile yet. Make sure your profile is complete to attract more potential matches.';

  return (
    <Card className="border-dashed">
      <CardContent className="pt-10 pb-10 text-center">
        <Icon className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <CardTitle className="text-xl mb-2">{title}</CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
        <Button 
          className="mt-6" 
          onClick={() => window.location.href = navigateTo}
        >
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
};

export default EmptyState;
