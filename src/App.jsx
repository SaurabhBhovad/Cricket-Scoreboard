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
  const [teams, setTeams] = useState([]); 
  const [history, setHistory] = useState([]);
  const [playerStats, setPlayerStats] = useState([]);
  const [matchPlayerStats, setMatchPlayerStats] = useState({}); 

  // --- Form Inputs ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
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
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");
  const [ballHistory, setBallHistory] = useState([]); 
  const [popup, setPopup] = useState(null);

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

  const handleAddNewTeam = async (e) => {
      e.preventDefault();
      if(!nName) return;
      const newTeam = { 
  name: nName, 
  logo: nLogo, 
  players: [], 
  p: 0, 
  w: 0, 
  l: 0, 
  t: 0, 
  pts: 0,
  runsFor: 0,
  runsAgainst: 0,
  oversFaced: 0,
  oversBowled: 0,
  nrr: 0
};

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

  const trackStat = (playerName, r=0, b=0, w=0) => {
      if (!playerName) return;
      setMatchPlayerStats(prev => {
          const pStats = prev[playerName] || { runs: 0, balls: 0, wickets: 0 };
          return { ...prev, [playerName]: { runs: pStats.runs + r, balls: pStats.balls + b, wickets: pStats.wickets + w } };
      });
  };

  const startMatch = (e) => {
      e.preventDefault(); 
      if(!teamA || !teamB || !striker || !nonStriker || !bowler) return alert("Please select all teams and players!");
      setScore(0); setWickets(0); setBalls(0); setOvers(0); setCurrentOver([]); setMatchResult(null); setInning(1);
      setMatchPlayerStats({}); setBallHistory([]); setPopup(null);
      setView('scoreboard');
  };

  const saveMatchAndExit = async () => {
      const matchData = { date: new Date().toLocaleDateString(), timestamp: Date.now(), teamA, teamB, result: matchResult, scoreA: firstInningScore, scoreB: {runs:score, wickets, overs:`${overs}.${balls%6}`}, winner };
     if (mode === 'tournament' && user) {
    await addDoc(collection(db, "users", user.uid, "history"), matchData);

    for (const [pName, stats] of Object.entries(matchPlayerStats)) {
        const playerRef = doc(db, "users", user.uid, "players", pName);
        await setDoc(playerRef, {
            runs: increment(stats.runs),
            balls: increment(stats.balls),
            wickets: increment(stats.wickets),
            innings: increment(1)
        }, { merge: true });
        // ===== POINTS + NRR UPDATE =====

const winnerTeamName =
  winner === "A" ? teamA :
  winner === "B" ? teamB : null;

const loserTeamName =
  winner === "A" ? teamB :
  winner === "B" ? teamA : null;

const winnerRef = winnerTeamName
  ? doc(db, "users", user.uid, "teams",
      teams.find(t => t.name === winnerTeamName)?.id)
  : null;

const loserRef = loserTeamName
  ? doc(db, "users", user.uid, "teams",
      teams.find(t => t.name === loserTeamName)?.id)
  : null;

// Calculate overs properly
const oversFacedA = firstInningScore?.overs
  ? parseFloat(firstInningScore.overs)
  : 0;

const oversFacedB = parseFloat(`${overs}.${balls % 6}`);

if (winner === "Tie") {

  const teamARef = doc(db, "users", user.uid, "teams",
    teams.find(t => t.name === teamA)?.id);

  const teamBRef = doc(db, "users", user.uid, "teams",
    teams.find(t => t.name === teamB)?.id);

  await updateDoc(teamARef, {
    p: increment(1),
    t: increment(1),
    pts: increment(1),
    runsFor: increment(firstInningScore.runs),
    runsAgainst: increment(score),
    oversFaced: increment(oversFacedA),
    oversBowled: increment(oversFacedB)
  });

  await updateDoc(teamBRef, {
    p: increment(1),
    t: increment(1),
    pts: increment(1),
    runsFor: increment(score),
    runsAgainst: increment(firstInningScore.runs),
    oversFaced: increment(oversFacedB),
    oversBowled: increment(oversFacedA)
  });

} else if (winnerTeamName && loserTeamName) {

  await updateDoc(winnerRef, {
    p: increment(1),
    w: increment(1),
    pts: increment(2),
    runsFor: increment(winner === "A" ? firstInningScore.runs : score),
    runsAgainst: increment(winner === "A" ? score : firstInningScore.runs),
    oversFaced: increment(winner === "A" ? oversFacedA : oversFacedB),
    oversBowled: increment(winner === "A" ? oversFacedB : oversFacedA)
  });

  await updateDoc(loserRef, {
    p: increment(1),
    l: increment(1),
    runsFor: increment(winner === "A" ? score : firstInningScore.runs),
    runsAgainst: increment(winner === "A" ? firstInningScore.runs : score),
    oversFaced: increment(winner === "A" ? oversFacedB : oversFacedA),
    oversBowled: increment(winner === "A" ? oversFacedA : oversFacedB)
  });
}

    }

    // ===== ADD THIS BELOW =====

    const teamAId = teams.find(t => t.name === teamA)?.id;
    const teamBId = teams.find(t => t.name === teamB)?.id;

    const teamARef = doc(db, "users", user.uid, "teams", teamAId);
    const teamBRef = doc(db, "users", user.uid, "teams", teamBId);

    if (winner === 'A') {
        await updateDoc(teamARef, {
            p: increment(1),
            w: increment(1),
            pts: increment(2)
        });

        await updateDoc(teamBRef, {
            p: increment(1),
            l: increment(1)
        });
    }

    else if (winner === 'B') {
        await updateDoc(teamBRef, {
            p: increment(1),
            w: increment(1),
            pts: increment(2)
        });

        await updateDoc(teamARef, {
            p: increment(1),
            l: increment(1)
        });
    }

    else if (winner === 'Tie') {
        await updateDoc(teamARef, {
            p: increment(1),
            t: increment(1),
            pts: increment(1)
        });

        await updateDoc(teamBRef, {
            p: increment(1),
            t: increment(1),
            pts: increment(1)
        });
    }
}
else {
    const newH = [matchData, ...history];
    setHistory(newH);
    localStorage.setItem('localHistory', JSON.stringify(newH));

    // ===== ADD THIS BELOW =====

    const updatedTeams = teams.map(t => {

        if (winner === 'A' && t.name === teamA)
            return { ...t, p: t.p+1, w: t.w+1, pts: t.pts+2 };

        if (winner === 'A' && t.name === teamB)
            return { ...t, p: t.p+1, l: t.l+1 };

        if (winner === 'B' && t.name === teamB)
            return { ...t, p: t.p+1, w: t.w+1, pts: t.pts+2 };

        if (winner === 'B' && t.name === teamA)
            return { ...t, p: t.p+1, l: t.l+1 };

        if (winner === 'Tie' && (t.name === teamA || t.name === teamB))
            return { ...t, p: t.p+1, t: t.t+1, pts: t.pts+1 };

        return t;
    });

    setTeams(updatedTeams);
    localStorage.setItem('localTeams', JSON.stringify(updatedTeams));
}

      setView('dashboard');
  };

  const handleUndo = () => {
    if (ballHistory.length === 0) return;
    const lastBall = ballHistory[ballHistory.length - 1];
    const newHistory = ballHistory.slice(0, -1);
    setScore(score - lastBall.runs);
    setWickets(wickets - (lastBall.type === 'W' ? 1 : 0));
    const totalLegal = balls - (lastBall.isLegal ? 1 : 0);
    setBalls(totalLegal);
    setOvers(Math.floor(totalLegal / 6));
    trackStat(lastBall.striker, -lastBall.runs, lastBall.isLegal ? -1 : 0, 0);
    if(lastBall.type === 'W') trackStat(lastBall.bowler, 0, 0, -1);
    setBallHistory(newHistory);
    setCurrentOver(currentOver.slice(0, -1));
  };

  const handleScore = (r) => { 
    if(!matchResult) { 
        setScore(score+r); 
        const ballData = { runs: r, type: 'R', isLegal: true, striker, bowler };
        setBallHistory([...ballHistory, ballData]);
        trackStat(striker, r, 1, 0); 
        updateOver(r, score+r, true); 
        if(r%2!==0) swap(); 
    }
  };
  
  const handleWicket = () => { 
      if(!matchResult) { 
          setWickets(wickets+1); 
          const ballData = { runs: 0, type: 'W', isLegal: true, striker, bowler };
          setBallHistory([...ballHistory, ballData]);
          trackStat(striker, 0, 1, 0); 
          trackStat(bowler, 0, 0, 1); 
          updateOver("W", score, true); 
          if(inning === 1 && wickets < 9) setPopup('batsman');
          else if(inning === 2 && wickets < 9) setPopup('batsman');
      }
  };

  const handleExtra = (t) => { 
    if(!matchResult) { 
        setScore(score+1); 
        const ballData = { runs: 1, type: t, isLegal: false, striker, bowler };
        setBallHistory([...ballHistory, ballData]);
        setCurrentOver([...currentOver, t]); 
    }
  };

  const swap = () => { setStriker(nonStriker); setNonStriker(striker); };
  
  const updateOver = (evt, sc, isLegal) => {
      const nb = isLegal ? balls + 1 : balls;
      if (isLegal) setBalls(nb);
      setCurrentOver([...currentOver, evt]);
      const max = totalOvers*6;

      if(inning===2 && sc>=target) { setMatchResult(`${teamB} Won!`); setWinner('B'); }
      else if(wickets>=10 || (isLegal && nb>=max)) {
          if(inning===1) { 
            alert(`Target: ${sc+1}`); 
            setFirstInningScore({runs:sc, wickets, overs:`${Math.floor(nb/6)}.${nb%6}`}); 
            setTarget(sc+1); setInning(2); setScore(0); setWickets(0); setBalls(0); setOvers(0); 
            setCurrentOver([]); setBallHistory([]); setPopup('true'); 
          }
          else { 
            setMatchResult(sc===target-1 ? "Tie" : `${teamA} Won!`); 
            setWinner(sc===target-1 ? 'Tie' : 'A'); 
          }
      } else if(isLegal && nb%6===0) { 
          setOvers(overs+1); setCurrentOver([]); swap(); 
          setPopup('bowler'); 
      }
  };
  const [tempStriker, setTempStriker] = useState("");
const [tempNonStriker, setTempNonStriker] = useState("");
const [tempBowler, setTempBowler] = useState("");

const confirmPlayers = () => {
    if (!tempStriker || !tempNonStriker || !tempBowler) {
        alert("Select Striker, Non-Striker and Bowler");
        return;
    }

    setStriker(tempStriker);
    setNonStriker(tempNonStriker);
    setBowler(tempBowler);

    setTempStriker("");
    setTempNonStriker("");
    setTempBowler("");

    setPopup(null);
};

  const getTeamPlayers = (teamName) => {
      const t = teams.find(x => x.name === teamName);
      return t ? (t.players || []) : [];
  };

  // --- VIEWS ---
  if(view === 'landing') return (<div className="app-container center-content"><h1 className="logo">CRIC-TRACKER</h1><div className="menu-grid"><button className="btn-primary" onClick={()=>setView('auth')}>🏆 Login (Tournament)</button><button className="btn-secondary" onClick={handleLocalMode}>⚡ Guest (Local)</button></div></div>);
  
  if(view === 'auth') return (<div className="app-container setup-mode center-content"><div className="setup-card"><h2 className="logo">{isSignup?'Signup':'Login'}</h2><form onSubmit={handleAuth} style={{width:'100%'}}><input placeholder="Email" onChange={e=>setEmail(e.target.value)} required /><input type="password" placeholder="Password" onChange={e=>setPassword(e.target.value)} required /><button className="btn-primary">{isSignup?'Sign Up':'Login'}</button></form><p className="btn-text" onClick={()=>setIsSignup(!isSignup)} style={{marginTop:'15px', display:'block'}}>{isSignup?'Login Instead':'Create Account'}</p><button className="back-btn" onClick={()=>setView('landing')}>Back</button></div></div>);
  
  if(view === 'dashboard') return (<div className="app-container setup-mode"><div className="history-header"><h2>{mode==='tournament'?'🏆 Dashboard':'⚡ Guest'}</h2>{mode==='tournament' && <button className="btn-text" onClick={handleLogout}>Logout</button>}{mode==='local' && <button className="btn-text" onClick={()=>setView('landing')}>Exit</button>}</div><div className="menu-grid"><button className="btn-primary full-width" onClick={()=>setView('setup')}>Start Match</button><button className="btn-secondary" onClick={()=>setView('teams')}>Manage Teams</button><button className="btn-secondary" onClick={()=>setView('history')}>History</button><button className="btn-secondary" onClick={()=>setView('pointstable')}>Points Table</button>{mode==='tournament' && <button className="btn-secondary" style={{color:'#facc15'}} onClick={()=>setView('leaderboard')}>Leaderboard</button>}</div></div>);

  if(view === 'teams') return (
    <div className="app-container setup-mode">
        <div className="history-header"><button className="back-btn" onClick={()=>setView('dashboard')}>←</button><h2>Teams</h2></div>
        <form onSubmit={handleAddNewTeam} style={{marginBottom:'15px', paddingBottom:'15px', borderBottom:'1px solid #333'}}>
            <input placeholder="Team Name" value={nName} onChange={e=>setNName(e.target.value)}/>
            <label className="btn-secondary" style={{display:'block', textAlign:'center', marginTop:'5px'}}>{nLogo?'✅ Logo Ready':'📷 Upload Logo'}<input type="file" hidden onChange={handleLogoUpload}/></label>
            <button className="btn-primary">Create Team</button>
        </form>
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
        <div className="team-list">
            {teams.map(t=>(
                <div key={t.id} className="team-item" style={{flexDirection:'column', alignItems:'stretch'}}>
                    <div style={{display:'flex', justifyBetween:'space-between', alignItems:'center'}}>
                        <div className="t-info">{t.logo ? <img src={t.logo}/> : <div className="no-logo">{t.name[0]}</div>}<span>{t.name}</span></div>
                        <button className="del-btn" onClick={()=>handleDeleteTeam(t.id)}>×</button>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  if (view === 'history') return (<div className="app-container setup-mode"><div className="history-header"><button className="back-btn" onClick={() => setView('dashboard')}>←</button><h2>History</h2></div><div className="history-list">{history.length===0?<p style={{textAlign:'center', color:'#aaa'}}>No matches.</p>:history.map(m=>(<div key={m.id} className="history-card"><div className="h-teams"><div className="h-team"><span>{m.teamA}</span><strong>{m.scoreA ? `${m.scoreA.runs}/${m.scoreA.wickets}` : "DNB"}</strong></div><div className="h-team"><span>{m.teamB}</span><strong>{m.scoreB.runs}/{m.scoreB.wickets}</strong></div></div><div className="h-result">{m.winner === 'Tie' ? <span style={{color:'orange'}}>Tie</span> : <><span className="winner-text">Win: {m.winner==='A'?m.teamA:m.teamB}</span><span className="loser-text">Lost: {m.winner==='A'?m.teamB:m.teamA}</span></>}</div><div className="h-date">{m.date}</div></div>))}</div></div>);
  
  if (view === 'leaderboard') {
    const sortedRuns = [...playerStats].sort((a,b) => b.runs - a.runs);
    const sortedWickets = [...playerStats].sort((a,b) => b.wickets - a.wickets);
    const highRun = sortedRuns[0] || {name:'-', runs:0};
    const highWkt = sortedWickets[0] || {name:'-', wickets:0};
    return (
      <div className="app-container setup-mode">
           <div className="history-header"><button className="back-btn" onClick={() => setView('dashboard')}>←</button><h2>Leaderboard</h2></div>
           <div className="highest-stats-box">
              <div className="highest-stat" onClick={() => setLbTab('runs')} style={{opacity: lbTab==='runs'?1:0.5}}><span className="label orange">Highest Runs</span><span className="value">{highRun.name} ({highRun.runs})</span></div>
              <div className="highest-stat" onClick={() => setLbTab('wickets')} style={{opacity: lbTab==='wickets'?1:0.5}}><span className="label purple">Highest Wickets</span><span className="value">{highWkt.name} ({highWkt.wickets})</span></div>
           </div>
           <div className="lb-tabs">
               <button className={`lb-tab ${lbTab==='runs'?'active':''}`} onClick={()=>setLbTab('runs')}>Runs</button>
               <button className={`lb-tab ${lbTab==='wickets'?'active':''}`} onClick={()=>setLbTab('wickets')}>Wickets</button>
           </div>
           <div style={{marginTop:'15px'}}>
               <div className="lb-header-row"><span>Player</span><span>{lbTab==='runs'?'Runs':'Wkts'}</span><span>Inn</span><span>{lbTab==='runs'?'Balls':'Overs'}</span></div>
               {(lbTab === 'runs' ? sortedRuns : sortedWickets).map((p,i)=>
                  <div key={i} className="lb-row-grid">
                      <span className="p-name">#{i+1} {p.name}</span>
                      <span className="p-val highlight">{lbTab==='runs' ? p.runs : p.wickets}</span>
                      <span className="p-val">{p.innings || 1}</span>
                      <span className="p-val">{lbTab==='runs' ? (p.balls || 0) : Math.floor((p.balls||0)/6) + '.' + ((p.balls||0)%6)}</span>
                  </div>
               )}
           </div>
      </div>
    );
  }

  if (view === 'pointstable') {
    const sorted = [...teams].sort((a,b)=> b.pts - a.pts);
    return (
      <div className="app-container setup-mode"><div className="history-header"><button className="back-btn" onClick={() => setView('dashboard')}>←</button><h2>Standings</h2></div><div style={{overflowX:'auto'}}><table style={{width:'100%', borderCollapse:'collapse', marginTop:'10px'}}><thead><tr style={{textAlign:'left', color:'#38bdf8'}}><th>Team</th><th>P</th><th>W</th><th>Pts</th><th>NRR</th></tr></thead><tbody>{sorted.map(t=><tr key={t.id} style={{borderBottom:'1px solid rgba(255,255,255,0.1)'}}><td style={{padding:'8px'}}>{t.name}</td><td>{t.p}</td><td>{t.w}</td><td style={{color:'#facc15', fontWeight:'bold'}}>{t.pts}</td><td>
  {(
    ((t.runsFor / (t.oversFaced || 1)) -
    (t.runsAgainst / (t.oversBowled || 1)))
  ).toFixed(2)}
</td></tr>)}</tbody></table></div></div>
    );
  }

  if(view === 'setup') {
    const playersA = getTeamPlayers(teamA);
    const playersB = getTeamPlayers(teamB);
    return (
      <div className="app-container setup-mode">
        <div className="history-header"><button className="back-btn" onClick={()=>setView('dashboard')}>←</button><h2>Setup Match</h2></div>
        <form onSubmit={startMatch}>
          <div className="form-group">
            <label>Teams</label>
            <div style={{display:'flex', gap:'5px'}}>
              <select className="team-select" onChange={e=>setTeamA(e.target.value)} required>
                <option value="">Team A</option>{teams.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
              <span className="vs-text">VS</span>
              <select className="team-select" onChange={e=>setTeamB(e.target.value)} required>
                <option value="">Team B</option>{teams.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
          </div>
          <input placeholder="Overs" type="number" onChange={e=>setTotalOvers(e.target.value)} defaultValue={20} />
          <div className="form-group">
            <label>Openers & Bowler</label>
            <select className="team-select" onChange={e=>setStriker(e.target.value)} required><option value="">Striker</option>{playersA.map((p,i)=><option key={i} value={p.name}>{p.name}</option>)}</select>
            <select className="team-select" onChange={e=>setNonStriker(e.target.value)} required><option value="">Non-Striker</option>{playersA.map((p,i)=><option key={i} value={p.name}>{p.name}</option>)}</select>
            <select className="team-select" onChange={e=>setBowler(e.target.value)} required><option value="">Bowler</option>{playersB.map((p,i)=><option key={i} value={p.name}>{p.name}</option>)}</select>
          </div>
          <button className="btn-primary">Start Match</button>
        </form>
      </div>
    );
  }

 // ... EVERYTHING ABOVE REMAINS EXACTLY SAME UNTIL scoreboard view ...

if (view === 'scoreboard') {
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
      <div className="match-header">
        <span className="team-badge" style={{display:'flex', alignItems:'center', gap:'8px', opacity: 1}}>
          {battingLogo && <img src={battingLogo} className="header-logo"/>}
          {battingTeamName}
        </span>
        <span className="vs-badge">VS</span>
        <span className="team-badge" style={{display:'flex', alignItems:'center', gap:'8px', opacity: 0.5}}>
          {bowlingLogo && <img src={bowlingLogo} className="header-logo"/>}
          {bowlingTeamName}
        </span>
      </div>

      {/* ===================== FIXED SCOREBOARD CARD ===================== */}

      <div className="scoreboard-card">

        {/* ALWAYS VISIBLE CONTENT */}

        <div className="main-score-area">

          <div style={{padding:'10px 15px'}}>
            <div>
              <strong>{striker}*</strong> - {matchPlayerStats[striker]?.runs || 0} ({matchPlayerStats[striker]?.balls || 0})
            </div>

            <div>
              <strong>{nonStriker}</strong> - {matchPlayerStats[nonStriker]?.runs || 0} ({matchPlayerStats[nonStriker]?.balls || 0})
            </div>

            <div style={{marginTop:'5px', fontSize:'0.9rem', color:'#facc15'}}>
              Bowler: {bowler} | Wickets: {matchPlayerStats[bowler]?.wickets || 0}
            </div>
          </div>

          <div className="score-wrapper">
            <span className="score-big">{score}</span>
            <span className="wickets-divider">/</span>
            <span className="wickets-big">{wickets}</span>
          </div>

          <div className="overs-area">
            <span>OVERS</span>
            <strong>{overs}.{balls % 6}</strong>
          </div>

        </div>

        {inning === 2 && (
          <div className="chase-msg">
            Need <strong>{runsNeeded}</strong> runs in{" "}
            <strong>{ballsLeft}</strong> balls
          </div>
        )}

        <div className="control-pad">

          <div className="pad-row">
            <button onClick={()=>handleScore(0)}>0</button>
            <button onClick={()=>handleScore(1)}>1</button>
            <button onClick={()=>handleScore(2)}>2</button>
          </div>

          <div className="pad-row">
            <button onClick={()=>handleScore(3)}>3</button>
            <button className="btn-boundary" onClick={()=>handleScore(4)}>4</button>
            <button className="btn-six" onClick={()=>handleScore(6)}>6</button>
          </div>

          <div className="pad-row">
            <button className="btn-extra" onClick={()=>handleExtra('WD')}>WD</button>
            <button className="btn-extra" onClick={()=>handleExtra('NB')}>NB</button>
            <button className="btn-wicket" onClick={handleWicket}>OUT</button>
          </div>

          <div className="pad-row">
            <button className="btn-undo" onClick={handleUndo}>
              Delete Last Ball (Undo)
            </button>
          </div>

        </div>

        {/* OVERLAY RESULT — DOES NOT SHRINK UI */}

        {matchResult && (
          <div className="result-overlay">
            <h2>{matchResult}</h2>
            <button className="btn-primary" onClick={saveMatchAndExit}>
              Save & Exit
            </button>
          </div>
        )}

      </div>

      {/* ===================== POPUP ===================== */}

      {popup && (
        <div className="popup-overlay">
          <div className="popup-card">
            <h3>Select Opening Players</h3>

            <select className="team-select" onChange={(e)=>setTempStriker(e.target.value)}>
              <option value="">Striker</option>
              {battingPlayers.map((p,i)=>(
                <option key={i} value={p.name}>{p.name}</option>
              ))}
            </select>

            <select className="team-select" onChange={(e)=>setTempNonStriker(e.target.value)}>
              <option value="">Non-Striker</option>
              {battingPlayers.map((p,i)=>(
                <option key={i} value={p.name}>{p.name}</option>
              ))}
            </select>

            <select className="team-select" onChange={(e)=>setTempBowler(e.target.value)}>
              <option value="">Bowler</option>
              {bowlingPlayers.map((p,i)=>(
                <option key={i} value={p.name}>{p.name}</option>
              ))}
            </select>

            <button className="btn-primary" onClick={confirmPlayers}>
              Confirm
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
  return null;
}

export default App;