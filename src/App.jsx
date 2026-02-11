import React, { useState, useEffect } from 'react';
import './App.css';
import { auth, db } from './firebase'; 
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, query, onSnapshot, doc, setDoc, updateDoc, increment, deleteDoc, arrayUnion } from "firebase/firestore";

function App() {
  // --- Global State ---
  const [view, setView] = useState('landing');
  const [user, setUser] = useState(null); 
  const [mode, setMode] = useState(null); 
  const [lbTab, setLbTab] = useState('runs');

  // --- Data State ---
  const [teams, setTeams] = useState([]); 
  const [history, setHistory] = useState([]);
  const [playerStats, setPlayerStats] = useState([]);

  // --- Live Stats Tracker ---
  const [matchPlayerStats, setMatchPlayerStats] = useState({}); 

  // --- Form Inputs ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  
  // Team Management Inputs
  const [nName, setNName] = useState(""); 
  const [nLogo, setNLogo] = useState(null);
  const [pName, setPName] = useState("");
  const [pRole, setPRole] = useState("Batsman");
  const [selectedTeamId, setSelectedTeamId] = useState(""); 

  // --- Match State ---
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [totalOvers, setTotalOvers] = useState(20);
  const [inning, setInning] = useState(1); 
  const [target, setTarget] = useState(0);
  const [matchResult, setMatchResult] = useState(null); 
  const [winner, setWinner] = useState(null); 
  const [firstInningScore, setFirstInningScore] = useState(null); 
  const [score, setScore] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [balls, setBalls] = useState(0);
  const [overs, setOvers] = useState(0);
  const [currentOver, setCurrentOver] = useState([]); 
  
  // Players (Strings)
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");

  // --- POPUP STATE (New) ---
  const [popup, setPopup] = useState(null); // 'batsman', 'bowler', or null

  // --- 1. Listeners ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setMode('tournament');
        setView('dashboard');
        onSnapshot(query(collection(db, "users", currentUser.uid, "teams")), (snap) => setTeams(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        onSnapshot(query(collection(db, "users", currentUser.uid, "history")), (snap) => setHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b)=>b.timestamp-a.timestamp)));
        onSnapshot(query(collection(db, "users", currentUser.uid, "players")), (snap) => setPlayerStats(snap.docs.map(doc => ({ name: doc.id, ...doc.data() }))));
      } else { setUser(null); }
    });
    return () => unsubscribe();
  }, []);

  // --- 2. Handlers ---
  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isSignup) { await createUserWithEmailAndPassword(auth, email, password); alert("Account created!"); } 
      else { await signInWithEmailAndPassword(auth, email, password); }
    } catch (err) { alert(err.message); }
  };

  const handleLogout = async () => { await signOut(auth); setMode(null); setView('landing'); };

  const handleLocalMode = () => {
    setMode('local');
    setTeams(JSON.parse(localStorage.getItem('localTeams')) || []);
    setHistory(JSON.parse(localStorage.getItem('localHistory')) || []);
    setPlayerStats([]); 
    setView('dashboard');
  };

  // --- TEAM & PLAYER LOGIC ---
  const handleAddNewTeam = async (e) => {
      e.preventDefault();
      if(!nName) return;
      const newTeam = { name: nName, logo: nLogo, players: [], p: 0, w: 0, l: 0, t: 0, pts: 0 };
      if(mode === 'tournament' && user) await addDoc(collection(db, "users", user.uid, "teams"), newTeam);
      else {
          const updated = [...teams, { ...newTeam, id: Date.now() }];
          setTeams(updated);
          localStorage.setItem('localTeams', JSON.stringify(updated));
      }
      setNName(""); setNLogo(null);
  };

  const handleAddPlayer = async (e) => {
      e.preventDefault();
      if(!selectedTeamId || !pName) return;
      const newPlayer = { name: pName, role: pRole };
      
      if(mode === 'tournament' && user) {
          const teamRef = doc(db, "users", user.uid, "teams", selectedTeamId);
          await updateDoc(teamRef, { players: arrayUnion(newPlayer) });
      } else {
          const updated = teams.map(t => t.id === selectedTeamId ? { ...t, players: [...(t.players||[]), newPlayer] } : t);
          setTeams(updated);
          localStorage.setItem('localTeams', JSON.stringify(updated));
      }
      setPName(""); 
  };

  const handleDeleteTeam = async (id) => {
      if(!confirm("Delete?")) return;
      if(mode === 'tournament' && user) await deleteDoc(doc(db, "users", user.uid, "teams", id));
      else {
          const updated = teams.filter(t => t.id !== id);
          setTeams(updated);
          localStorage.setItem('localTeams', JSON.stringify(updated));
      }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if(file && file.size < 500000) {
        const r = new FileReader();
        r.onloadend = () => setNLogo(r.result);
        r.readAsDataURL(file);
    } else alert("File too big");
  };

  // --- GAME LOGIC ---
  const trackStat = (playerName, r=0, b=0, w=0) => {
      if (!playerName) return;
      setMatchPlayerStats(prev => {
          const pStats = prev[playerName] || { runs: 0, balls: 0, wickets: 0 };
          return { ...prev, [playerName]: { runs: pStats.runs + r, balls: pStats.balls + b, wickets: pStats.wickets + w } };
      });
  };

  const startMatch = (e) => {
      e.preventDefault(); 
      if(!teamA || !teamB) return alert("Select teams!");
      setScore(0); setWickets(0); setBalls(0); setOvers(0); setCurrentOver([]); setMatchResult(null); setInning(1);
      setMatchPlayerStats({}); setPopup(null);
      setView('scoreboard');
  };

  const saveMatchAndExit = async () => {
      const matchData = { date: new Date().toLocaleDateString(), timestamp: Date.now(), teamA, teamB, result: matchResult, scoreA: firstInningScore, scoreB: {runs:score, wickets, overs:`${overs}.${balls%6}`}, winner };
      if (mode === 'tournament' && user) {
          await addDoc(collection(db, "users", user.uid, "history"), matchData);
          for (const [pName, stats] of Object.entries(matchPlayerStats)) {
              const playerRef = doc(db, "users", user.uid, "players", pName);
              await setDoc(playerRef, { runs: increment(stats.runs), balls: increment(stats.balls), wickets: increment(stats.wickets), innings: increment(1) }, { merge: true });
          }
      } else {
          const newH = [matchData, ...history];
          setHistory(newH);
          localStorage.setItem('localHistory', JSON.stringify(newH));
      }
      setView('dashboard');
  };

  const handleScore = (r) => { if(!matchResult) { setScore(score+r); trackStat(striker, r, 1, 0); updateOver(r, score+r); if(r%2!==0) swap(); }};
  
  const handleWicket = () => { 
      if(!matchResult) { 
          setWickets(wickets+1); 
          trackStat(striker, 0, 1, 0); 
          trackStat(bowler, 0, 0, 1); 
          updateOver("W", score); 
          // Open Popup instead of Prompt
          if(inning===1 && wickets<9) setPopup('batsman');
      }
  };

  const handleExtra = (t) => { if(!matchResult) { setScore(score+1); setCurrentOver([...currentOver, t]); }};
  const swap = () => { setStriker(nonStriker); setNonStriker(striker); };
  
  const updateOver = (evt, sc) => {
      const nb = balls+1; setBalls(nb); setCurrentOver([...currentOver, evt]);
      const max = totalOvers*6;
      if(inning===2 && sc>=target) { setMatchResult(`${teamB} Won!`); setWinner('B'); }
      else if(wickets>=10 || nb>=max) {
          if(inning===1) { alert(`Target: ${sc+1}`); setFirstInningScore({runs:sc, wickets, overs:`${Math.floor(nb/6)}.${nb%6}`}); setTarget(sc+1); setInning(2); setScore(0); setWickets(0); setBalls(0); setOvers(0); setCurrentOver([]); setPopup('batsman'); /* Need openers for 2nd inn */ }
          else { setMatchResult(sc===target-1 ? "Tie" : `${teamA} Won!`); setWinner(sc===target-1 ? 'Tie' : 'A'); }
      } else if(nb%6===0) { 
          setOvers(overs+1); setCurrentOver([]); swap(); 
          setPopup('bowler'); // Open Bowler Popup
      }
  };

  const handlePopupSelection = (name) => {
      if (popup === 'batsman') setStriker(name);
      if (popup === 'bowler') setBowler(name);
      setPopup(null);
  }

  // --- HELPERS TO GET PLAYERS ---
  const getTeamPlayers = (teamName) => {
      const t = teams.find(x => x.name === teamName);
      return t ? (t.players || []) : [];
  };

  // --- VIEWS ---

  if(view === 'landing') return (
      <div className="app-container center-content"><h1 className="logo">CRIC-TRACKER</h1><div className="menu-grid"><button className="btn-primary" onClick={()=>setView('auth')}>🏆 Login (Tournament)</button><button className="btn-secondary" onClick={handleLocalMode}>⚡ Guest (Local)</button></div></div>
  );

  if(view === 'auth') return (
      <div className="app-container center-content"><div className="setup-card"><h2 className="logo">{isSignup?'Signup':'Login'}</h2><form onSubmit={handleAuth} style={{width:'100%'}}><input placeholder="Email" onChange={e=>setEmail(e.target.value)} required /><input type="password" placeholder="Password" onChange={e=>setPassword(e.target.value)} required /><button className="btn-primary">{isSignup?'Sign Up':'Login'}</button></form><p className="btn-text" onClick={()=>setIsSignup(!isSignup)} style={{marginTop:'15px', display:'block'}}>{isSignup?'Login Instead':'Create Account'}</p><button className="back-btn" onClick={()=>setView('landing')}>Back</button></div></div>
  );

  if(view === 'dashboard') return (
      <div className="app-container setup-mode"><div className="history-header"><h2>{mode==='tournament'?'🏆 Dashboard':'⚡ Guest'}</h2>{mode==='tournament' && <button className="btn-text" onClick={handleLogout}>Logout</button>}{mode==='local' && <button className="btn-text" onClick={()=>setView('landing')}>Exit</button>}</div><div className="menu-grid"><button className="btn-primary full-width" onClick={()=>setView('setup')}>Start Match</button><button className="btn-secondary" onClick={()=>setView('teams')}>Manage Teams</button><button className="btn-secondary" onClick={()=>setView('history')}>History</button><button className="btn-secondary" onClick={()=>setView('pointstable')}>Points Table</button>{mode==='tournament' && <button className="btn-secondary" style={{color:'#facc15'}} onClick={()=>setView('leaderboard')}>Leaderboard</button>}</div></div>
  );

  // --- TEAMS VIEW (Added Player Management) ---
  if(view === 'teams') {
      const selectedTeam = teams.find(t => t.id === selectedTeamId);
      return (
          <div className="app-container setup-mode">
              <div className="history-header"><button className="back-btn" onClick={()=>setView('dashboard')}>←</button><h2>Teams</h2></div>
              
              {/* Add Team Section */}
              <form onSubmit={handleAddNewTeam} style={{marginBottom:'15px', paddingBottom:'15px', borderBottom:'1px solid #333'}}>
                  <input placeholder="Team Name" value={nName} onChange={e=>setNName(e.target.value)}/>
                  <label className="btn-secondary" style={{display:'block', textAlign:'center', marginTop:'5px'}}>{nLogo?'✅ Logo Ready':'📷 Upload Logo'}<input type="file" hidden onChange={handleLogoUpload}/></label>
                  <button className="btn-primary">Create Team</button>
              </form>

              {/* Add Player Section */}
              {teams.length > 0 && (
                  <div style={{marginBottom:'15px'}}>
                      <h3 style={{color:'#38bdf8', fontSize:'1rem', margin:'0 0 10px 0'}}>Manage Players</h3>
                      <select className="team-select" value={selectedTeamId} onChange={e=>setSelectedTeamId(e.target.value)}>
                          <option value="">Select Team to Add Players</option>
                          {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      {selectedTeamId && (
                          <form onSubmit={handleAddPlayer} style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                              <input placeholder="Player Name" value={pName} onChange={e=>setPName(e.target.value)} required />
                              <select className="team-select" value={pRole} onChange={e=>setPRole(e.target.value)}>
                                  <option>Batsman</option><option>Bowler</option><option>All Rounder</option><option>Wicket Keeper</option><option>Captain</option>
                              </select>
                              <button className="btn-secondary" style={{borderColor:'#22c55e', color:'#22c55e'}}>+ Add Player</button>
                          </form>
                      )}
                  </div>
              )}

              {/* Team List with Players */}
              <div className="team-list">
                  {teams.map(t=>(
                      <div key={t.id} className="team-item" style={{flexDirection:'column', alignItems:'stretch'}}>
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                              <div className="t-info">{t.logo ? <img src={t.logo}/> : <div className="no-logo">{t.name[0]}</div>}<span>{t.name}</span></div>
                              <button className="del-btn" onClick={()=>handleDeleteTeam(t.id)}>×</button>
                          </div>
                          {t.players && t.players.length > 0 && (
                              <div style={{marginTop:'10px', fontSize:'0.8rem', color:'#aaa', paddingLeft:'40px'}}>
                                  {t.players.map((p, i) => <span key={i} style={{display:'inline-block', marginRight:'5px', background:'rgba(255,255,255,0.1)', padding:'2px 6px', borderRadius:'4px'}}>{p.name} ({p.role.charAt(0)})</span>)}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  // ... (History, Pointstable, Leaderboard Views remain the same) ...
  if (view === 'history') return (<div className="app-container setup-mode"><div className="history-header"><button className="back-btn" onClick={() => setView('dashboard')}>←</button><h2>History</h2></div><div className="history-list">{history.length===0?<p style={{textAlign:'center', color:'#aaa'}}>No matches.</p>:history.map(m=><div key={m.id} className="history-card"><div className="h-teams"><div className="h-team"><span>{m.teamA}</span><strong>{m.scoreA ? `${m.scoreA.runs}/${m.scoreA.wickets}` : "DNB"}</strong></div><div className="h-team"><span>{m.teamB}</span><strong>{m.scoreB.runs}/{m.scoreB.wickets}</strong></div></div><div className="h-result">{m.winner === 'Tie' ? <span style={{color:'orange'}}>Tie</span> : <><span className="winner-text">Win: {m.winner==='A'?m.teamA:m.teamB}</span><span className="loser-text">Lost: {m.winner==='A'?m.teamB:m.teamA}</span></>}</div><div className="h-date">{m.date}</div></div>)}</div></div>);
  if (view === 'pointstable') {const sorted = [...teams].sort((a,b)=> b.pts - a.pts);return (<div className="app-container setup-mode"><div className="history-header"><button className="back-btn" onClick={() => setView('dashboard')}>←</button><h2>Standings</h2></div><div style={{overflowX:'auto'}}><table style={{width:'100%', borderCollapse:'collapse', marginTop:'10px'}}><thead><tr style={{textAlign:'left', color:'#38bdf8'}}><th>Team</th><th>P</th><th>W</th><th>Pts</th></tr></thead><tbody>{sorted.map(t=><tr key={t.id} style={{borderBottom:'1px solid rgba(255,255,255,0.1)'}}><td style={{padding:'8px'}}>{t.name}</td><td>{t.p}</td><td>{t.w}</td><td style={{color:'#facc15', fontWeight:'bold'}}>{t.pts}</td></tr>)}</tbody></table></div></div>);}
  if (view === 'leaderboard') { const sortedRuns = [...playerStats].sort((a,b) => b.runs - a.runs); const sortedWickets = [...playerStats].sort((a,b) => b.wickets - a.wickets); const highRun = sortedRuns[0] || {name:'-', runs:0}; const highWkt = sortedWickets[0] || {name:'-', wickets:0}; return (<div className="app-container setup-mode"><div className="history-header"><button className="back-btn" onClick={() => setView('dashboard')}>←</button><h2>Leaderboard</h2></div><div className="highest-stats-box"><div className="highest-stat" onClick={() => setLbTab('runs')} style={{opacity: lbTab==='runs'?1:0.5}}><span className="label orange">Highest Runs</span><span className="value">{highRun.name} ({highRun.runs})</span></div><div className="highest-stat" onClick={() => setLbTab('wickets')} style={{opacity: lbTab==='wickets'?1:0.5}}><span className="label purple">Highest Wickets</span><span className="value">{highWkt.name} ({highWkt.wickets})</span></div></div><div className="lb-tabs"><button className={`lb-tab ${lbTab==='runs'?'active':''}`} onClick={()=>setLbTab('runs')}>Orange Cap (Runs)</button><button className={`lb-tab ${lbTab==='wickets'?'active':''}`} onClick={()=>setLbTab('wickets')}>Purple Cap (Wickets)</button></div><div style={{marginTop:'15px'}}><div className="lb-header-row"><span>Player</span><span>{lbTab==='runs'?'Runs':'Wkts'}</span><span>Inn</span><span>{lbTab==='runs'?'Balls':'Overs'}</span></div>{(lbTab === 'runs' ? sortedRuns : sortedWickets).map((p,i)=><div key={i} className="lb-row-grid"><span className="p-name">#{i+1} {p.name}</span><span className="p-val highlight">{lbTab==='runs' ? p.runs : p.wickets}</span><span className="p-val">{p.innings || 1}</span><span className="p-val">{lbTab==='runs' ? (p.balls || 0) : Math.floor((p.balls||0)/6) + '.' + ((p.balls||0)%6)}</span></div>)}</div></div>);}

  // --- SETUP VIEW (Updated with Dropdowns) ---
  if(view === 'setup') {
      const playersA = getTeamPlayers(teamA);
      const playersB = getTeamPlayers(teamB);
      return (
      <div className="app-container setup-mode"><div className="history-header"><button className="back-btn" onClick={()=>setView('dashboard')}>←</button><h2>New Match</h2></div><form onSubmit={startMatch}><div style={{marginBottom:'10px'}}><label style={{fontSize:'0.8rem', color:'#38bdf8'}}>Teams</label><div style={{display:'flex', gap:'5px'}}><select className="team-select" onChange={e=>setTeamA(e.target.value)}><option>Team A</option>{teams.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}</select><span style={{color:'#ef4444', fontWeight:'bold', alignSelf:'center'}}>VS</span><select className="team-select" onChange={e=>setTeamB(e.target.value)}><option>Team B</option>{teams.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}</select></div></div><input placeholder="Overs" type="number" onChange={e=>setTotalOvers(e.target.value)} defaultValue={20} />
          {/* Dropdowns for Players */}
          <div className="form-group">
              <label>Opening Batsmen (Team A)</label>
              <select className="team-select" onChange={e=>setStriker(e.target.value)} required>
                  <option value="">Select Striker</option>
                  {playersA.map((p,i)=><option key={i} value={p.name}>{p.name}</option>)}
              </select>
              <select className="team-select" onChange={e=>setNonStriker(e.target.value)} required>
                  <option value="">Select Non-Striker</option>
                  {playersA.map((p,i)=><option key={i} value={p.name}>{p.name}</option>)}
              </select>
          </div>
          <div className="form-group">
              <label>Opening Bowler (Team B)</label>
              <select className="team-select" onChange={e=>setBowler(e.target.value)} required>
                  <option value="">Select Bowler</option>
                  {playersB.map((p,i)=><option key={i} value={p.name}>{p.name}</option>)}
              </select>
          </div>
          <button className="btn-primary">Start</button></form></div>
      );
  }

  // --- SCOREBOARD VIEW (With POPUP) ---
  if(view === 'scoreboard') {
      const battingTeamName = inning === 1 ? teamA : teamB;
      const bowlingTeamName = inning === 1 ? teamB : teamA;
      const battingLogo = teams.find(t => t.name === battingTeamName)?.logo;
      const bowlingLogo = teams.find(t => t.name === bowlingTeamName)?.logo;
      const runsNeeded = target - score;
      const ballsLeft = (totalOvers * 6) - balls;
      
      const battingPlayers = getTeamPlayers(battingTeamName);
      const bowlingPlayers = getTeamPlayers(bowlingTeamName);

      return (
      <div className="app-container">
          <div className="match-header"><span className="team-badge" style={{display:'flex', alignItems:'center', gap:'8px', opacity: 1}}>{battingLogo && <img src={battingLogo} style={{width:'32px', height:'32px', borderRadius:'50%', objectFit:'cover'}}/>}{battingTeamName}</span><span className="vs-badge">VS</span><span className="team-badge" style={{display:'flex', alignItems:'center', gap:'8px', opacity: 0.5}}>{bowlingLogo && <img src={bowlingLogo} style={{width:'32px', height:'32px', borderRadius:'50%', objectFit:'cover'}}/>}{bowlingTeamName}</span></div>
          <div className="scoreboard-card">
              {matchResult ? <div style={{background:'rgba(0,0,0,0.8)', padding:'20px', borderRadius:'10px'}}><h2>{matchResult}</h2><button className="btn-primary" onClick={saveMatchAndExit}>Save & Exit</button></div> : 
              <><div className="main-score-area"><div className="score-big">{score}<span className="wickets">/{wickets}</span></div><div className="overs-area"><span>OVERS</span><strong>{overs}.{balls%6}</strong></div></div>{inning === 2 && <div className="chase-msg">Need <strong>{runsNeeded}</strong> runs in <strong>{ballsLeft}</strong> balls</div>}<div className="control-pad"><div className="pad-row"><button onClick={()=>handleScore(0)}>0</button><button onClick={()=>handleScore(1)}>1</button><button onClick={()=>handleScore(2)}>2</button></div><div className="pad-row"><button className="btn-boundary" onClick={()=>handleScore(4)}>4</button><button className="btn-six" onClick={()=>handleScore(6)}>6</button><button className="btn-wicket" onClick={handleWicket}>OUT</button></div><div className="pad-row"><button className="btn-extra" onClick={()=>handleExtra('wd')}>WD</button><button className="btn-extra" onClick={()=>handleExtra('nb')}>NB</button><button onClick={()=>handleScore(3)}>3</button></div></div></>}
          </div>

          {/* POPUP OVERLAY */}
          {popup && (
              <div className="popup-overlay">
                  <div className="popup-card">
                      <h3>Select {popup === 'batsman' ? 'Next Batsman' : 'Next Bowler'}</h3>
                      <select className="team-select" onChange={(e) => handlePopupSelection(e.target.value)}>
                          <option value="">Choose Player...</option>
                          {(popup === 'batsman' ? battingPlayers : bowlingPlayers).map((p, i) => (
                              <option key={i} value={p.name}>{p.name} ({p.role})</option>
                          ))}
                      </select>
                  </div>
              </div>
          )}
      </div>
      );
  }

  return null;
}

export default App;