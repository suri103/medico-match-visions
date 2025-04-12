
import React, { useState } from 'react';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Trophy, Search, Heart, MessageSquare, Share2, Filter 
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const successStories = [
  {
    id: "story1",
    title: "Found my perfect match after just 3 months!",
    content: "I was skeptical at first, but MedicoMatch's algorithm really works. I matched with Dr. Sarah, who's also a cardiologist, and we hit it off immediately. Our shared understanding of the medical profession made dating so much easier. We've been together for a year now and recently got engaged!",
    date: "April 2, 2025",
    author: {
      name: "Dr. Michael Chen",
      image: "https://randomuser.me/api/portraits/men/32.jpg",
      specialty: "Cardiologist",
      location: "Boston, MA"
    },
    partner: {
      name: "Dr. Sarah Johnson",
      image: "https://randomuser.me/api/portraits/women/44.jpg",
      specialty: "Cardiologist",
      location: "Boston, MA"
    },
    likes: 245,
    comments: 38,
    featured: true,
    tags: ["Engagement", "Same Specialty", "Same City"]
  },
  {
    id: "story2",
    title: "Long-distance relationship that worked out beautifully",
    content: "MedicoMatch brought us together despite being in different states. The video date feature helped us maintain our connection despite our busy schedules and distance. After a year of long-distance, I finally moved to be with her, and now we run a joint practice together. Thank you MedicoMatch for finding me not just a partner, but also the perfect professional collaborator!",
    date: "March 15, 2025",
    author: {
      name: "Dr. James Wilson",
      image: "https://randomuser.me/api/portraits/men/52.jpg",
      specialty: "Orthopedic Surgeon",
      location: "Chicago, IL"
    },
    partner: {
      name: "Dr. Aisha Patel",
      image: "https://randomuser.me/api/portraits/women/67.jpg",
      specialty: "Physical Therapist",
      location: "Denver, CO"
    },
    likes: 189,
    comments: 27,
    featured: true,
    tags: ["Marriage", "Long Distance", "Joint Practice"]
  },
  {
    id: "story3",
    title: "Our daily schedules finally align!",
    content: "As healthcare professionals, we've always struggled with dating people who didn't understand our erratic schedules. Meeting another doctor who gets it has been life-changing. We've been dating for 6 months now and have never been happier. Being able to talk about work without needing to explain everything is such a relief.",
    date: "March 10, 2025",
    author: {
      name: "Dr. Emily Rodriguez",
      image: "https://randomuser.me/api/portraits/women/28.jpg",
      specialty: "Dermatologist",
      location: "Miami, FL"
    },
    partner: {
      name: "Dr. Alex Thompson",
      image: "https://randomuser.me/api/portraits/men/78.jpg",
      specialty: "Emergency Medicine",
      location: "Miami, FL"
    },
    likes: 157,
    comments: 19,
    featured: false,
    tags: ["Dating", "Same City", "Work-Life Balance"]
  },
  {
    id: "story4",
    title: "Wedding bells and hospital rounds!",
    content: "I never thought I'd meet my spouse on a dating app, but here we are! After matching on MedicoMatch two years ago, we're now married and expecting our first child. Understanding each other's career demands has been crucial to our relationship success. We even managed to coordinate our hospital rotations to maximize our time together.",
    date: "February 22, 2025",
    author: {
      name: "Dr. David Kim",
      image: "https://randomuser.me/api/portraits/men/21.jpg",
      specialty: "Pediatrician",
      location: "Seattle, WA"
    },
    partner: {
      name: "Dr. Jessica Lee",
      image: "https://randomuser.me/api/portraits/women/54.jpg",
      specialty: "OB/GYN",
      location: "Seattle, WA"
    },
    likes: 312,
    comments: 54,
    featured: true,
    tags: ["Marriage", "Same Hospital", "Expecting"]
  },
];

const SuccessStoriesPage = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("latest");
  const [filterTag, setFilterTag] = useState("all");
  
  const handleLike = (id: string) => {
    toast({
      title: "Story liked",
      description: "You've liked this success story.",
    });
  };
  
  const handleComment = (id: string) => {
    toast({
      title: "Add a comment",
      description: "Comment feature will be available soon!",
    });
  };
  
  const handleShare = (id: string) => {
    toast({
      title: "Share success story",
      description: "Sharing options will be available soon!",
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Success story submitted",
      description: "Your story has been submitted for review.",
    });
  };
  
  const allTags = Array.from(new Set(successStories.flatMap(story => story.tags)));
  
  const filteredStories = successStories.filter(story => {
    const matchesSearch = 
      story.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      story.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      story.author.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      story.author.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
      story.partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      story.partner.specialty.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesFilter = filterTag === "all" || story.tags.includes(filterTag);
    
    const matchesTab = 
      activeTab === "all" || 
      (activeTab === "featured" && story.featured);
      
    return matchesSearch && matchesFilter && matchesTab;
  });
  
  const sortedStories = [...filteredStories].sort((a, b) => {
    if (sortBy === "latest") {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    } else if (sortBy === "oldest") {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    } else if (sortBy === "popular") {
      return b.likes - a.likes;
    }
    return 0;
  });

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
            <h1 className="text-2xl md:text-3xl font-bold text-mediblue-800 flex items-center">
              <Trophy className="mr-3 text-amber-500" size={28} />
              Success Stories
            </h1>
            
            <div className="flex flex-col md:flex-row gap-4 w-full lg:w-auto">
              <div className="relative w-full md:w-auto flex-grow">
                <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                <Input
                  placeholder="Search success stories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full md:w-[250px]"
                />
              </div>
              
              <div className="flex gap-2 w-full md:w-auto">
                <Select defaultValue={filterTag} onValueChange={setFilterTag}>
                  <SelectTrigger className="w-full md:w-[150px]">
                    <SelectValue placeholder="Filter by tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tags</SelectItem>
                    {allTags.map(tag => (
                      <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select defaultValue={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full md:w-[150px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="latest">Latest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <div className="mb-8">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList>
                <TabsTrigger value="all">All Stories</TabsTrigger>
                <TabsTrigger value="featured">Featured</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          {sortedStories.length > 0 ? (
            <div className="grid lg:grid-cols-2 gap-6">
              {sortedStories.map((story) => (
                <Card key={story.id} className={`overflow-hidden ${story.featured ? 'border-amber-200 bg-amber-50/30' : ''}`}>
                  {story.featured && (
                    <div className="bg-amber-500 text-white px-4 py-1 text-xs font-medium text-center">
                      Featured Story
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <CardTitle className="text-xl">{story.title}</CardTitle>
                      <div className="text-sm text-gray-500">{story.date}</div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      {story.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="bg-mediblue-50 text-mediblue-700 hover:bg-mediblue-100">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Avatar className="h-10 w-10 border-2 border-mediblue-100">
                          <AvatarImage src={story.author.image} alt={story.author.name} />
                          <AvatarFallback>{story.author.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="ml-3">
                          <div className="font-medium text-sm">{story.author.name}</div>
                          <div className="text-xs text-gray-500">{story.author.specialty}, {story.author.location}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <Heart className="text-red-500 mr-1" size={16} />
                        <div className="text-sm font-medium">{story.likes}</div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="flex items-center justify-center my-4">
                      <Avatar className="h-16 w-16 border-2 border-mediblue-100">
                        <AvatarImage src={story.author.image} alt={story.author.name} />
                        <AvatarFallback>{story.author.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="mx-3 text-red-500">
                        <Heart fill="currentColor" size={24} />
                      </div>
                      <Avatar className="h-16 w-16 border-2 border-mediblue-100">
                        <AvatarImage src={story.partner.image} alt={story.partner.name} />
                        <AvatarFallback>{story.partner.name[0]}</AvatarFallback>
                      </Avatar>
                    </div>
                    
                    <p className="text-gray-700 mt-4">{story.content}</p>
                  </CardContent>
                  
                  <CardFooter className="flex justify-between pt-2">
                    <Button variant="ghost" size="sm" onClick={() => handleLike(story.id)}>
                      <Heart size={18} className="mr-1" />
                      Like
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleComment(story.id)}>
                      <MessageSquare size={18} className="mr-1" />
                      Comment ({story.comments})
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleShare(story.id)}>
                      <Share2 size={18} className="mr-1" />
                      Share
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="pt-10 pb-10 text-center">
                <Trophy className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <CardTitle className="text-xl mb-2">No stories found</CardTitle>
                <CardDescription>
                  No success stories match your current filters. Try adjusting your search or browse all stories.
                </CardDescription>
                <Button 
                  className="mt-6" 
                  onClick={() => {
                    setSearchTerm('');
                    setFilterTag('all');
                    setActiveTab('all');
                  }}
                >
                  View All Stories
                </Button>
              </CardContent>
            </Card>
          )}
          
          <Card className="mt-10 bg-mediblue-50 border-mediblue-100">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Heart className="mr-2 text-red-500" size={20} />
                Share Your Success Story
              </CardTitle>
              <CardDescription>
                Found your match on MedicoMatch? We'd love to hear about it! Share your story to inspire others.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="storyTitle" className="block text-sm font-medium mb-1">
                    Title
                  </label>
                  <Input id="storyTitle" placeholder="Give your story a title" />
                </div>
                <div>
                  <label htmlFor="storyContent" className="block text-sm font-medium mb-1">
                    Your Story
                  </label>
                  <textarea
                    id="storyContent"
                    className="w-full p-3 border rounded-md min-h-[150px]"
                    placeholder="Tell us how you met your match and what made it special..."
                  />
                </div>
                <div className="pt-2">
                  <Button type="submit">Submit Your Story</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default SuccessStoriesPage;
