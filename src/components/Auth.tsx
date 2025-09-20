import React, { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { User, UserCheck, X } from 'lucide-react';
import medDigitizeLogo from '@/assets/mediscan-logo.svg';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';

export const Auth: React.FC = () => {
  const { user, signIn, signUp, loading } = useAuth();
  const { toast } = useToast();

  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [signupForm, setSignupForm] = useState({ username: '', password: '', name: '' });
  const [loginStep, setLoginStep] = useState<'username' | 'password'>('username');
  const [showSignup, setShowSignup] = useState(false);

  const usernameRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLoginForm({ username: '', password: '' });
    setSignupForm({ username: '', password: '', name: '' });
  }, []);

  useEffect(() => {
    if (loginStep === 'username') usernameRef.current?.focus();
    if (loginStep === 'password') passwordRef.current?.focus();
  }, [loginStep]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;

  const handleContinueUsername = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loginForm.username?.trim()) {
      toast({ title: 'Error', description: 'Please enter your username', variant: 'destructive' });
      return;
    }
    setLoginStep('password');
  };

  const handleBackToUsername = () => setLoginStep('username');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await signIn(loginForm.username, loginForm.password);
    if (error) toast({ title: 'Error', description: error, variant: 'destructive' });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await signUp(signupForm.username, signupForm.password, signupForm.name);
    if (error) toast({ title: 'Error', description: error, variant: 'destructive' });
    else setShowSignup(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4 login-font">
      <Card className="w-full max-w-md shadow-2xl border-primary/20">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="relative p-4 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full">
              <img src={medDigitizeLogo} alt="MEDiScan AI Logo" className="h-12 w-12 rounded-full" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            MEDiScan AI
          </CardTitle>
          <p className="text-muted-foreground text-sm">Transforming Medical Records.</p>
        </CardHeader>

        <CardContent>
          {loginStep === 'username' ? (
            <form onSubmit={handleContinueUsername} className="space-y-4">
              <h2 className="text-2xl font-semibold text-center">Login</h2>
              <div className="space-y-2 text-left">
                <Label htmlFor="login-username">Username</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 hidden md:flex items-center h-full pointer-events-none text-muted-foreground">
                    <User className="h-4 w-4" />
                  </div>
                  <Input
                    id="login-username"
                    ref={usernameRef}
                    type="text"
                    placeholder="Enter your username"
                    className="pl-3 md:pl-12 h-10 text-sm py-2"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div>
                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 py-2 text-sm">
                  Continue
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <h2 className="text-2xl font-semibold text-center">Login</h2>
              <div className="space-y-2 text-left">
                <Label htmlFor="login-username">Username</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 hidden md:flex items-center h-full text-muted-foreground">
                    <User className="h-4 w-4" />
                  </div>
                  <Input
                    id="login-username"
                    type="text"
                    className="pl-3 md:pl-12 h-10 text-sm py-2"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    autoComplete="off"
                    disabled
                  />
                </div>
              </div>

              <div className="space-y-2 text-left">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 hidden md:flex items-center h-full pointer-events-none text-muted-foreground">
                    <User className="h-4 w-4" />
                  </div>
                  <PasswordInput
                    id="login-password"
                    ref={passwordRef}
                    placeholder="Enter your password..."
                    className="pl-3 md:pl-12 h-10 text-sm py-2"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 py-2 text-sm">
                  Log in
                </Button>
                <Button variant="ghost" onClick={handleBackToUsername} className="text-sm py-2">Back</Button>
              </div>
            </form>
          )}

          <div className="text-center mt-4">
            <button className="text-sm text-primary underline" onClick={() => setShowSignup(true)}>
              Don't have an account? Sign up
            </button>
          </div>
        </CardContent>
      </Card>

      {showSignup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium flex-1 text-center">Sign up</h3>
              <Button variant="ghost" onClick={() => setShowSignup(false)} aria-label="Close sign up">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Full Name</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 hidden md:flex items-center h-full text-muted-foreground">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Dr. John Smith"
                    className="pl-3 md:pl-12 h-10 text-sm py-2"
                    value={signupForm.name}
                    onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                    autoComplete="off"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-username">Username</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center h-full text-muted-foreground">
                    <User className="h-4 w-4" />
                  </div>
                  <Input
                    id="signup-username"
                    type="text"
                    placeholder="Choose a username"
                    className="pl-12 h-10 text-sm py-2"
                    value={signupForm.username}
                    onChange={(e) => setSignupForm({ ...signupForm, username: e.target.value })}
                    autoComplete="off"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <PasswordInput
                  id="signup-password"
                  placeholder="Create a strong password"
                  className="h-10 text-sm py-2"
                  value={signupForm.password}
                  onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                  autoComplete="off"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 py-2 text-sm">
                  Create Account
                </Button>
                <Button variant="ghost" onClick={() => setShowSignup(false)} className="text-sm py-2">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auth;

