
import React, { useState } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

// Support address is deploy-configurable so a staging/prod build never points
// users at an inbox nobody reads (audit L7).
const SUPPORT_EMAIL =
  (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) || 'support@medicomatch.in';

import { 
  HelpCircle, Search, ChevronDown, ChevronUp, Mail, MessageSquare, 
  PhoneCall, FileText, ClipboardCheck, BookOpen, User, Shield 
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

const faqs: FaqItem[] = [
  {
    question: "How do I create a MedicoMatch profile?",
    answer: "To create a profile, click the 'Sign Up' button and follow the registration process. You'll need to provide basic personal information, upload photos, and complete your professional details to enhance matching accuracy. Medical credentials verification is optional but recommended for better matching results.",
    category: "account"
  },
  {
    question: "How does the matching algorithm work?",
    answer: "Our algorithm matches medical professionals based on specialty, location, work schedule compatibility, personal interests, relationship goals, and personality traits. Premium members receive more personalized matches based on deeper compatibility factors like practice philosophy and career ambitions.",
    category: "matching"
  },
  {
    question: "Can I control who sees my profile?",
    // P-CONTROL: this answer matches the real Privacy & Visibility section on
    // the Edit Profile page (profile → public/verified-only/hidden, income →
    // public/verified-only/private). Blocked members never see you, enforced
    // server-side in browse, detail, interests, chat, video dates and contact.
    answer: "Yes — open Edit Profile and use the Privacy & Visibility section. Who can see my profile: everyone, verified members only, or hidden (no one can find you). Who can see my income: everyone, verified members only, or only you. Your phone, email, and documents are never shown on your profile — they unlock only through a contact view. Members you block cannot message you, send interest, or view your profile.",
    category: "privacy"
  },
  {
    question: "How do I set up a video date?",
    answer: "To schedule a video date, go to a match's profile and click the 'Video Date' button. Select an available time slot, add a personal message, and send the invitation. Once accepted, you'll receive a confirmation and a reminder before the scheduled time.",
    category: "features"
  },
  {
    question: "What subscription plans are available?",
    answer: "We offer three plans: Basic (free), Premium (₹1,499/month), and Platinum (₹2,999/month). Premium includes unlimited messaging, advanced filters, and who liked you feature. Platinum adds priority matching, unlimited video dates, and relationship coaching. Annual subscriptions offer a 20% discount.",
    category: "billing"
  },
  {
    question: "How do I cancel my subscription?",
    answer: "To cancel your subscription, go to Account Settings > Membership, then select 'Cancel Subscription.' You'll continue to have access to your current plan's features until the end of your billing period. There are no cancellation fees.",
    category: "billing"
  },
  {
    question: "Is my medical credential information secure?",
    answer: "Yes, we employ enterprise-grade encryption and security protocols to protect your sensitive information. Medical credentials are stored separately from your profile information and are only used for verification purposes. We comply with all relevant data protection regulations.",
    category: "privacy"
  },
  {
    question: "How can I report inappropriate behavior?",
    answer: "If you encounter inappropriate behavior, click the 'Report' button on the user's profile or in the messaging interface. Provide details about the incident, and our moderation team will review it within 24 hours. We take all reports seriously and maintain your anonymity during the investigation.",
    category: "safety"
  },
  {
    question: "Can I change my location for matching?",
    answer: "Yes, you can change your location in your profile settings. This allows you to match with medical professionals in other areas, which is useful if you're planning to relocate or are open to long-distance relationships initially.",
    category: "matching"
  },
  {
    question: "How do I get verified on MedicoMatch?",
    answer: "To get verified, go to Profile > Verification and upload your medical credentials. Our team will review your documents within 48 hours. Verified profiles receive a badge and higher visibility in search results.",
    category: "account"
  },
  {
    question: "What's the difference between likes and matches?",
    answer: "A 'like' is one-way interest in another user. A 'match' occurs when two users like each other, enabling messaging and video dates. Premium members can see who has liked them before deciding to like back.",
    category: "features"
  },
  {
    question: "How can I improve my matching results?",
    answer: "Complete your profile fully, including detailed professional information and personal interests. Upload high-quality photos, verify your credentials, and be active on the platform. Regularly update your preferences and use the advanced filters available to premium members.",
    category: "matching"
  },
];

const HelpPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFaqs, setExpandedFaqs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('faqs');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const toggleFaq = (question: string) => {
    if (expandedFaqs.includes(question)) {
      setExpandedFaqs(expandedFaqs.filter(q => q !== question));
    } else {
      setExpandedFaqs([...expandedFaqs, question]);
    }
  };
  
  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) {
      toast({ title: "Missing information", description: "Please fill in name, email and message.", variant: "destructive" });
      return;
    }
    // M6: real delivery first (rate-limited server inbox); local save is the
    // offline fallback, labelled honestly instead of masquerading as support.
    try {
      const { sendSupportMessage } = await import('@/services/api');
      const r = await sendSupportMessage(contactForm);
      if (r.ok) {
        toast({ title: "Message sent", description: "Our support team will reply within 24 hours on business days." });
        setContactForm({ name: '', email: '', subject: '', message: '' });
        return;
      }
      if (r.error && r.error !== 'no-server') {
        toast({ title: "Could not send", description: r.error, variant: "destructive" });
        return;
      }
    } catch {
      /* fall through to local fallback */
    }
    const prev = JSON.parse(localStorage.getItem('mm:supportMessages') || '[]');
    prev.push({ ...contactForm, at: new Date().toISOString() });
    localStorage.setItem('mm:supportMessages', JSON.stringify(prev.slice(-50)));
    toast({ title: "Message recorded", description: "You appear offline — your message is saved on this device and will need resending once you're back online." });
    setContactForm({ name: '', email: '', subject: '', message: '' });
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setContactForm({
      ...contactForm,
      [name]: value
    });
  };
  
  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = 
      searchTerm === '' || 
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });
  
  const categories = [
    { id: 'all', name: 'All Topics', icon: <HelpCircle size={18} /> },
    { id: 'account', name: 'Account', icon: <User size={18} /> },
    { id: 'matching', name: 'Matching', icon: <Search size={18} /> },
    { id: 'features', name: 'Features', icon: <ClipboardCheck size={18} /> },
    { id: 'billing', name: 'Billing', icon: <FileText size={18} /> },
    { id: 'privacy', name: 'Privacy', icon: <Shield size={18} /> },
    { id: 'safety', name: 'Safety', icon: <Shield size={18} /> },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-mediblue-800 inline-flex items-center">
              <HelpCircle className="mr-3 text-mediblue-600" size={28} />
              Help Center
            </h1>
            <p className="mt-2 text-gray-600 max-w-2xl mx-auto">
              Find answers to common questions or get in touch with our support team.
            </p>
          </div>
          
          <div className="mb-8">
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <Input
                placeholder="Search for help articles..."
                value={searchTerm}
                onChange={handleSearch}
                className="pl-10 py-6 text-lg"
              />
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-center">
              <TabsList className="mb-8">
                <TabsTrigger value="faqs" className="flex items-center">
                  <BookOpen className="mr-2" size={16} />
                  FAQs
                </TabsTrigger>
                <TabsTrigger value="terms" className="flex items-center">
                  <FileText className="mr-2" size={16} />
                  Terms
                </TabsTrigger>
                <TabsTrigger value="privacy" className="flex items-center">
                  <Shield className="mr-2" size={16} />
                  Privacy
                </TabsTrigger>
                <TabsTrigger value="contact" className="flex items-center">
                  <Mail className="mr-2" size={16} />
                  Contact Us
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="faqs">
              <div className="grid md:grid-cols-4 gap-6">
                <div className="md:col-span-1">
                  <Card>
                    <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-3">
                      <CardTitle className="text-base sm:text-lg">Topics</CardTitle>
                    </CardHeader>
                    <CardContent className="p-2 sm:p-0">
                      <nav>
                        <ul className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
                          {categories.map(category => (
                            <li key={category.id} className="shrink-0 md:shrink">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`w-full justify-start text-xs sm:text-sm whitespace-nowrap ${selectedCategory === category.id ? 'bg-mediblue-50 text-mediblue-700 font-semibold' : ''}`}
                                onClick={() => setSelectedCategory(category.id)}
                              >
                                {category.icon}
                                <span className="ml-2">{category.name}</span>
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </nav>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="md:col-span-3">
                  <Card>
                    <CardHeader>
                      <CardTitle>Frequently Asked Questions</CardTitle>
                      <CardDescription>
                        {selectedCategory !== 'all' 
                          ? `Showing questions about ${categories.find(c => c.id === selectedCategory)?.name}`
                          : 'Browse common questions and answers'
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {filteredFaqs.length > 0 ? (
                        filteredFaqs.map((faq, index) => (
                          <div key={index} className="border rounded-lg overflow-hidden">
                            <button
                              className={`w-full px-4 py-3 text-left flex justify-between items-center ${
                                expandedFaqs.includes(faq.question) ? 'bg-mediblue-50' : 'bg-white'
                              }`}
                              onClick={() => toggleFaq(faq.question)}
                            >
                              <span className="font-medium">{faq.question}</span>
                              {expandedFaqs.includes(faq.question) ? (
                                <ChevronUp size={18} />
                              ) : (
                                <ChevronDown size={18} />
                              )}
                            </button>
                            {expandedFaqs.includes(faq.question) && (
                              <div className="px-4 py-3 bg-gray-50 border-t">
                                <p className="text-gray-700">{faq.answer}</p>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12">
                          <HelpCircle className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                          <h3 className="text-lg font-medium">No results found</h3>
                          <p className="text-gray-500 mt-2">Try adjusting your search terms or browse all categories</p>
                          <Button 
                            variant="outline" 
                            className="mt-4"
                            onClick={() => {
                              setSearchTerm('');
                              setSelectedCategory('all');
                            }}
                          >
                            Clear filters
                          </Button>
                        </div>
                      )}
                    </CardContent>
                    
                    <CardFooter className="border-t pt-6">
                      <div className="w-full text-center">
                        <p className="text-gray-600 mb-2">Still need help?</p>
                        <Button 
                          variant="outline" 
                          onClick={() => setActiveTab('contact')}
                          className="flex items-center"
                        >
                          <Mail className="mr-2" size={16} />
                          Contact Support
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="terms">
              <Card>
                <CardHeader>
                  <CardTitle>Terms of Service</CardTitle>
                  <CardDescription>Last updated: {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}. Template — have counsel review before commercial launch.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-slate-700 space-y-4 prose prose-sm max-w-none">
                  <div>
                    <h4 className="font-semibold">1. Eligibility</h4>
                    <p>MedicoMatch is a matrimonial platform for medical and healthcare professionals. You must be at least 21 years (men) or 18 years (women) of age, unmarried, divorced or legally separated, and legally competent to contract under the Indian Contract Act, 1872.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">2. Your account</h4>
                    <p>You are responsible for the accuracy of your biodata and for keeping your credentials confidential. Profiles must represent you truthfully; impersonation of another person or of a registered medical practitioner is prohibited and will result in permanent removal.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">3. Verification</h4>
                    <p>&ldquo;Verified&rdquo; status reflects a review of the documents you submit. It is a good-faith check, not a guarantee of any qualification, employment or marital status. You remain responsible for independently verifying any member before proceeding.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">4. Conduct & safety</h4>
                    <p>Harassment, obscene content, financial solicitation, commercial use, and sharing of other members&apos; contact details without consent are strictly prohibited. Report abuse via the in-app report action; we may suspend accounts pending review.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">5. Membership & payments</h4>
                    <p>Paid plans are billed in INR through Razorpay. Access begins on successful payment and continues for the purchased window. Cancelling stops future charges at period end. Refunds are issued at our discretion and immediately revoke paid access when processed.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">6. Liability</h4>
                    <p>The service is provided &ldquo;as is&rdquo;. We facilitate introductions but do not guarantee matches, and we are not party to any relationship or agreement between members. To the maximum extent permitted by law, our liability is limited to the fees you paid in the preceding three months.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">7. Governing law</h4>
                    <p>These terms are governed by Indian law; courts at Mumbai, Maharashtra have exclusive jurisdiction.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="privacy">
              <Card>
                <CardHeader>
                  <CardTitle>Privacy Policy</CardTitle>
                  <CardDescription>Last updated: {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}. Template — align with your DPDP Act obligations before launch.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-slate-700 space-y-4">
                  <div>
                    <h4 className="font-semibold">What we collect</h4>
                    <p>Account details (name, email), your matrimonial biodata (education, profession, location, community, astrological details you choose to share), photos you upload, verification documents you submit, and messages/interests exchanged with other members.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">What stays private</h4>
                    <p>Your phone number and email are never shown to other members by default. They are revealed only when you choose to share them with a specific member, and each such reveal is metered and logged.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">How we use it</h4>
                    <p>To operate matching and chat, verify professional credentials, process payments via Razorpay, send transactional emails (verification, password resets), keep the platform safe (abuse reports, suspension), and comply with legal requests.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">Storage & security</h4>
                    <p>Data is stored in an encrypted Postgres database hosted in India. Passwords are stored only as salted hashes. Administrative actions on your data are audit-logged.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">Your rights</h4>
                    <p>Under the Digital Personal Data Protection Act, 2023 you may request access, correction, or erasure of your data, and withdraw consent by deleting your account. Write to <span className="font-medium">{SUPPORT_EMAIL}</span>; we respond within 30 days.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold">Contact</h4>
                    <p>Grievance officer matters go to <span className="font-medium">{SUPPORT_EMAIL}</span>.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contact">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Mail className="mr-2 text-mediblue-600" size={20} />
                        Email Support
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 text-sm mb-4">
                        Send us an email and we'll respond within 24 hours on business days.
                      </p>
                      <a
                        href={`mailto:${SUPPORT_EMAIL}`}
                        className="text-mediblue-600 hover:text-mediblue-800 font-medium"
                      >
                        {SUPPORT_EMAIL}
                      </a>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <PhoneCall className="mr-2 text-mediblue-600" size={20} />
                        Phone Support
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 text-sm mb-4">
                        Phone support launches with premium memberships — the number will be published here.
                      </p>
                      <span className="text-slate-500 font-medium text-sm">
                        Coming soon
                      </span>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <MessageSquare className="mr-2 text-mediblue-600" size={20} />
                        Live Chat
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 text-sm mb-4">
                        Chat with our support team for immediate assistance.
                      </p>
                      <Button onClick={() => { toast({ title: "Opening live chat", description: "Start a conversation with your matches to resolve questions together." }); void navigate('/messages'); }}>Start Live Chat</Button>
                    </CardContent>
                  </Card>
                </div>
                
                <div className="md:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Contact Form</CardTitle>
                      <CardDescription>
                        Send us a message and we'll get back to you as soon as possible.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleContactSubmit} className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="name" className="block text-sm font-medium mb-1">
                              Full Name
                            </label>
                            <Input 
                              id="name" 
                              name="name"
                              value={contactForm.name}
                              onChange={handleInputChange}
                              required 
                            />
                          </div>
                          <div>
                            <label htmlFor="email" className="block text-sm font-medium mb-1">
                              Email Address
                            </label>
                            <Input 
                              id="email" 
                              name="email"
                              type="email"
                              value={contactForm.email}
                              onChange={handleInputChange}
                              required 
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label htmlFor="subject" className="block text-sm font-medium mb-1">
                            Subject
                          </label>
                          <Input 
                            id="subject" 
                            name="subject"
                            value={contactForm.subject}
                            onChange={handleInputChange}
                            required 
                          />
                        </div>
                        
                        <div>
                          <label htmlFor="message" className="block text-sm font-medium mb-1">
                            Message
                          </label>
                          <Textarea 
                            id="message" 
                            name="message"
                            value={contactForm.message}
                            onChange={handleInputChange}
                            required
                            className="min-h-[150px]"
                          />
                        </div>
                        
                        <Button type="submit" className="w-full md:w-auto">
                          Send Message
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default HelpPage;
