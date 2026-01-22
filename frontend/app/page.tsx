"use client";
import { useState, useEffect } from "react";
import { useUser, UserButton, SignInButton } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import { 
  Loader2, Search, FileText, TrendingUp, Zap, CheckCircle, 
  X, LayoutDashboard, Clock, ChevronRight, Menu 
} from "lucide-react";

// History Item Interface
interface HistoryItem {
  id: string; // Database ID
  topic: string;
  report: string;
  sources: string[];
  created_at?: string; // Database timestamp
}

export default function Home() {
  const { isSignedIn, user } = useUser();
  
  // Main States
  const [topic, setTopic] = useState("");
  const [report, setReport] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // History State (Database Data)
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Credits & Tier
  const [credits, setCredits] = useState<number | null>(null);
  const [tier, setTier] = useState("Free");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // 1. Fetch Credits & History on Load
  useEffect(() => {
    if (isSignedIn && user) {
      fetchCredits();
      fetchHistory(); // <--- New Database Call
    }
  }, [isSignedIn, user]);

  // --- API Functions ---

  async function fetchCredits() {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/profile/${user?.id}`);
      if (res.ok) {
        const data = await res.json();
        setCredits(data.credits);
        setTier(data.tier || "Free");
      }
    } catch (error) {
      console.error("Failed to fetch credits", error);
    }
  }

  // New: Get History from Database
  async function fetchHistory() {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/history/${user?.id}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data); // Set database data to state
      }
    } catch (error) {
      console.error("Failed to fetch history", error);
    }
  }

  async function handleUpgrade() {
    try {
      setLoading(true); 
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/create-checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user?.id }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      alert("Payment Error");
    } finally {
      setLoading(false);
    }
  }

  // --- Generate Function (With DB Save) ---
  async function handleGenerate() {
    if (!topic.trim() || topic.length < 5) {
      setError("Please enter at least 5 characters");
      return;
    }
    if (credits !== null && credits <= 0) {
      setShowUpgradeModal(true);
      return;
    }

    setLoading(true);
    setError("");
    setReport("");
    setSources([]);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      
      // 1. Generate Report
      const res = await fetch(`${apiUrl}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic,
          user_id: user?.id || "anonymous",
        }),
      });

      if (!res.ok) {
        if (res.status === 402) {
            setShowUpgradeModal(true);
            throw new Error("Insufficient credits");
        }
        throw new Error("Failed to generate report");
      }

      const data = await res.json();
      const newReport = data.report;
      const newSources = data.sources || [];
      
      setReport(newReport);
      setSources(newSources);
      
      if (data.credits_left !== undefined) setCredits(data.credits_left);

      // 2. SAVE TO DATABASE (Production Logic)
      const historyPayload = {
        user_id: user?.id || "anonymous",
        topic: topic,
        report: newReport,
        sources: newSources
      };

      await fetch(`${apiUrl}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(historyPayload),
      });

      // 3. Refresh List from Database
      fetchHistory();

    } catch (err: any) {
      if (err.message !== "Insufficient credits") {
        setError(err.message || "Error generating report.");
      }
    } finally {
      setLoading(false);
    }
  }

  // History Item Select Logic
  function loadHistoryItem(item: HistoryItem) {
    setTopic(item.topic);
    setReport(item.report);
    setSources(item.sources);
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      
      {/* 1. LEFT SIDEBAR (History) */}
      {isSignedIn && (
        <aside 
          className={`${sidebarOpen ? "w-64" : "w-0"} bg-slate-900 text-white transition-all duration-300 flex flex-col relative overflow-hidden`}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-slate-800 flex items-center gap-2 overflow-hidden">
            <LayoutDashboard className="w-6 h-6 text-indigo-400" />
            <span className="font-bold text-lg whitespace-nowrap">My Research</span>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <p className="text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wider">Recent</p>
            {history.length === 0 && (
              <p className="text-sm text-slate-600 italic">No history yet...</p>
            )}
            {history.map((item) => (
              <button
                key={item.id} // Supabase ID is unique
                onClick={() => loadHistoryItem(item)}
                className="w-full text-left p-3 rounded-lg hover:bg-slate-800 transition group flex items-center justify-between"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <Clock className="w-4 h-4 text-slate-500 group-hover:text-indigo-400" />
                  <span className="text-sm text-slate-300 truncate w-32">{item.topic}</span>
                </div>
                <ChevronRight className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>

          {/* User Profile at Bottom */}
          <div className="p-4 border-t border-slate-800 bg-slate-950">
            <div className="flex items-center gap-3">
              <UserButton afterSignOutUrl="/" />
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{user?.firstName}</p>
                <p className="text-xs text-slate-500 truncate">{tier} Plan</p>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 p-4 flex justify-between items-center shadow-sm z-10">
          <div className="flex items-center gap-3">
            {isSignedIn && (
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 rounded-lg">
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              AI ResearchPro
            </h1>
          </div>

          <div className="flex items-center gap-4">
             {isSignedIn && credits !== null && (
               <div 
                 className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 cursor-pointer hover:bg-indigo-100 transition"
                 onClick={() => setShowUpgradeModal(true)}
               >
                 <Zap className={`w-4 h-4 ${credits > 0 ? 'text-amber-500 fill-amber-500' : 'text-gray-400'}`} />
                 <span className="text-sm font-bold text-indigo-900">{credits} Credits</span>
               </div>
             )}
             {!isSignedIn && (
               <SignInButton mode="modal">
                 <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">Sign In</button>
               </SignInButton>
             )}
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          
          {/* Landing View (If not signed in) */}
          {!isSignedIn ? (
             <div className="max-w-4xl mx-auto text-center mt-20">
                <h2 className="text-4xl font-bold text-gray-900 mb-6">
                  Research Faster. Decide Smarter.
                </h2>
                <p className="text-xl text-gray-600 mb-8">
                  The professional AI tool for deep market research.
                </p>
                <SignInButton mode="modal">
                  <button className="bg-indigo-600 text-white px-8 py-4 rounded-xl text-lg hover:bg-indigo-700 shadow-xl transition">
                    Start Researching Free
                  </button>
                </SignInButton>
             </div>
          ) : (
            // Dashboard View
            <div className="max-w-4xl mx-auto space-y-8 pb-20">
              
              {/* Search Box Area */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-3 ml-1">
                  Research Topic
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => {
                      setTopic(e.target.value);
                      setError("");
                    }}
                    placeholder="e.g. Impact of AI on Digital Marketing 2025"
                    className="flex-1 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg text-gray-900 placeholder-gray-400 bg-gray-50"
                    onKeyPress={(e) => e.key === "Enter" && handleGenerate()}
                    disabled={loading}
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={loading || !topic.trim()}
                    className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition shadow-md flex items-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    {loading ? "Analyzing..." : "Research"}
                  </button>
                </div>
                {error && <p className="text-red-500 text-sm mt-3 ml-1">{error}</p>}
              </div>

              {/* Report Display Area */}
              {report && (
                <div className="bg-white p-8 md:p-12 rounded-2xl shadow-lg border border-gray-100 animate-fade-in">
                  <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                    <h2 className="text-2xl font-bold text-gray-900">{topic}</h2>
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                      Completed
                    </span>
                  </div>
                  
                  <div className="prose prose-indigo max-w-none text-gray-700">
                    <ReactMarkdown>{report}</ReactMarkdown>
                  </div>

                  {sources.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-gray-100">
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        References & Sources
                      </h3>
                      <div className="grid gap-2">
                        {sources.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline truncate bg-indigo-50 px-3 py-2 rounded-lg"
                          >
                            {url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Upgrade Modal (Same as before) */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md relative overflow-hidden">
             <button onClick={() => setShowUpgradeModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
               <X className="w-6 h-6" />
             </button>
             <div className="p-8 text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-indigo-600 fill-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Need more credits?</h2>
                <p className="text-gray-600 mb-6">Upgrade to Pro to continue deep researching.</p>
                <button 
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition"
                >
                  {loading ? "Processing..." : "Get 50 Credits for $10"}
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}