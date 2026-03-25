import { Navigate, Route, Routes, Link, useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth";

function Shell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const dashboardPath = user?.role === "admin" ? "/admin" : "/dashboard";
  const dashboardLabel = user?.role === "admin" ? "Admin Panel" : "My Dashboard";
  return (
    <div className="page-shell">
      <header className="topbar">
        <div className="brand-block">
          <Link className="brand" to="/">
            <span>Golf</span>
            <span>for Good</span>
          </Link>
          <p className="brand-note">Track scores, support charities, enter monthly prize draws.</p>
        </div>
        <nav className="topnav">
          <div className="nav-links nav-links-main">
            <Link className="nav-link" to="/">Home</Link>
            <Link className="nav-link" to="/charities">Charities</Link>
          </div>
          <span className="nav-divider" />
          <div className="nav-links nav-links-account">
            {user ? (
              <>
                <Link className="nav-link" to={dashboardPath}>{dashboardLabel}</Link>
                <button
                  className="ghost-button"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link className="nav-link" to="/login">Login</Link>
                <Link className="cta-link" to="/signup">
                  Start Subscription
                </Link>
              </>
            )}
          </div>
        </nav>
        {user ? <span className="nav-status">Signed in as {user.role}</span> : <span className="nav-status">Charity-first golf subscription platform</span>}
      </header>
      {children}
    </div>
  );
}

function PublicHome() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.getHome().then(setData).catch(() => {});
  }, []);

  const featured = data?.featuredCharity;

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Subscription golf, monthly rewards, real-world impact</p>
          <h1>Track your last 5 rounds. Fund a cause. Enter every monthly draw.</h1>
          <p className="lede">
            A modern golf subscription platform designed around charitable giving first, with Stableford score
            tracking, winner verification, and a monthly draw engine built in.
          </p>
          <div className="hero-actions">
            <Link className="primary-button" to="/signup">
              Start Subscription
            </Link>
            <Link className="secondary-button" to="/charities">
              Explore Charities
            </Link>
          </div>
          <div className="hero-mini-grid">
            <div className="mini-panel">
              <span>1</span>
              <p>Choose a charity when you join</p>
            </div>
            <div className="mini-panel">
              <span>2</span>
              <p>Log your latest 5 Stableford scores</p>
            </div>
            <div className="mini-panel">
              <span>3</span>
              <p>Enter the next monthly reward draw</p>
            </div>
          </div>
        </div>
        <div className="hero-side">
          <div className="hero-card">
            <div className="metric">
              <span>Active subscribers</span>
              <strong>{data?.metrics.activeSubscribers ?? "--"}</strong>
            </div>
            <div className="metric">
              <span>Current jackpot rollover</span>
              <strong>${data?.metrics.currentJackpot ?? "--"}</strong>
            </div>
            <div className="metric">
              <span>Featured charity</span>
              <strong>{featured?.name ?? "Loading..."}</strong>
            </div>
          </div>
          <div className="hero-note-card">
            <p className="eyebrow">What makes it different</p>
            <h3>Designed around impact first</h3>
            <p className="supporting">
              This is not a traditional golf site. The subscription story starts with charity impact, then folds
              score tracking and monthly rewards into one modern member journey.
            </p>
          </div>
        </div>
      </section>

      <section className="impact-band">
        <div className="impact-item">
          <span className="eyebrow">Monthly or yearly</span>
          <strong>Flexible subscription plans</strong>
        </div>
        <div className="impact-item">
          <span className="eyebrow">Score format</span>
          <strong>Latest 5 Stableford rounds only</strong>
        </div>
        <div className="impact-item">
          <span className="eyebrow">Prize model</span>
          <strong>3-match, 4-match, 5-match tiers</strong>
        </div>
        <div className="impact-item">
          <span className="eyebrow">Charity model</span>
          <strong>Minimum 10% contribution</strong>
        </div>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <h2>Draw mechanics</h2>
          <p>Each eligible subscriber enters with their latest five Stableford scores. Monthly draws compare those five numbers against the published result set.</p>
        </article>
        <article className="panel">
          <h2>Prize split</h2>
          <p>5-match winners share 40%, 4-match winners share 35%, and 3-match winners share 25%. If nobody lands all 5, the jackpot rolls forward.</p>
        </article>
      </section>

      <section className="story-grid">
        <article className="panel story-panel">
          <p className="eyebrow">Member journey</p>
          <h2>From signup to draw entry in one clear flow</h2>
          <div className="story-steps">
            <div className="story-step">
              <span>01</span>
              <p>Create your account and choose a charity you want your subscription to support.</p>
            </div>
            <div className="story-step">
              <span>02</span>
              <p>Complete billing and keep your subscription active through Stripe-managed membership.</p>
            </div>
            <div className="story-step">
              <span>03</span>
              <p>Enter and manage your five most recent Stableford scores in the dashboard.</p>
            </div>
            <div className="story-step">
              <span>04</span>
              <p>Wait for the monthly draw, then verify winnings with uploaded proof if you land in a reward tier.</p>
            </div>
          </div>
        </article>
        <article className="panel story-panel accent-panel">
          <p className="eyebrow">Built for trust</p>
          <h2>Admin-controlled publishing, verification, and payout tracking</h2>
          <p>
            Draws can be simulated before publishing, prize tiers are enforced automatically, and winner claims move
            from proof upload to review to payout status.
          </p>
          <div className="hero-actions">
            <Link className="secondary-button" to="/login">Member Login</Link>
            <Link className="primary-button" to="/signup">Become a Subscriber</Link>
          </div>
        </article>
      </section>

      {featured ? (
        <section className="spotlight">
          <img src={featured.image} alt={featured.name} />
          <div>
            <p className="eyebrow">Spotlight charity</p>
            <h2>{featured.name}</h2>
            <p>{featured.description}</p>
            <div className="event-list">
              {(featured.upcomingEvents || [featured.upcomingEvent]).map((eventName) => (
                <span className="event-pill" key={eventName}>{eventName}</span>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function CharitiesPage() {
  const [search, setSearch] = useState("");
  const [charities, setCharities] = useState([]);

  useEffect(() => {
    api.getCharities(search).then(setCharities).catch(() => {});
  }, [search]);

  return (
    <main className="stack">
      <section className="charity-hero">
        <div className="charity-hero-copy">
          <p className="eyebrow">Charity directory</p>
          <h1>Choose a cause, understand the impact, and back it through every subscription cycle.</h1>
          <p className="supporting">
            Each profile below can be selected at signup, supported with a higher contribution percentage later,
            and funded through independent donations beyond gameplay.
          </p>
        </div>
        <div className="charity-hero-stats">
          <div className="metric">
            <span>Listed charities</span>
            <strong>{charities.length}</strong>
          </div>
          <div className="metric">
            <span>What to look for</span>
            <strong>Mission, event, local impact</strong>
          </div>
        </div>
      </section>

      <section className="charity-toolbar">
        <input
          className="input"
          placeholder="Search charities, causes, or locations"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <p className="supporting">Open a charity profile to view supporters, estimated monthly contribution, and upcoming events.</p>
      </section>

      <section className="card-grid">
        {charities.length ? (
          charities.map((charity) => (
            <Link className="charity-card charity-card-strong" key={charity.id} to={`/charities/${charity.slug}`}>
              <img src={charity.image} alt={charity.name} />
              <div className="charity-card-body">
                <div className="charity-card-topline">
                  <span className="eyebrow">{charity.featured ? "Featured charity" : "Charity partner"}</span>
                  <span className="supporting">{charity.location}</span>
                </div>
                  <h2>{charity.name}</h2>
                  <p>{charity.description}</p>
                  <div className="charity-card-footer">
                    <span>{(charity.upcomingEvents || [charity.upcomingEvent]).join(" | ")}</span>
                    <span>View profile</span>
                  </div>
                </div>
              </Link>
          ))
        ) : (
          <article className="panel">
            <h2>No charities matched your search</h2>
            <p>Try another location, cause keyword, or charity name.</p>
          </article>
        )}
      </section>
    </main>
  );
}

function CharityDetailPage() {
  const { slug } = useParams();
  const [charity, setCharity] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getCharityBySlug(slug).then(setCharity).catch((err) => setError(err.message));
  }, [slug]);

  if (error) {
    return <main className="stack"><p className="error-text">{error}</p></main>;
  }

  if (!charity) {
    return <main className="stack"><p>Loading charity profile...</p></main>;
  }

  return (
    <main className="stack">
      <section className="spotlight">
        <img src={charity.image} alt={charity.name} />
          <div>
            <p className="eyebrow">Charity profile</p>
            <h1>{charity.name}</h1>
            <p>{charity.description}</p>
            <p className="supporting">{charity.location}</p>
            <div className="event-list">
              {(charity.upcomingEvents || [charity.upcomingEvent]).map((eventName) => (
                <span className="event-pill" key={eventName}>{eventName}</span>
              ))}
            </div>
          </div>
        </section>
      <section className="dashboard-grid">
        <article className="panel">
          <h2>Community support</h2>
          <p>Active supporters: {charity.supporters}</p>
          <p>Estimated monthly contribution: ${charity.monthlyContribution}</p>
        </article>
        <article className="panel">
          <h2>How this charity fits the platform</h2>
          <p>Subscribers can choose this charity at signup, raise their contribution percentage later, and donate independently from gameplay.</p>
          <div className="hero-actions">
            <Link className="primary-button" to="/signup">Support this charity</Link>
            <Link className="secondary-button" to="/charities">Back to directory</Link>
          </div>
        </article>
      </section>
    </main>
  );
}

function AuthPage({ mode }) {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [charities, setCharities] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    charityId: "",
    charityPercentage: 10,
    planId: "monthly"
  });

  useEffect(() => {
    api.getCharities().then((items) => {
      setCharities(items);
      if (items[0] && !form.charityId) {
        setForm((current) => ({ ...current, charityId: items[0].id }));
      }
    });
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const action = mode === "login" ? login : signup;
      const payload =
        mode === "login"
          ? { email: form.email, password: form.password }
          : form;
      const data = await action(payload);
      navigate(data.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main className="auth-layout">
      <form className="auth-card" onSubmit={onSubmit}>
        <p className="eyebrow">{mode === "login" ? "Welcome back" : "Subscription checkout"}</p>
        <h1>{mode === "login" ? "Access your account" : "Start your membership"}</h1>
        {mode === "signup" ? (
          <input
            className="input"
            placeholder="Full name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        ) : null}
        <input
          className="input"
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <input
          className="input"
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={(event) => setForm({ ...form, password: event.target.value })}
        />
        {mode === "signup" ? (
          <>
            <select
              className="input"
              value={form.planId}
              onChange={(event) => setForm({ ...form, planId: event.target.value })}
            >
              <option value="monthly">Monthly plan</option>
              <option value="yearly">Yearly plan</option>
            </select>
            <select
              className="input"
              value={form.charityId}
              onChange={(event) => setForm({ ...form, charityId: event.target.value })}
            >
              {charities.map((charity) => (
                <option key={charity.id} value={charity.id}>
                  {charity.name}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              min="10"
              max="100"
              value={form.charityPercentage}
              onChange={(event) => setForm({ ...form, charityPercentage: Number(event.target.value) })}
            />
          </>
        ) : null}
        {error ? <p className="error-text">{error}</p> : null}
        <button className="primary-button" type="submit">
          {mode === "login" ? "Login" : "Subscribe now"}
        </button>
        <p className="supporting auth-switch">
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <Link className="auth-inline-link" to={mode === "login" ? "/signup" : "/login"}>
            {mode === "login" ? "Create your account" : "Go to login"}
          </Link>
        </p>
      </form>
      <aside className="auth-aside">
        <h2>Built around impact, not golf cliches.</h2>
        <p>
          The dashboard includes subscription status, rolling score management, charity selection, draw participation,
          winnings, winner verification, and admin controls for the full monthly reward cycle.
        </p>
        <p className="supporting">Demo admin: admin@golfcharity.local / Admin123!</p>
        <p className="supporting">Demo user: alex@golfcharity.local / User123!</p>
      </aside>
    </main>
  );
}

function ProtectedRoute({ children, role }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }
  return children;
}

function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [scoreForm, setScoreForm] = useState({ value: "", playedAt: "" });
  const [proofForm, setProofForm] = useState({ drawId: "", file: null });
  const [donationForm, setDonationForm] = useState({ amount: "", charityId: "" });
  const [charities, setCharities] = useState([]);
  const [profileForm, setProfileForm] = useState({ name: "", charityId: "", charityPercentage: 10 });
  const [searchParams, setSearchParams] = useSearchParams();

  const refresh = () => api.getDashboard().then(setData).catch((err) => setError(err.message));

  useEffect(() => {
    refresh();
    api.getCharities().then(setCharities).catch(() => {});
  }, []);

  useEffect(() => {
    const checkoutState = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");

    if (checkoutState === "success" && sessionId) {
      api
        .confirmStripeCheckout({ sessionId })
        .then((next) => {
          setData(next);
          setSearchParams({});
        })
        .catch((err) => setError(err.message));
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (data?.charity?.id && !donationForm.charityId) {
      setDonationForm((current) => ({ ...current, charityId: data.charity.id }));
    }
    if (data?.profile) {
      setProfileForm({
        name: data.profile.name || "",
        charityId: data.profile.charityId || "",
        charityPercentage: data.profile.charityPercentage || 10
      });
    }
  }, [data]);

  const addScore = async (event) => {
    event.preventDefault();
    try {
      await api.createScore({ value: Number(scoreForm.value), playedAt: scoreForm.playedAt });
      setScoreForm({ value: "", playedAt: "" });
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!data) {
    return <main className="stack"><p>Loading dashboard...</p></main>;
  }

  return (
    <main className="stack">
      <section className="section-header">
        <p className="eyebrow">Subscriber dashboard</p>
        <h1>{data.profile.name}</h1>
          <p className="supporting">
          {data.subscription.status} | renews {data.subscription.renewalDate} | {data.subscription.plan.name}
        </p>
      </section>
      {error ? <p className="error-text">{error}</p> : null}
      <section className="dashboard-grid">
        <article className="panel">
          <h2>Subscription</h2>
          <p>Charity recipient: {data.charity?.name}</p>
          <p>Contribution: {data.profile.charityPercentage}%</p>
          <p>Stripe status: {data.subscription.status}</p>
          <div className="inline-actions">
            <button
              className="primary-button"
              onClick={() =>
                api
                  .createStripeCheckout({ planId: data.subscription.plan.id })
                  .then((session) => {
                    window.location.href = session.url;
                  })
                  .catch((err) => setError(err.message))
              }
            >
              {data.subscription.status === "active" ? "Change billing" : "Start Stripe checkout"}
            </button>
            <button
              className="secondary-button"
              onClick={() =>
                api
                  .createStripePortal()
                  .then((session) => {
                    window.location.href = session.url;
                  })
                  .catch((err) => setError(err.message))
              }
            >
              Open billing portal
            </button>
          </div>
          <p className="supporting">Cancellation and renewal are managed through Stripe so billing status stays in sync.</p>
        </article>
        <article className="panel">
          <h2>Participation</h2>
          <p>Draws entered: {data.participation.drawsEntered}</p>
          <p>Upcoming draw month: {data.participation.upcomingDrawMonth}</p>
          <p>Current eligibility: {data.participation.currentlyEligible ? "Eligible" : "Not eligible yet"}</p>
          <p>Total won: ${data.winnings.totalWon}</p>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>Profile and charity</h2>
          <form
            className="compact-form"
            onSubmit={(event) => {
              event.preventDefault();
              api
                .updateProfile(profileForm)
                .then(setData)
                .catch((err) => setError(err.message));
            }}
          >
            <input
              className="input"
              placeholder="Full name"
              value={profileForm.name}
              onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
            />
            <select
              className="input"
              value={profileForm.charityId}
              onChange={(event) => setProfileForm({ ...profileForm, charityId: event.target.value })}
            >
              {charities.map((charity) => (
                <option key={charity.id} value={charity.id}>
                  {charity.name}
                </option>
              ))}
            </select>
            <input
              className="input"
              type="number"
              min="10"
              max="100"
              value={profileForm.charityPercentage}
              onChange={(event) => setProfileForm({ ...profileForm, charityPercentage: Number(event.target.value) })}
            />
            <button className="primary-button" type="submit">Save profile</button>
          </form>
        </article>
        <article className="panel">
          <h2>Last 5 scores</h2>
          <form className="compact-form" onSubmit={addScore}>
            <input
              className="input"
              type="number"
              min="1"
              max="45"
              placeholder="Stableford score"
              value={scoreForm.value}
              onChange={(event) => setScoreForm({ ...scoreForm, value: event.target.value })}
            />
            <input
              className="input"
              type="date"
              value={scoreForm.playedAt}
              onChange={(event) => setScoreForm({ ...scoreForm, playedAt: event.target.value })}
            />
            <button className="primary-button" type="submit">Save score</button>
          </form>
          <div className="list">
            {data.scores.map((score) => (
              <div className="list-row" key={score.id}>
                <strong>{score.value}</strong>
                <span>{score.playedAt}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="panel">
          <h2>Winner verification</h2>
          <form
            className="compact-form"
            onSubmit={(event) => {
              event.preventDefault();
              api
                .submitVerification(proofForm)
                .then(() => {
                  setProofForm({ drawId: "", file: null });
                  refresh();
                })
                .catch((err) => setError(err.message));
            }}
          >
            <input
              className="input"
              placeholder="Draw ID"
              value={proofForm.drawId}
              onChange={(event) => setProofForm({ ...proofForm, drawId: event.target.value })}
            />
            <input
              className="input"
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.pdf"
              onChange={(event) => setProofForm({ ...proofForm, file: event.target.files?.[0] || null })}
            />
            <button className="primary-button" type="submit">Upload proof</button>
          </form>
          <div className="list">
            {data.winnings.entries.length ? (
              data.winnings.entries.map((entry) => (
                <div className="list-row" key={`${entry.drawId}-${entry.matches}`}>
                  <span>{entry.monthKey} | {entry.matches} matches</span>
                  <span>${entry.amount} | {entry.paymentStatus}</span>
                </div>
              ))
            ) : (
              <p className="supporting">No winnings yet.</p>
            )}
          </div>
        </article>
        <article className="panel">
          <h2>Independent donations</h2>
          <form
            className="compact-form"
            onSubmit={(event) => {
              event.preventDefault();
              api
                .createDonation({ amount: Number(donationForm.amount), charityId: donationForm.charityId })
                .then((next) => {
                  setDonationForm({ amount: "", charityId: next.charity?.id || data.charity?.id || "" });
                  setData(next);
                })
                .catch((err) => setError(err.message));
            }}
          >
            <input
              className="input"
              type="number"
              min="1"
              placeholder="Donation amount"
              value={donationForm.amount}
              onChange={(event) => setDonationForm({ ...donationForm, amount: event.target.value })}
            />
            <input
              className="input"
              placeholder="Charity ID"
              value={donationForm.charityId}
              onChange={(event) => setDonationForm({ ...donationForm, charityId: event.target.value })}
            />
            <button className="primary-button" type="submit">Donate separately</button>
          </form>
          <div className="list">
            <div className="list-row">
              <strong>Total donated</strong>
              <span>${data.donations.total}</span>
            </div>
            {data.donations.entries.map((entry) => (
              <div className="list-row" key={entry.id}>
                <span>{entry.charityId}</span>
                <span>${entry.amount}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

function AdminPage() {
  const [data, setData] = useState(null);
  const [simulated, setSimulated] = useState(null);
  const [mode, setMode] = useState("random");
  const [error, setError] = useState("");
  const [charityForm, setCharityForm] = useState({
    name: "",
    slug: "",
    description: "",
    image: "",
    location: "",
    upcomingEventsText: ""
  });

  const refresh = () => api.getAdminOverview().then(setData);

  useEffect(() => {
    refresh();
  }, []);

  if (!data) {
    return <main className="stack"><p>Loading admin...</p></main>;
  }

  return (
    <main className="stack">
      <section className="section-header">
        <p className="eyebrow">Admin dashboard</p>
        <h1>Operations, draws, payouts, and charity content</h1>
      </section>
      {error ? <p className="error-text">{error}</p> : null}

      <section className="dashboard-grid">
        <article className="panel">
          <h2>Overview</h2>
          <p>Total users: {data.totals.users}</p>
          <p>Active subscribers: {data.totals.activeSubscribers}</p>
          <p>Published draws: {data.totals.publishedDraws}</p>
          <p>Rollover jackpot: ${data.totals.prizeRollover}</p>
        </article>
        <article className="panel">
          <h2>Draw engine</h2>
          <select className="input" value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="random">Random draw</option>
            <option value="algorithmic">Algorithmic draw</option>
          </select>
          <div className="inline-actions">
            <button className="secondary-button" onClick={() => api.simulateDraw(mode).then(setSimulated)}>Simulate</button>
            <button
              className="primary-button"
              onClick={() =>
                api
                  .publishDraw(mode)
                  .then(() => {
                    setError("");
                    refresh();
                  })
                  .catch((err) => setError(err.message))
              }
            >
              Publish
            </button>
          </div>
          <p className="supporting">Only one published draw is allowed per month. Use simulation for pre-analysis.</p>
          {simulated ? (
            <div className="list">
              <div className="list-row">
                <strong>Numbers</strong>
                <span>{simulated.numbers.join(", ")}</span>
              </div>
              <div className="list-row">
                <strong>5 match</strong>
                <span>${simulated.prizeBreakdown.tiers.match5}</span>
              </div>
              <div className="list-row">
                <strong>4 match</strong>
                <span>${simulated.prizeBreakdown.tiers.match4}</span>
              </div>
              <div className="list-row">
                <strong>3 match</strong>
                <span>${simulated.prizeBreakdown.tiers.match3}</span>
              </div>
            </div>
          ) : null}
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>Charity management</h2>
          <form
            className="compact-form"
            onSubmit={(event) => {
              event.preventDefault();
              api.createCharity({
                ...charityForm,
                upcomingEvent: charityForm.upcomingEventsText.split("\n").map((entry) => entry.trim()).filter(Boolean)[0] || "",
                upcomingEvents: charityForm.upcomingEventsText.split("\n").map((entry) => entry.trim()).filter(Boolean)
              }).then(refresh);
            }}
          >
            <input className="input" placeholder="Name" value={charityForm.name} onChange={(event) => setCharityForm({ ...charityForm, name: event.target.value })} />
            <input className="input" placeholder="Slug" value={charityForm.slug} onChange={(event) => setCharityForm({ ...charityForm, slug: event.target.value })} />
            <input className="input" placeholder="Image URL" value={charityForm.image} onChange={(event) => setCharityForm({ ...charityForm, image: event.target.value })} />
            <input className="input" placeholder="Location" value={charityForm.location} onChange={(event) => setCharityForm({ ...charityForm, location: event.target.value })} />
            <textarea className="input textarea" placeholder="Upcoming events, one per line" value={charityForm.upcomingEventsText} onChange={(event) => setCharityForm({ ...charityForm, upcomingEventsText: event.target.value })} />
            <textarea className="input textarea" placeholder="Description" value={charityForm.description} onChange={(event) => setCharityForm({ ...charityForm, description: event.target.value })} />
            <button className="primary-button" type="submit">Add charity</button>
          </form>
          <div className="list">
            {data.charities.map((charity) => {
              const total = data.charityTotals.find((entry) => entry.charityId === charity.id);
              return (
                <form
                  className="compact-form"
                  key={charity.id}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                      api
                        .updateCharity(charity.id, {
                          name: formData.get("name"),
                          slug: formData.get("slug"),
                          image: formData.get("image"),
                          location: formData.get("location"),
                          upcomingEvent: formData.get("upcomingEventsText").split("\n").map((entry) => entry.trim()).filter(Boolean)[0] || "",
                          upcomingEvents: formData.get("upcomingEventsText").split("\n").map((entry) => entry.trim()).filter(Boolean),
                          description: formData.get("description")
                        })
                      .then(() => {
                        setError("");
                        refresh();
                      })
                      .catch((err) => setError(err.message));
                  }}
                >
                    <input className="input" name="name" defaultValue={charity.name} />
                    <input className="input" name="slug" defaultValue={charity.slug} />
                    <input className="input" name="image" defaultValue={charity.image || ""} />
                    <input className="input" name="location" defaultValue={charity.location || ""} />
                    <textarea className="input textarea" name="upcomingEventsText" defaultValue={(charity.upcomingEvents || [charity.upcomingEvent]).filter(Boolean).join("\n")} />
                    <textarea className="input textarea" name="description" defaultValue={charity.description} />
                  <div className="list-row">
                    <span>${total?.total || 0}/month</span>
                    <span className="inline-actions">
                      <button className="secondary-button" type="submit">Save charity</button>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() =>
                          api
                            .deleteCharity(charity.id)
                            .then(() => {
                              setError("");
                              refresh();
                            })
                            .catch((err) => setError(err.message))
                        }
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                </form>
              );
            })}
          </div>
        </article>
        <article className="panel">
          <h2>Winner claims</h2>
          <div className="list">
            {data.winnerClaims.length ? data.winnerClaims.map((claim) => (
              <div className="list-row" key={claim.id}>
                <span>{claim.userId} | {claim.status}</span>
                <span>
                  <a href={claim.proofUrl} target="_blank" rel="noreferrer">
                    {claim.proofFilename || claim.drawId}
                  </a>
                </span>
              </div>
            )) : <p className="supporting">No claims submitted.</p>}
          </div>
        </article>
      </section>

      <section className="panel">
        <h2>Users</h2>
        <div className="list">
          {data.users.map((user) => (
            <div className="compact-form" key={user.id}>
              <form
                className="compact-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  api
                    .updateUser(user.id, {
                      name: formData.get("name"),
                      charityPercentage: Number(formData.get("charityPercentage")),
                      subscriptionStatus: formData.get("subscriptionStatus")
                    })
                    .then(() => {
                      setError("");
                      refresh();
                    })
                    .catch((err) => setError(err.message));
                }}
              >
                <input className="input" name="name" defaultValue={user.name} />
                <div className="list-row">
                  <span>{user.email} | {user.role}</span>
                  <span>{user.charityId || "no-charity"}</span>
                </div>
                <input
                  className="input"
                  name="charityPercentage"
                  type="number"
                  min="10"
                  max="100"
                  defaultValue={user.charityPercentage}
                />
                <select className="input" name="subscriptionStatus" defaultValue={user.subscription.status}>
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="cancelled">cancelled</option>
                  <option value="lapsed">lapsed</option>
                </select>
                <button className="secondary-button" type="submit">Save user</button>
              </form>
              <div className="list">
                {(user.scores || []).map((score) => (
                  <form
                    className="compact-form"
                    key={score.id}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      api
                        .updateUserScore(user.id, score.id, {
                          value: Number(formData.get("value")),
                          playedAt: formData.get("playedAt")
                        })
                        .then(() => {
                          setError("");
                          refresh();
                        })
                        .catch((err) => setError(err.message));
                    }}
                  >
                    <div className="list-row">
                      <input className="input" name="value" type="number" min="1" max="45" defaultValue={score.value} />
                      <input className="input" name="playedAt" type="date" defaultValue={score.playedAt} />
                      <button className="secondary-button" type="submit">Save score</button>
                    </div>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>Published draw winners</h2>
        <div className="list">
          {data.draws.length ? data.draws.flatMap((draw) =>
            draw.winners.map((winner) => {
              const claim = data.winnerClaims.find(
                (entry) => entry.drawId === draw.id && entry.userId === winner.userId
              );
              return (
                <div className="list-row" key={winner.id}>
                  <span>{draw.monthKey} | {winner.userId} | {winner.matches} matches | ${winner.amount}</span>
                  <span className="inline-actions">
                    <button
                      className="secondary-button"
                      onClick={() => claim && api.verifyWinner(winner.id, { claimId: claim.id, status: "approved" }).then(refresh)}
                      disabled={!claim}
                    >
                      Approve
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => claim && api.verifyWinner(winner.id, { claimId: claim.id, status: "rejected" }).then(refresh)}
                      disabled={!claim}
                    >
                      Reject
                    </button>
                    <button className="primary-button" onClick={() => api.payWinner(winner.id).then(refresh)}>
                      Mark paid
                    </button>
                  </span>
                </div>
              );
            })
          ) : <p className="supporting">No draws published yet.</p>}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/charities" element={<CharitiesPage />} />
        <Route path="/charities/:slug" element={<CharityDetailPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute role="subscriber">
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Shell>
  );
}
