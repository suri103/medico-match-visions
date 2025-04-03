
import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Heart, Video, MessageSquare, Star, User, ArrowRight } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-mediblue-800 to-mediblue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 flex flex-col lg:flex-row lg:items-center">
          <div className="lg:w-1/2 mb-10 lg:mb-0 lg:pr-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
              Find Your Perfect Medical Partner
            </h1>
            <p className="text-xl text-blue-100 mb-8">
              MedicoMatch connects doctors with compatible partners for meaningful relationships. Find someone who understands the demands of your profession.
            </p>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <Button 
                className="bg-white text-mediblue-700 hover:bg-blue-50 text-lg px-8 py-6"
                onClick={() => navigate('/matches')}
              >
                <Heart className="mr-2 h-5 w-5" />
                Find Matches
              </Button>
              <Button 
                variant="outline"
                className="border-white text-white hover:bg-mediblue-700 text-lg px-8 py-6"
                onClick={() => navigate('/profile')}
              >
                Create Profile
              </Button>
            </div>
          </div>
          <div className="lg:w-1/2 relative">
            <div className="relative z-10 rounded-xl overflow-hidden shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80" 
                alt="Doctors" 
                className="w-full h-auto rounded-xl"
              />
            </div>
            <div className="absolute -bottom-6 -right-6 w-64 h-64 bg-mediteal-400 rounded-full opacity-30 blur-3xl -z-10"></div>
            <div className="absolute -top-6 -left-6 w-64 h-64 bg-accent rounded-full opacity-20 blur-3xl -z-10"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-mediblue-800 mb-4">Why MedicoMatch Works</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We understand the unique challenges medical professionals face in their personal lives.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-mediblue-100 rounded-full flex items-center justify-center mb-6">
                <Heart className="h-7 w-7 text-mediblue-600" />
              </div>
              <h3 className="text-xl font-bold text-mediblue-800 mb-3">Compatibility Matching</h3>
              <p className="text-gray-600">
                Our algorithm considers your specialty, work schedule, and personal interests to find your ideal match.
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-mediteal-100 rounded-full flex items-center justify-center mb-6">
                <Video className="h-7 w-7 text-mediteal-600" />
              </div>
              <h3 className="text-xl font-bold text-mediblue-800 mb-3">Virtual Dating</h3>
              <p className="text-gray-600">
                Connect face-to-face with potential partners through our secure video calling platform.
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-accent-light rounded-full flex items-center justify-center mb-6">
                <Star className="h-7 w-7 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-mediblue-800 mb-3">Astrological Insights</h3>
              <p className="text-gray-600">
                Get personalized compatibility readings from our expert astrologers for deeper connections.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Astrologer Promo Section */}
      <section className="py-20 bg-gradient-to-r from-indigo-900 to-purple-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center">
            <div className="lg:w-1/2 mb-10 lg:mb-0">
              <h2 className="text-3xl font-bold mb-4">Enhance Your Matching with Astrological Insights</h2>
              <p className="text-lg text-indigo-200 mb-6">
                Our expert astrologers provide personalized compatibility readings to help you find your celestial match.
              </p>
              <Button 
                className="bg-accent hover:bg-accent-dark text-white px-6 py-3 text-lg"
                onClick={() => navigate('/astrologer')}
              >
                Consult an Astrologer <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="lg:w-1/2 lg:pl-16">
              <div className="relative">
                <img 
                  src="https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1887&q=80" 
                  alt="Astrology" 
                  className="rounded-xl shadow-2xl"
                />
                <div className="absolute -bottom-4 -right-4 w-64 h-64 bg-purple-500 rounded-full opacity-20 blur-3xl -z-10"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-mediblue-800 mb-4">Success Stories</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Hear from medical professionals who found love through MedicoMatch.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
              <div className="flex items-center mb-4">
                <img 
                  src="https://randomuser.me/api/portraits/women/45.jpg" 
                  alt="Dr. Sarah" 
                  className="w-14 h-14 rounded-full mr-4"
                />
                <div>
                  <h4 className="font-bold text-mediblue-800">Dr. Sarah J.</h4>
                  <p className="text-sm text-gray-500">Neurologist</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "As a busy neurologist, I never had time to date. MedicoMatch connected me with someone who truly understands my schedule and passion for medicine."
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
              <div className="flex items-center mb-4">
                <img 
                  src="https://randomuser.me/api/portraits/men/32.jpg" 
                  alt="Dr. Michael" 
                  className="w-14 h-14 rounded-full mr-4"
                />
                <div>
                  <h4 className="font-bold text-mediblue-800">Dr. Michael R.</h4>
                  <p className="text-sm text-gray-500">Cardiologist</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "The video dating feature was a game-changer. I could connect with matches during my breaks without leaving the hospital."
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
              <div className="flex items-center mb-4">
                <img 
                  src="https://randomuser.me/api/portraits/women/68.jpg" 
                  alt="Dr. Priya" 
                  className="w-14 h-14 rounded-full mr-4"
                />
                <div>
                  <h4 className="font-bold text-mediblue-800">Dr. Priya T.</h4>
                  <p className="text-sm text-gray-500">Pediatrician</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "The astrological consultation gave me insights about compatibility that I wouldn't have considered. Now I'm happily engaged to a fellow doctor!"
              </p>
            </div>
          </div>
          
          <div className="text-center mt-12">
            <Button 
              variant="outline" 
              className="text-mediblue-600 border-mediblue-300 hover:bg-mediblue-50"
              onClick={() => navigate('/matches')}
            >
              Start Your Success Story <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-white text-lg font-bold mb-4">MedicoMatch</h3>
              <p className="text-gray-400">
                Connecting medical professionals for meaningful relationships.
              </p>
            </div>
            
            <div>
              <h4 className="text-white text-sm font-bold uppercase mb-4">Features</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white">Match Algorithm</a></li>
                <li><a href="#" className="hover:text-white">Video Dating</a></li>
                <li><a href="#" className="hover:text-white">Astrological Insights</a></li>
                <li><a href="#" className="hover:text-white">Secure Messaging</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white text-sm font-bold uppercase mb-4">About</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white">Our Story</a></li>
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white text-sm font-bold uppercase mb-4">Connect</h4>
              <p className="text-gray-400 mb-4">
                Join our community of medical professionals looking for love.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
          
          <div className="mt-12 pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
            <p>© {new Date().getFullYear()} MedicoMatch. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
