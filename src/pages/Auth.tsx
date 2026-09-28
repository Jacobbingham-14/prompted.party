import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';
import { Mail } from 'lucide-react';

interface AuthProps {
  onAuthSuccess?: (user: User) => void;
}

type AuthView = 'email' | 'check-email' | 'no-account';

// Survives a refresh while the host goes to fetch the email.
const PENDING_EMAIL_KEY = 'pendingSignInEmail';

/**
 * Passwordless sign-in. The email contains both a sign-in button (signs in
 * whichever device opens it) and a one-time code (for signing in a different
 * device, e.g. reading email on a phone but hosting from a laptop).
 *
 * Accounts are only created by buying the game (stripe-webhook creates them
 * from the checkout email), so an unknown email is told to buy instead.
 */
export default function Auth({ onAuthSuccess }: AuthProps) {
  const [view, setView] = useState<AuthView>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const getRedirectPath = () => {
    const next = searchParams.get('next');
    if (next === 'host') return '/?mode=host';
    return '/';
  };

  useEffect(() => {
    const finish = (user: User) => {
      sessionStorage.removeItem(PENDING_EMAIL_KEY);
      onAuthSuccess?.(user);
      navigate(getRedirectPath());
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) finish(session.user);
    });

    // Clicking the email button in another tab of this browser signs this tab
    // in too, so move on without making them type the code.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) finish(session.user);
    });

    const pending = sessionStorage.getItem(PENDING_EMAIL_KEY);
    if (pending) {
      setEmail(pending);
      setView('check-email');
    }

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendEmail = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      // Supabase reports an unknown email as "signups not allowed" when
      // shouldCreateUser is false (or sign-ups are off project-wide).
      if (error && (error.code === 'otp_disabled' || error.code === 'signup_disabled')) {
        sessionStorage.removeItem(PENDING_EMAIL_KEY);
        setView('no-account');
        return;
      }
      if (error) throw error;
      sessionStorage.setItem(PENDING_EMAIL_KEY, email.trim());
      setCode('');
      setView('check-email');
    } catch (error) {
      toast({
        title: "Couldn't send the email",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    sendEmail();
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
      if (error) throw error;
      // onAuthStateChange handles the redirect.
      toast({ title: "You're signed in!" });
    } catch (error) {
      toast({
        title: "That code didn't work",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (view === 'no-account') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">No account for that email</h1>
            <p className="text-muted-foreground">
              We couldn't find an account for <strong>{email.trim()}</strong>. Accounts are created when
              you buy the game — it's a one-time $19.99 for all four game modes.
            </p>
          </div>
          <Button onClick={() => navigate('/?mode=host')} className="w-full h-12 text-lg">
            Buy the game
          </Button>
          <div className="space-y-2">
            <button
              onClick={() => setView('email')}
              className="text-sm text-muted-foreground hover:text-foreground block w-full"
            >
              Try a different email
            </button>
            <p className="text-sm text-muted-foreground">
              Already paid? Use the email you entered at checkout.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'check-email') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Check your email</h1>
            <p className="text-muted-foreground">
              We sent an email to <strong>{email}</strong>. Tap the button in it to sign in, or type the code here.
            </p>
          </div>
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="Code from the email"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              required
              className="h-12 text-lg text-center tracking-[0.3em]"
            />
            <Button type="submit" className="w-full h-12 text-lg" disabled={loading || code.length < 6}>
              {loading ? 'Checking...' : 'Sign in'}
            </Button>
          </form>
          <div className="space-y-2">
            <button
              onClick={sendEmail}
              disabled={loading}
              className="text-sm text-muted-foreground hover:text-foreground block w-full"
            >
              Didn't get it? Send another email
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem(PENDING_EMAIL_KEY);
                setView('email');
              }}
              className="text-sm text-muted-foreground hover:text-foreground block w-full"
            >
              Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Host Sign In</h1>
          <p className="text-muted-foreground">
            No password needed. Enter the email you bought the game with and we'll send you a sign-in link.
          </p>
        </div>

        <form onSubmit={handleSendEmail} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="h-12 text-lg"
          />
          <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
            {loading ? 'Sending...' : 'Email me a sign-in link'}
          </Button>
        </form>

        <div className="text-center pt-4">
          <Button variant="outline" onClick={() => navigate('/')} className="w-full">
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
