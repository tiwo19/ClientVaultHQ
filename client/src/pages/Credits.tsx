import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Coins, CreditCard, ArrowUpRight, ArrowDownRight, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { fetchCredits, fetchCreditTransactions, createCheckoutSession, verifyCheckoutSession } from "@/lib/api";
import { format } from "date-fns";
import { toast } from "sonner";

const CREDITS_PER_DOLLAR = 100;

interface CreditTransaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  description: string;
  stripePaymentIntentId: string | null;
  createdAt: string;
}

export default function Credits() {
  const [purchaseAmount, setPurchaseAmount] = useState<number>(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();
  const [location] = useLocation();
  
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const success = searchParams.get('success');
  const sessionId = searchParams.get('session_id');
  const canceled = searchParams.get('canceled');

  const { data: creditsData, refetch: refetchCredits } = useQuery({
    queryKey: ['credits'],
    queryFn: fetchCredits,
  });

  const { data: transactions } = useQuery({
    queryKey: ['creditTransactions'],
    queryFn: fetchCreditTransactions,
  });

  const checkoutMutation = useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create checkout session");
      setIsProcessing(false);
    },
  });

  useEffect(() => {
    if (success === 'true' && sessionId) {
      verifyCheckoutSession(sessionId)
        .then((result) => {
          if (result.success) {
            toast.success(`Successfully added ${result.added} credits!`);
            refetchCredits();
            queryClient.invalidateQueries({ queryKey: ['creditTransactions'] });
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }
        })
        .catch(console.error);
    } else if (canceled === 'true') {
      toast.error("Purchase was canceled");
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [success, sessionId, canceled, refetchCredits, queryClient]);

  const handlePurchase = () => {
    if (purchaseAmount < 5 || purchaseAmount > 1000) {
      toast.error("Amount must be between $5 and $1000");
      return;
    }
    setIsProcessing(true);
    checkoutMutation.mutate(purchaseAmount);
  };

  const credits = creditsData?.credits ?? 0;
  const transactionList = (transactions as CreditTransaction[]) || [];

  return (
    <div className="container mx-auto p-6 max-w-4xl" data-testid="page-credits">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground" data-testid="text-page-title">Credits</h1>
        <p className="text-muted-foreground mt-1">Manage your credits for AI-powered features</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current Balance</CardDescription>
            <CardTitle className="text-4xl flex items-center gap-2" data-testid="text-credit-balance">
              <Coins className="h-8 w-8 text-yellow-500" />
              {credits.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Credits are used for AI document analysis and other premium features
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Purchase Credits
            </CardTitle>
            <CardDescription>$1 = {CREDITS_PER_DOLLAR} credits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="number"
                  min={5}
                  max={1000}
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(parseInt(e.target.value) || 0)}
                  data-testid="input-purchase-amount"
                />
                <Button 
                  onClick={handlePurchase}
                  disabled={isProcessing || purchaseAmount < 5 || purchaseAmount > 1000}
                  data-testid="button-purchase-credits"
                >
                  {isProcessing ? "Processing..." : `Buy ${(purchaseAmount * CREDITS_PER_DOLLAR).toLocaleString()} Credits`}
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              {[10, 25, 50, 100].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setPurchaseAmount(amount)}
                  data-testid={`button-preset-${amount}`}
                >
                  ${amount}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Transaction History
          </CardTitle>
          <CardDescription>Your recent credit activity</CardDescription>
        </CardHeader>
        <CardContent>
          {transactionList.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Coins className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No transactions yet</p>
              <p className="text-sm">Purchase credits to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactionList.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  data-testid={`transaction-${tx.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${tx.amount > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {tx.amount > 0 ? (
                        <ArrowDownRight className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{tx.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(tx.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                    </span>
                    <Badge variant="outline" className="ml-2">
                      {tx.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
