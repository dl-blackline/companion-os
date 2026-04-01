import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { XCircle } from '@phosphor-icons/react/XCircle';
import { ArrowLeft } from '@phosphor-icons/react/ArrowLeft';
import { ArrowsClockwise } from '@phosphor-icons/react/ArrowsClockwise';
import { useStripeFinancialConnections } from '@/hooks/use-stripe-financial-connections';

interface StripeReturnViewProps {
  onNavigateToFinance: () => void;
}

export function StripeReturnView({ onNavigateToFinance }: StripeReturnViewProps) {
  const { completeSession, refresh, loading: refreshing } = useStripeFinancialConnections();
  const [status, setStatus] = useState<'processing' | 'success' | 'canceled' | 'error'>('processing');
  const [message, setMessage] = useState('Completing your bank link...');
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    if (processed) return;
    setProcessed(true);

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id') || sessionStorage.getItem('stripe_fc_session_id');

    if (!sessionId) {
      // User landed here without a session — they cancelled or bookmarked
      setStatus('canceled');
      setMessage('No active bank linking session found.');
      return;
    }

    // Clear the stored session
    sessionStorage.removeItem('stripe_fc_session_id');

    (async () => {
      try {
        await completeSession(sessionId);
        setStatus('success');
        setMessage('Your bank account has been linked successfully.');
      } catch {
        setStatus('error');
        setMessage('Something went wrong completing the link. You can try again from the finance section.');
      }
    })();
  }, [completeSession, processed]);

  const handleGoToFinance = () => {
    window.history.pushState({}, '', '/finance');
    onNavigateToFinance();
  };

  return (
    <div className="settings-panel p-4 md:p-8 max-w-2xl mx-auto">
      <Card className="p-8 text-center space-y-6">
        {status === 'processing' && (
          <>
            <div className="flex justify-center">
              <ArrowsClockwise size={48} className="text-primary animate-spin" />
            </div>
            <p className="text-lg font-semibold">{message}</p>
            <p className="text-sm text-muted-foreground">
              Please wait while we finalize your connection...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center">
              <CheckCircle size={56} weight="fill" className="text-emerald-400" />
            </div>
            <p className="text-xl font-semibold">Bank Account Linked</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Badge variant="default" className="mt-2">Connected</Badge>
            <div className="pt-4">
              <Button onClick={handleGoToFinance} className="gap-2">
                <ArrowLeft size={16} />
                Go to Finance
              </Button>
            </div>
          </>
        )}

        {status === 'canceled' && (
          <>
            <div className="flex justify-center">
              <XCircle size={56} className="text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold">Linking Canceled</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="pt-4">
              <Button onClick={handleGoToFinance} variant="outline" className="gap-2">
                <ArrowLeft size={16} />
                Back to Finance
              </Button>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="flex justify-center">
              <XCircle size={56} className="text-rose-400" />
            </div>
            <p className="text-xl font-semibold">Link Failed</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="pt-4 flex justify-center gap-3">
              <Button onClick={() => void refresh()} variant="outline" disabled={refreshing} className="gap-2">
                <ArrowsClockwise size={16} />
                Retry
              </Button>
              <Button onClick={handleGoToFinance} className="gap-2">
                <ArrowLeft size={16} />
                Back to Finance
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
