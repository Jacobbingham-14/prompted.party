import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Status = 'loading' | 'success' | 'error';

export default function AuthCallback() {
  const [status, setStatus] = useState<Status>('loading');
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase processes the token from the URL hash automatically on client init.
    // We poll for a session to confirm it was established.
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        sessionStorage.removeItem('pendingVerification');
        setStatus('success');
        setTimeout(() => navigate('/'), 2000);
      } else {
        // Give Supabase a moment to process the hash token, then check again
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (retrySession?.user) {
            sessionStorage.removeItem('pendingVerification');
            setStatus('success');
            setTimeout(() => navigate('/'), 2000);
          } else {
            setStatus('error');
          }
        }, 1500);
      }
    };

    checkSession();
  }, [navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Verifying your email...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Email verified!</h1>
          <p className="text-muted-foreground">Taking you to the home page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <XCircle className="w-16 h-16 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold text-foreground">Verification failed</h1>
        <p className="text-muted-foreground">
          This link may be invalid or expired. Try signing in or requesting a new verification email.
        </p>
        <Button onClick={() => navigate('/auth')} className="w-full">
          Back to sign in
        </Button>
      </div>
    </div>
  );
}
