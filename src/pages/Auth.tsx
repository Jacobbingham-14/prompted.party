import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';
import { Mail } from 'lucide-react';

interface AuthProps {
  onAuthSuccess?: (user: User) => void;
}

type AuthView = 'form' | 'pending-verification' | 'forgot-password' | 'reset-sent';

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [view, setView] = useState<AuthView>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        if (onAuthSuccess) {
          onAuthSuccess(session.user);
        }
        navigate('/');
      }
    });

    // Restore pending verification state across page refreshes
    const pending = sessionStorage.getItem('pendingVerification');
    if (pending) {
      setEmail(pending);
      setView('pending-verification');
    }
  }, [navigate, onAuthSuccess]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;

        // Show verification pending screen
        sessionStorage.setItem('pendingVerification', email);
        setView('pending-verification');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          sessionStorage.removeItem('pendingVerification');
          toast({ title: 'Welcome back!' });
          if (onAuthSuccess) {
            onAuthSuccess(data.user);
          }
          navigate('/');
        }
      }
    } catch (error: any) {
      toast({
        title: isSignUp ? 'Sign up failed' : 'Login failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      toast({ title: 'Verification email resent!', description: 'Check your inbox.' });
    } catch (error: any) {
      toast({ title: 'Failed to resend', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setView('reset-sent');
    } catch (error: any) {
      toast({ title: 'Failed to send reset email', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Pending email verification screen
  if (view === 'pending-verification') {
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
              We sent a verification link to <strong>{email}</strong>. Click the link to activate your account.
            </p>
          </div>
          <Button
            onClick={handleResendVerification}
            variant="outline"
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Resend verification email'}
          </Button>
          <button
            onClick={() => {
              sessionStorage.removeItem('pendingVerification');
              setView('form');
              setIsSignUp(false);
            }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  // Forgot password screen
  if (view === 'forgot-password') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">Reset password</h1>
            <p className="text-muted-foreground">
              Enter your email and we'll send you a reset link.
            </p>
          </div>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 text-lg"
            />
            <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
              {loading ? 'Sending...' : 'Send reset link'}
            </Button>
          </form>
          <div className="text-center">
            <button
              onClick={() => setView('form')}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Reset email sent confirmation
  if (view === 'reset-sent') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Reset link sent</h1>
            <p className="text-muted-foreground">
              Check your email at <strong>{email}</strong> for a password reset link.
            </p>
          </div>
          <button
            onClick={() => setView('form')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  // Main sign in / sign up form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {isSignUp ? 'Create Host Account' : 'Host Login'}
          </h1>
          <p className="text-muted-foreground">
            {isSignUp
              ? 'Sign up to host and manage games'
              : 'Log in to host a game'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-12 text-lg"
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="h-12 text-lg"
          />
          <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Log In'}
          </Button>
        </form>

        <div className="text-center space-y-2">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-muted-foreground hover:text-foreground block w-full"
          >
            {isSignUp
              ? 'Already have an account? Log in'
              : "Don't have an account? Sign up"}
          </button>
          {!isSignUp && (
            <button
              onClick={() => setView('forgot-password')}
              className="text-sm text-muted-foreground hover:text-foreground block w-full"
            >
              Forgot password?
            </button>
          )}
        </div>

        <div className="text-center pt-4">
          <Button variant="outline" onClick={() => navigate('/')} className="w-full">
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
