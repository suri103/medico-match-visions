
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CreditCard, Lock } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceName: string;
  amount: number;
  onSuccess: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  serviceName,
  amount,
  onSuccess
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false);
      onSuccess();
    }, 2000);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Payment</DialogTitle>
          <DialogDescription>
            You're paying for: {serviceName} (₹{amount.toFixed(2)})
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <RadioGroup 
                defaultValue={paymentMethod} 
                onValueChange={setPaymentMethod}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-2 border rounded-md p-3 cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="card" id="card" />
                  <Label htmlFor="card" className="flex items-center cursor-pointer">
                    <CreditCard className="mr-2 h-5 w-5 text-mediblue-500" />
                    Credit/Debit Card
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-md p-3 cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="upi" id="upi" />
                  <Label htmlFor="upi" className="cursor-pointer">UPI Payment</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-md p-3 cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="netbanking" id="netbanking" />
                  <Label htmlFor="netbanking" className="cursor-pointer">Net Banking</Label>
                </div>
              </RadioGroup>
            </div>
            
            {paymentMethod === 'card' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <Input id="cardNumber" placeholder="1234 5678 9012 3456" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiry">Expiry Date</Label>
                    <Input id="expiry" placeholder="MM/YY" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvv">CVV</Label>
                    <Input id="cvv" placeholder="123" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Cardholder Name</Label>
                  <Input id="name" placeholder="John Doe" />
                </div>
              </div>
            )}
            
            {paymentMethod === 'upi' && (
              <div className="space-y-2">
                <Label htmlFor="upiId">UPI ID</Label>
                <Input id="upiId" placeholder="yourname@upi" />
              </div>
            )}
            
            {paymentMethod === 'netbanking' && (
              <div className="space-y-2">
                <Label htmlFor="bank">Select Bank</Label>
                <select className="w-full rounded-md border border-gray-300 p-2">
                  <option>HDFC Bank</option>
                  <option>ICICI Bank</option>
                  <option>State Bank of India</option>
                  <option>Axis Bank</option>
                  <option>Other Banks</option>
                </select>
              </div>
            )}
            
            <div className="flex items-center text-sm text-gray-500">
              <Lock className="mr-1 h-4 w-4" />
              Secure payment powered by Stripe. Your payment information is encrypted.
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Processing...
                </>
              ) : (
                `Pay ₹${amount.toFixed(2)}`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
