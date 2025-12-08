import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Hero from './components/Hero';
import PublicProfile from './components/PublicProfile';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import Testimonials from './components/Testimonials';
import DeveloperStats from './components/DeveloperStats';
import Gamification from './components/Gamification';
import Dashboard from './components/Dashboard';
import Footer from './components/Footer';
import ProposalsList from './components/ProposalsList';
import ProposalCreate from './components/ProposalCreate';
import ProposalDetail from './components/ProposalDetail';

type User = {
  id: string;
  username: string;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  githubId?: string | null;
};

function Header({ user, onLogout }: { user: User | null; onLogout: () => void }) {
  return (
    <header>
      <div className="brand">
        <div className="logo">DG</div>
        <h1>DevGrid</h1>
      </div>
      <div>
        {user ? (
          <div className="flex">
            <div className="small">{user.username}</div>
            <button className="logout" onClick={onLogout} aria-label="Logout">
              Logout
            </button>
          </div>
        ) : (
          <div className="small muted">Not signed in</div>
        )}
      </div>
    </header>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      localStorage.setItem('token', token);
      params.delete('token');
      params.delete('userId');
      const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
      window.history.replaceState({}, document.title, newUrl);
    }

    const stored = localStorage.getItem('token');
    if (stored) {
      setLoading(true);
      axios
        .get('https://api.digitaldevgrid.tech/auth/me', { headers: { Authorization: `Bearer ${stored}` } })
        .then((res) => {
          setUser(res.data.user);
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
    }
  }, []);

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/';
  }

  if (loading) return <div className="app">Loading...</div>;

  // Simple file-based routing: if URL path is /profile/:username render public profile
  const path = window.location.pathname;
  const proposalsListMatch = path === '/proposals' || path === '/proposals/';
  const proposalsCreateMatch = path === '/proposals/create' || path === '/proposals/create/';
  const proposalDetailMatch = path.match(/^\/proposals\/([^\/]+)\/?$/);
  const profileMatch = path.match(/^\/profile\/([^\/]+)\/?$/);
  if (profileMatch) {
    const username = decodeURIComponent(profileMatch[1]);
    return (
      <div className="app">
        <PublicProfile username={username} />
      </div>
    );
  }

  return (
    <div className="app">
      <Header user={user} onLogout={logout} />
      <div className="container">
        {!user ? (
          // Public home and proposals listing
          proposalsCreateMatch ? <div className="card"><div className="small muted">Sign in to create proposals.</div></div> : (proposalsListMatch ? <ProposalsList /> : <Home />)
        ) : (
          // Authenticated user dashboard or proposals routes
          proposalsCreateMatch ? <ProposalCreate /> : proposalDetailMatch ? <ProposalDetail id={proposalDetailMatch[1]} /> : <Dashboard user={user} />
        )}
      </div>
    </div>
  );
}

function Home() {
  return (
    <main>
      <Hero />
      <div className="container">
        <Features />
        <Gamification />
        <DeveloperStats />
        <HowItWorks />
        <Testimonials />
      </div>
      <Footer />
    </main>
  );
}

// Dashboard replaced by modular component in `components/Dashboard.tsx`
