import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  // --- Navigation State ---
  // views: 'setup', 'scoreboard', 'history', 'teams', 'pointstable'
  const [view, setView] = useState('setup');

  // --- Game Setup State ---
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [totalOvers, setTotalOvers] = useState(20);
  
  // --- Match State ---
  const [inning, setInning] = useState(1); 
  const [target, setTarget] = useState(0);
  const [matchResult, setMatchResult] = useState(null); 
  const [winner, setWinner] = useState(null); // 'A', 'B', or 'Tie'
  const [firstInningScore, setFirstInningScore] = useState(null); 

  // --- History State ---
  const [history, setHistory] = useState([]);

  // --- NEW: Teams & Points State ---
  const [teams, setTeams] = useState([]); 
  const [winPts, setWinPts] = useState(2);
  const [tiePts, setTiePts] = useState(1);
  
  // Temporary state for adding a new team
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamLogo, setNewTeamLogo] = useState(null);

  // Players
  const [striker, setStriker] = useState("");
  const [nonStriker, setNonStriker] = useState("");
  const [bowler, setBowler] = useState("");

  // Scoreboard State
  const [score, setScore] = useState(0);
  const [wickets, setWickets] = useState(0);
  const [balls, setBalls] = useState(0);
  const [overs, setOvers] = useState(0);
  const [currentOver, setCurrentOver] = useState([]); 

  // --- Load Data on Mount ---
  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem('cricketHistory')) || [];
    setHistory(savedHistory);

    const savedTeams = JSON.parse(localStorage.getItem('cricTeams')) || [];
    setTeams(savedTeams);

    const savedConfig = JSON.parse(localStorage.getItem('cricPointsConfig'));
    if(savedConfig) {
        setWinPts(savedConfig.win);
        setTiePts(savedConfig.tie);
    }
  }, []);

  // --- Save Data Effects ---
  useEffect(() => {
    localStorage.setItem('cricTeams', JSON.stringify(teams));
    localStorage.setItem('cricPointsConfig', JSON.stringify({win: winPts, tie: tiePts}));
  }, [teams, winPts, tiePts]);

  // --- Helper: Image Upload ---
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if(file.size > 500000) return alert("File too big! Keep under 500KB.");
      const reader = new FileReader();
      reader.onloadend = () => setNewTeamLogo(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const addNewTeam = (e) => {
      e.preventDefault();
      if(!newTeamName) return;
      const newTeam = {
          id: Date.now(),
          name: newTeamName,
          logo: newTeamLogo, 
          p: 0, w: 0, l: 0, t: 0, pts: 0
      };
      setTeams([...teams, newTeam]);
      setNewTeamName("");
      setNewTeamLogo(null);
  };

  const deleteTeam = (id) => {
      if(confirm("Delete this team?")) setTeams(teams.filter(t => t.id !== id));
  };

  // --- Handlers ---
  const startMatch = (e) => {
    e.preventDefault();
    if(!teamA || !teamB) return alert("Select teams first!");
    setView('scoreboard');
    setInning(1);
    setMatchResult(null);
    setWinner(null);
    setScore(0); setWickets(0); setBalls(0); setOvers(0); setCurrentOver([]);
  };

  const saveMatchAndExit = () => {
    // 1. Update Points Table
    let updatedTeams = [...teams];
    const getIdx = (name) => updatedTeams.findIndex(t => t.name.toLowerCase() === name.toLowerCase());
    const idxA = getIdx(teamA);
    const idxB = getIdx(teamB);

    if (idxA !== -1) updatedTeams[idxA].p += 1;
    if (idxB !== -1) updatedTeams[idxB].p += 1;

    if (winner === 'Tie') {
        if(idxA !== -1) { updatedTeams[idxA].t += 1; updatedTeams[idxA].pts += parseInt(tiePts); }
        if(idxB !== -1) { updatedTeams[idxB].t += 1; updatedTeams[idxB].pts += parseInt(tiePts); }
    } else if (winner === 'A') {
        if(idxA !== -1) { updatedTeams[idxA].w += 1; updatedTeams[idxA].pts += parseInt(winPts); }
        if(idxB !== -1) { updatedTeams[idxB].l += 1; }
    } else if (winner === 'B') {
        if(idxB !== -1) { updatedTeams[idxB].w += 1; updatedTeams[idxB].pts += parseInt(winPts); }
        if(idxA !== -1) { updatedTeams[idxA].l += 1; }
    }
    setTeams(updatedTeams);

    // 2. Save History
    const newMatch = {
      id: Date.now(),
      date: new Date().toLocaleDateString(),
      teamA, teamB,
      scoreA: firstInningScore, 
      scoreB: { runs: score, wickets: wickets, overs: `${overs}.${balls % 6}` },
      result: matchResult
    };
    const updatedHistory = [newMatch, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('cricketHistory', JSON.stringify(updatedHistory));

    // 3. Reset
    setView('setup');
    setMatchResult(null);
  };

  const clearHistory = () => {
    if(confirm("Clear history?")) {
        setHistory([]);
        localStorage.removeItem('cricketHistory');
    }
  };

  const checkMatchStatus = (sc, wk, bl) => {
    const maxBalls = totalOvers * 6;
    if (inning === 2) {
      if (sc >= target) {
        setMatchResult(`${teamB} Won by ${10 - wk} wickets!`);
        setWinner('B');
        return true; 
      }
      if (wk >= 10 || bl >= maxBalls) {
        if (sc === target - 1) {
            setMatchResult("Match Tied!");
            setWinner('Tie');
        } else {
            setMatchResult(`${teamA} Won by ${target - 1 - sc} runs!`);
            setWinner('A');
        }
        return true; 
      }
    } else {
      if (wk >= 10 || bl >= maxBalls) {
        endFirstInning(sc, wk, bl);
        return true; 
      }
    }
    return false;
  };

  const endFirstInning = (sc, wk, bl) => {
    alert(`Inning Break! Target: ${sc + 1}`);
    setFirstInningScore({ runs: sc, wickets: wk, overs: `${Math.floor(bl/6)}.${bl%6}` });
    setTarget(sc + 1);
    setInning(2);
    setScore(0); setWickets(0); setBalls(0); setOvers(0); setCurrentOver([]);
    setStriker("Player 1"); setNonStriker("Player 2"); setBowler("Bowler 1");
  };

  const handleScore = (runs) => {
    if (matchResult) return;
    const newScore = score + runs;
    setScore(newScore);
    updateOver(runs, newScore); 
    if (runs % 2 !== 0) swapStrike();
  };

  const handleWicket = () => {
    if (matchResult) return;
    const newWickets = wickets + 1;
    setWickets(newWickets);
    updateOver("W", score, newWickets); 
    if (!matchResult && inning === 1 && newWickets < 10) {
       const next = prompt("Next Batsman:");
       if (next) setStriker(next);
    }
  };

  const handleExtra = (type) => {
    if (matchResult) return;
    setScore(score + 1);
    if (inning === 2 && score + 1 >= target) {
        setMatchResult(`${teamB} Won by ${10 - wickets} wickets!`);
        setWinner('B');
    }
    setCurrentOver([...currentOver, type]);
  };

  const updateOver = (evt, sc, wk = wickets) => {
    const newBalls = balls + 1;
    setBalls(newBalls);
    setCurrentOver([...currentOver, evt]);
    const isStopped = checkMatchStatus(sc, wk, newBalls);
    if (!isStopped && newBalls % 6 === 0) {
        setOvers(overs + 1);
        setCurrentOver([]); 
        swapStrike(); 
        setTimeout(() => {
            if(!matchResult) {
                const next = prompt("Next Bowler:");
                if (next) setBowler(next);
            }
        }, 100);
    }
  };

  const swapStrike = () => { setStriker(nonStriker); setNonStriker(striker); };

  // --- RENDER ---

  // 1. MANAGE TEAMS VIEW
  if (view === 'teams') {
      return (
        <div className="app-container setup-mode">
            <div className="setup-card">
                <div className="history-header">
                    <button className="back-btn" onClick={() => setView('setup')}>← Back</button>
                    <h2>Manage Teams</h2>
                    <div></div>
                </div>

                <div className="config-section">
                    <h3>Points Config</h3>
                    <div className="points-inputs">
                        <div className="p-input">
                            <label>Win Pts</label>
                            <input type="number" value={winPts} onChange={e => setWinPts(e.target.value)} />
                        </div>
                        <div className="p-input">
                            <label>Tie Pts</label>
                            <input type="number" value={tiePts} onChange={e => setTiePts(e.target.value)} />
                        </div>
                    </div>
                </div>

                <form onSubmit={addNewTeam} className="add-team-form">
                    <h3>Add Team</h3>
                    <input type="text" placeholder="Team Name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
                    <label className="file-label">
                        {newTeamLogo ? "✅ Logo Selected" : "📷 Upload Logo"}
                        <input type="file" accept="image/*" onChange={handleLogoUpload} style={{display:'none'}} />
                    </label>
                    <button type="submit" className="btn-primary" style={{fontSize: '1rem', padding: '12px'}}>Add to List</button>
                </form>

                <div className="team-list">
                    {teams.map(t => (
                        <div key={t.id} className="team-item">
                            <div className="t-info">
                                {t.logo ? <img src={t.logo} alt="logo" /> : <div className="no-logo">{t.name[0]}</div>}
                                <span>{t.name}</span>
                            </div>
                            <button className="del-btn" onClick={() => deleteTeam(t.id)}>×</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      );
  }

  // 2. POINTS TABLE VIEW
  if (view === 'pointstable') {
      const sortedTeams = [...teams].sort((a, b) => b.pts - a.pts || b.w - a.w);
      return (
        <div className="app-container setup-mode">
             <div className="setup-card">
                <div className="history-header">
                    <button className="back-btn" onClick={() => setView('setup')}>← Back</button>
                    <h2>Standings</h2>
                    <div></div>
                </div>
                <div className="points-table-container">
                    <table className="points-table">
                        <thead>
                            <tr>
                                <th>Team</th>
                                <th>P</th>
                                <th>W</th>
                                <th>L</th>
                                <th>Pts</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedTeams.length === 0 ? (
                                <tr><td colSpan="5" style={{textAlign:'center', padding:'20px', color:'#666'}}>No teams yet.</td></tr>
                            ) : sortedTeams.map((t) => (
                                <tr key={t.id}>
                                    <td className="pt-name">
                                        {t.logo && <img src={t.logo} alt="l" />}
                                        {t.name}
                                    </td>
                                    <td>{t.p}</td>
                                    <td>{t.w}</td>
                                    <td>{t.l}</td>
                                    <td className="pt-pts">{t.pts}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             </div>
        </div>
      );
  }

  // 3. HISTORY VIEW
  if (view === 'history') {
    return (
      <div className="app-container history-mode">
        <div className="history-header">
            <button className="back-btn" onClick={() => setView('setup')}>← Back</button>
            <h2>History</h2>
            <button className="clear-btn" onClick={clearHistory}>Clear</button>
        </div>
        <div className="history-list">
            {history.length === 0 ? <p className="no-data">No matches.</p> : 
             history.map((match) => (
                <div key={match.id} className="history-card">
                    <div className="h-date">{match.date}</div>
                    <div className="h-teams">
                        <div className="h-team">
                            <span>{match.teamA}</span>
                            <strong>{match.scoreA ? `${match.scoreA.runs}/${match.scoreA.wickets}` : "DNB"}</strong>
                        </div>
                        <span className="h-vs">vs</span>
                        <div className="h-team">
                            <span>{match.teamB}</span>
                            <strong>{match.scoreB.runs}/{match.scoreB.wickets}</strong>
                        </div>
                    </div>
                    <div className="h-result">{match.result}</div>
                </div>
            ))}
        </div>
      </div>
    );
  }

  // 4. SETUP VIEW
  if (view === 'setup') {
    return (
      <div className="app-container setup-mode">
        <div className="setup-card">
          <h1 className="logo">🏏 CRIC-TRACKER</h1>
          <form onSubmit={startMatch}>
            <div className="form-group">
                <label>Teams</label>
                <div className="team-inputs">
                    {teams.length > 0 ? (
                        <select value={teamA} onChange={e => setTeamA(e.target.value)} className="team-select">
                            <option value="">Team A</option>
                            {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                    ) : (
                        <input type="text" placeholder="Team A" value={teamA} onChange={e => setTeamA(e.target.value)} required />
                    )}
                    <span className="vs">VS</span>
                    {teams.length > 0 ? (
                        <select value={teamB} onChange={e => setTeamB(e.target.value)} className="team-select">
                            <option value="">Team B</option>
                            {teams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                        </select>
                    ) : (
                        <input type="text" placeholder="Team B" value={teamB} onChange={e => setTeamB(e.target.value)} required />
                    )}
                </div>
            </div>
            
            <div className="form-group">
                <label>Overs</label>
                <input type="number" value={totalOvers} onChange={e => setTotalOvers(e.target.value)} required />
            </div>
            
            <div className="form-group">
                <label>Opening Players</label>
                <input placeholder="Striker" value={striker} onChange={e => setStriker(e.target.value)} required />
                <input placeholder="Non-Striker" value={nonStriker} onChange={e => setNonStriker(e.target.value)} required />
                <input placeholder="Bowler" value={bowler} onChange={e => setBowler(e.target.value)} required />
            </div>
            
            <button type="submit" className="btn-primary">START MATCH</button>
            
            <div className="menu-grid">
                <button type="button" className="btn-secondary" onClick={() => setView('pointstable')}>Standings</button>
                <button type="button" className="btn-secondary" onClick={() => setView('teams')}>Teams</button>
                <button type="button" className="btn-secondary full-width" onClick={() => setView('history')}>Match History</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 5. SCOREBOARD VIEW
  return (
    <div className="app-container">
      <header className="match-header">
        <div className="team-badge">{inning === 1 ? teamA : teamB}</div>
        <div className="vs-badge">VS</div>
        <div className="team-badge secondary">{inning === 1 ? teamB : teamA}</div>
      </header>

      <div className="scoreboard-card">
        {matchResult ? (
             <div className="match-result-overlay">
                <h2>🏆 MATCH FINISHED</h2>
                <p className="result-text">{matchResult}</p>
                <button className="save-btn" onClick={saveMatchAndExit}>SAVE & EXIT</button>
             </div>
        ) : (
            <>
                <div className="main-score-area">
                    <div className="score-big">{score}<span className="wickets">/{wickets}</span></div>
                    <div className="overs-area">
                        <span>OVERS</span>
                        <strong>{overs}.{balls % 6}</strong>
                        <span className="total-overs">/ {totalOvers}</span>
                    </div>
                </div>

                <div className="stats-grid">
                    <div className="stat-item">
                        <label>CRR</label>
                        <span>{balls ? (score / (balls/6)).toFixed(2) : "0.00"}</span>
                    </div>
                    {inning === 2 ? (
                         <>
                            <div className="stat-item">
                                <label>REQ</label>
                                <span>{(() => {
                                    const rem = (totalOvers*6) - balls;
                                    if(rem <= 0) return "0.00";
                                    return ((target - score) / (rem/6)).toFixed(2);
                                })()}</span>
                            </div>
                            <div className="stat-item highlight">
                                <label>TARGET</label>
                                <span>{target}</span>
                            </div>
                         </>
                    ) : (
                        <div className="stat-item">
                            <label>PROJ</label>
                            <span>{Math.round((balls ? score/(balls/6) : 0) * totalOvers)}</span>
                        </div>
                    )}
                </div>

                {inning === 2 && !matchResult && (
                    <div className="chase-msg">
                        Need <strong>{target - score}</strong> runs in <strong>{(totalOvers * 6) - balls}</strong> balls
                    </div>
                )}
            </>
        )}
      </div>

      <div className="info-card">
        <div className="players-row">
            <div className="batsmen-col">
                <div className="player active">
                    <span className="icon">🏏</span>
                    <span className="name">{striker}</span>
                    <span className="runs">*</span>
                </div>
                <div className="player">
                    <span className="icon">🏏</span>
                    <span className="name">{nonStriker}</span>
                </div>
            </div>
            <div className="bowler-col">
                <div className="player">
                    <span className="icon">⚾</span>
                    <span className="name">{bowler}</span>
                </div>
            </div>
        </div>
        <div className="timeline-row">
            <span className="label">THIS OVER:</span>
            <div className="balls-scroll">
                {currentOver.map((b, i) => (
                    <span key={i} className={`ball-bubble ${b === "W" ? "w" : b === 4 || b === 6 ? "b" : ""}`}>{b}</span>
                ))}
            </div>
        </div>
      </div>

      <div className={`control-pad ${matchResult ? 'disabled' : ''}`}>
        <div className="pad-row">
            <button className="btn-run" onClick={() => handleScore(0)}>0</button>
            <button className="btn-run" onClick={() => handleScore(1)}>1</button>
            <button className="btn-run" onClick={() => handleScore(2)}>2</button>
        </div>
        <div className="pad-row">
            <button className="btn-boundary" onClick={() => handleScore(4)}>4</button>
            <button className="btn-six" onClick={() => handleScore(6)}>6</button>
            <button className="btn-run" onClick={() => handleScore(3)}>3</button>
        </div>
        <div className="pad-row">
            <button className="btn-wicket" onClick={handleWicket}>OUT</button>
            <button className="btn-extra" onClick={() => handleExtra("Wd")}>WD</button>
            <button className="btn-extra" onClick={() => handleExtra("Nb")}>NB</button>
        </div>
      </div>
    </div>
  );
}

export default App;