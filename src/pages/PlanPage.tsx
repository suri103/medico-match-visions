
import React from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Calendar, CheckCircle2, X, Heart, Star, Video, MessageSquare, Users, 
  Bell, Shield, Zap, Crown 
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const PlanPage = () => {
  const { toast } = useToast();
  
  const handleUpgrade = (plan: string) => {
    toast({
      title: `${plan} plan selected`,
      description: "You'll be redirected to complete your purchase.",
    });
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 text-center">
            <h1 className="text-2xl md:text-4xl font-bold text-mediblue-800 flex items-center justify-center">
              <Calendar className="mr-3 text-mediblue-600" size={32} />
              MedicoMatch Membership Plans
            </h1>
            <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
              Choose the perfect plan to enhance your experience and find your ideal match in the medical community.
            </p>
          </div>
          
          <Tabs defaultValue="monthly" className="mb-10">
            <div className="text-center">
              <TabsList>
                <TabsTrigger value="monthly">Monthly Billing</TabsTrigger>
                <TabsTrigger value="annual">Annual Billing <Badge className="ml-2 bg-green-500 text-white">Save 20%</Badge></TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="monthly" className="mt-8">
              <div className="grid md:grid-cols-3 gap-6">
                <PlanCard 
                  name="Basic" 
                  price="Free"
                  description="Perfect for getting started"
                  features={[
                    "Limited matches per day",
                    "Basic search filters",
                    "Limited messaging",
                    "Access to public profiles",
                    "1 video date per month",
                  ]}
                  limitations={[
                    "No advanced matching algorithm",
                    "No compatibility reports",
                    "No priority support",
                    "Limited visibility in search results",
                  ]}
                  buttonText="Current Plan"
                  buttonAction={() => {}}
                  buttonDisabled={true}
                />
                
                <PlanCard 
                  name="Premium"
                  price="$29.99"
                  period="month"
                  description="Most popular for medical professionals"
                  features={[
                    "Unlimited matches",
                    "Advanced search filters",
                    "Unlimited messaging",
                    "See who liked your profile",
                    "5 video dates per month",
                    "Enhanced profile visibility",
                    "Advanced compatibility reports",
                    "Hide your online status",
                  ]}
                  limitations={[
                    "Standard support response time",
                  ]}
                  buttonText="Upgrade to Premium"
                  buttonAction={() => handleUpgrade("Premium")}
                  highlight={true}
                />
                
                <PlanCard 
                  name="Platinum"
                  price="$49.99"
                  period="month"
                  description="Complete access with priority features"
                  features={[
                    "All Premium features",
                    "Priority in search results",
                    "Unlimited video dates",
                    "Verified profile badge",
                    "Priority customer support",
                    "Compatibility insights with AI",
                    "Relationship coaching sessions",
                    "Exclusive events access",
                  ]}
                  limitations={[]}
                  buttonText="Upgrade to Platinum"
                  buttonAction={() => handleUpgrade("Platinum")}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="annual" className="mt-8">
              <div className="grid md:grid-cols-3 gap-6">
                <PlanCard 
                  name="Basic" 
                  price="Free"
                  description="Perfect for getting started"
                  features={[
                    "Limited matches per day",
                    "Basic search filters",
                    "Limited messaging",
                    "Access to public profiles",
                    "1 video date per month",
                  ]}
                  limitations={[
                    "No advanced matching algorithm",
                    "No compatibility reports",
                    "No priority support",
                    "Limited visibility in search results",
                  ]}
                  buttonText="Current Plan"
                  buttonAction={() => {}}
                  buttonDisabled={true}
                />
                
                <PlanCard 
                  name="Premium"
                  price="$287.90"
                  period="year"
                  originalPrice="$359.88"
                  description="Most popular for medical professionals"
                  features={[
                    "Unlimited matches",
                    "Advanced search filters",
                    "Unlimited messaging",
                    "See who liked your profile",
                    "5 video dates per month",
                    "Enhanced profile visibility",
                    "Advanced compatibility reports",
                    "Hide your online status",
                  ]}
                  limitations={[
                    "Standard support response time",
                  ]}
                  buttonText="Upgrade to Premium"
                  buttonAction={() => handleUpgrade("Premium Annual")}
                  highlight={true}
                />
                
                <PlanCard 
                  name="Platinum"
                  price="$479.90"
                  period="year"
                  originalPrice="$599.88"
                  description="Complete access with priority features"
                  features={[
                    "All Premium features",
                    "Priority in search results",
                    "Unlimited video dates",
                    "Verified profile badge",
                    "Priority customer support",
                    "Compatibility insights with AI",
                    "Relationship coaching sessions",
                    "Exclusive events access",
                  ]}
                  limitations={[]}
                  buttonText="Upgrade to Platinum"
                  buttonAction={() => handleUpgrade("Platinum Annual")}
                />
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="mt-12 mb-6">
            <h2 className="text-2xl font-bold text-center mb-8">Feature Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-4 text-left">Feature</th>
                    <th className="p-4 text-center">Basic</th>
                    <th className="p-4 text-center bg-mediblue-50">Premium</th>
                    <th className="p-4 text-center">Platinum</th>
                  </tr>
                </thead>
                <tbody>
                  <FeatureRow 
                    feature="Daily Matches" 
                    basic="5 per day"
                    premium="Unlimited"
                    platinum="Unlimited + Priority"
                    icon={<Heart size={18} />}
                  />
                  <FeatureRow 
                    feature="Advanced Search Filters" 
                    basic={<X className="mx-auto text-red-500" size={18} />}
                    premium={<CheckCircle2 className="mx-auto text-green-500" size={18} />}
                    platinum={<CheckCircle2 className="mx-auto text-green-500" size={18} />}
                    icon={<Users size={18} />}
                  />
                  <FeatureRow 
                    feature="See Who Likes You" 
                    basic={<X className="mx-auto text-red-500" size={18} />}
                    premium={<CheckCircle2 className="mx-auto text-green-500" size={18} />}
                    platinum={<CheckCircle2 className="mx-auto text-green-500" size={18} />}
                    icon={<Star size={18} />}
                  />
                  <FeatureRow 
                    feature="Video Dates" 
                    basic="1 per month"
                    premium="5 per month"
                    platinum="Unlimited"
                    icon={<Video size={18} />}
                  />
                  <FeatureRow 
                    feature="Messaging" 
                    basic="Limited"
                    premium="Unlimited"
                    platinum="Unlimited + Priority"
                    icon={<MessageSquare size={18} />}
                  />
                  <FeatureRow 
                    feature="Profile Visibility" 
                    basic="Standard"
                    premium="Enhanced"
                    platinum="Maximum"
                    icon={<Users size={18} />}
                  />
                  <FeatureRow 
                    feature="Hide Online Status" 
                    basic={<X className="mx-auto text-red-500" size={18} />}
                    premium={<CheckCircle2 className="mx-auto text-green-500" size={18} />}
                    platinum={<CheckCircle2 className="mx-auto text-green-500" size={18} />}
                    icon={<Shield size={18} />}
                  />
                  <FeatureRow 
                    feature="Verified Badge" 
                    basic={<X className="mx-auto text-red-500" size={18} />}
                    premium={<X className="mx-auto text-red-500" size={18} />}
                    platinum={<CheckCircle2 className="mx-auto text-green-500" size={18} />}
                    icon={<Shield size={18} />}
                  />
                  <FeatureRow 
                    feature="Priority Support" 
                    basic={<X className="mx-auto text-red-500" size={18} />}
                    premium={<X className="mx-auto text-red-500" size={18} />}
                    platinum={<CheckCircle2 className="mx-auto text-green-500" size={18} />}
                    icon={<Bell size={18} />}
                  />
                  <FeatureRow 
                    feature="AI Compatibility Insights" 
                    basic={<X className="mx-auto text-red-500" size={18} />}
                    premium="Basic"
                    platinum="Advanced"
                    icon={<Zap size={18} />}
                  />
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="mt-16 bg-mediblue-50 rounded-lg p-6 border border-mediblue-100">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <div className="md:w-2/3">
                <h3 className="text-xl font-bold text-mediblue-800 flex items-center">
                  <Crown className="mr-2 text-amber-500" size={24} />
                  Special Offer for Healthcare Professionals
                </h3>
                <p className="mt-2 text-gray-600">
                  As a medical professional, you're eligible for an additional 15% discount on any premium plan. 
                  Verify your medical credentials to unlock this exclusive offer.
                </p>
              </div>
              <div className="mt-4 md:mt-0">
                <Button>Verify Credentials</Button>
              </div>
            </div>
          </div>
          
          <div className="mt-12 text-center">
            <h3 className="text-xl font-bold mb-4">Frequently Asked Questions</h3>
            <div className="max-w-3xl mx-auto text-left space-y-6">
              <FaqItem 
                question="How do I change or cancel my subscription?" 
                answer="You can manage your subscription at any time through your account settings. If you decide to cancel, you'll continue to have access to your current plan's features until the end of your billing period."
              />
              <FaqItem 
                question="Is my payment information secure?" 
                answer="Yes, we use industry-standard encryption and security protocols to protect your payment information. We never store your complete credit card details on our servers."
              />
              <FaqItem 
                question="Can I switch between plans?" 
                answer="Absolutely! You can upgrade your plan at any time, with the new benefits taking effect immediately. If you downgrade, the change will be applied at the start of your next billing cycle."
              />
              <FaqItem 
                question="Do you offer refunds?" 
                answer="We offer a 14-day money-back guarantee for new subscriptions. If you're not satisfied with your premium experience within the first 14 days, contact our support team for a full refund."
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

interface PlanCardProps {
  name: string;
  price: string;
  period?: string;
  originalPrice?: string;
  description: string;
  features: string[];
  limitations: string[];
  buttonText: string;
  buttonAction: () => void;
  buttonDisabled?: boolean;
  highlight?: boolean;
}

const PlanCard = ({ 
  name, price, period, originalPrice, description, 
  features, limitations, buttonText, buttonAction, 
  buttonDisabled = false, highlight = false 
}: PlanCardProps) => (
  <Card className={`relative overflow-hidden ${highlight ? 'border-mediblue-300 shadow-lg' : ''}`}>
    {highlight && (
      <div className="absolute top-0 right-0 left-0 bg-mediblue-600 text-white text-center text-sm py-1">
        Most Popular
      </div>
    )}
    
    <CardHeader className={highlight ? 'pt-8' : ''}>
      <CardTitle className="text-xl flex items-center justify-between">
        {name}
        {name === "Platinum" && <Crown className="text-amber-500" size={20} />}
      </CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="mb-6">
        <div className="flex items-end">
          <span className="text-3xl font-bold">{price}</span>
          {period && <span className="text-gray-500 ml-1">/{period}</span>}
        </div>
        {originalPrice && (
          <div className="mt-1 text-sm text-gray-500">
            <span className="line-through">{originalPrice}</span>
            <span className="ml-2 text-green-600 font-medium">Save 20%</span>
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        <div>
          <h4 className="font-medium text-sm mb-2 text-mediblue-700 flex items-center">
            <CheckCircle2 className="mr-1 text-green-500" size={16} />
            Included Features
          </h4>
          <ul className="space-y-2">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start">
                <CheckCircle2 className="mr-2 text-green-500 mt-0.5 shrink-0" size={16} />
                <span className="text-sm text-gray-600">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        
        {limitations.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2 text-red-700 flex items-center">
              <X className="mr-1 text-red-500" size={16} />
              Limitations
            </h4>
            <ul className="space-y-2">
              {limitations.map((limitation, index) => (
                <li key={index} className="flex items-start">
                  <X className="mr-2 text-red-500 mt-0.5 shrink-0" size={16} />
                  <span className="text-sm text-gray-600">{limitation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </CardContent>
    <CardFooter>
      <Button 
        className={`w-full ${highlight ? 'bg-mediblue-600 hover:bg-mediblue-700' : ''}`} 
        onClick={buttonAction}
        disabled={buttonDisabled}
      >
        {buttonText}
      </Button>
    </CardFooter>
  </Card>
);

interface FeatureRowProps {
  feature: string;
  basic: React.ReactNode;
  premium: React.ReactNode;
  platinum: React.ReactNode;
  icon?: React.ReactNode;
}

const FeatureRow = ({ feature, basic, premium, platinum, icon }: FeatureRowProps) => (
  <tr className="border-b border-gray-200">
    <td className="p-4 text-left flex items-center">
      {icon && <span className="mr-2 text-mediblue-600">{icon}</span>}
      {feature}
    </td>
    <td className="p-4 text-center">{basic}</td>
    <td className="p-4 text-center bg-mediblue-50">{premium}</td>
    <td className="p-4 text-center">{platinum}</td>
  </tr>
);

interface FaqItemProps {
  question: string;
  answer: string;
}

const FaqItem = ({ question, answer }: FaqItemProps) => (
  <div className="border-b border-gray-200 pb-4">
    <h4 className="font-medium mb-2">{question}</h4>
    <p className="text-gray-600 text-sm">{answer}</p>
  </div>
);

export default PlanPage;
