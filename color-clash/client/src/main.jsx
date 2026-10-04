import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {io} from 'socket.io-client';
import './styles.css';

const SERVER=import.meta.env.VITE_SERVER_URL || window.location.origin;
const socket=io(SERVER,{autoConnect:false});
const palette={red:'#ff4d67',blue:'#4d8dff',green:'#42d392',yellow:'#ffd34d',purple:'#a66cff',orange:'#ff944d'};

function App(){
 const [screen,setScreen]=useState('home'); const [name,setName]=useState(''); const [room,setRoom]=useState('');
 const [state,setState]=useState(null); const [me,setMe]=useState(null); const [error,setError]=useState(''); const [copied,setCopied]=useState(false);
 useEffect(()=>{
  socket.on('connect',()=>{setMe(socket.id);});
  socket.on('state',s=>{setState(s); if(s.status==='lobby')setScreen('lobby'); else if(s.status==='playing')setScreen('game'); else if(s.status==='finished')setScreen('finished');});
  socket.on('errorMessage',m=>setError(m));
  return()=>{socket.off();};
 },[]);
const join=(create=false)=>{
 setError('');
 const n=name.trim().slice(0,18);
 if(!n)return setError('Enter a name first.');

 const action=()=>{
  socket.emit(create?'createRoom':'joinRoom',{
   name:n,
   room:room.trim().toUpperCase()
  });
 };

 if(socket.connected) action();
 else {
  socket.connect();
  socket.once('connect',action);
 }
};
 const invite=()=>{const url=`${location.origin}/?room=${state?.room||''}`; navigator.clipboard?.writeText(url); setCopied(true); setTimeout(()=>setCopied(false),1600);};
 useEffect(()=>{const r=new URLSearchParams(location.search).get('room');if(r)setRoom(r);},[]);
 if(screen==='home')return <Home name={name} setName={setName} room={room} setRoom={setRoom} join={join} error={error}/>;
 if(!state)return <div className="loading">Connecting…</div>;
 if(screen==='lobby')return <Lobby state={state} me={me} invite={invite} copied={copied} onStart={()=>socket.emit('startGame')} onLeave={()=>{socket.disconnect();setState(null);setScreen('home')}} error={error}/>;
 if(screen==='game')return <Game state={state} me={me} error={error} answer={c=>{setError('');socket.emit('answer',{color:c})}}/>;
 return <Finished state={state} me={me} onAgain={()=>socket.emit('playAgain')} onLeave={()=>{socket.disconnect();setState(null);setScreen('home')}}/>;
}

function Header(){return <header><div className="logo"><span className="logo-mark">✦</span> COLOR CLASH</div><div className="tag">REAL-TIME • 2–4 PLAYERS</div></header>}
function Home({name,setName,room,setRoom,join,error}){return <main className="shell"><Header/><section className="hero"><div className="eyebrow">⚡ FAST • FAIR • LIVE</div><h1>Beat the clock.<br/><em>Claim the color.</em></h1><p className="sub">Race friends in real time. Find the target color, tap it first, and climb the scoreboard.</p><div className="card home-card"><label>Your name</label><input value={name} onChange={e=>setName(e.target.value)} maxLength={18} placeholder="e.g. Alex" onKeyDown={e=>e.key==='Enter'&&join(true)}/><button className="primary" onClick={()=>join(true)}>Create a game <span>→</span></button><div className="divider"><span>OR JOIN A GAME</span></div><div className="join-row"><input value={room} onChange={e=>setRoom(e.target.value.toUpperCase())} maxLength={6} placeholder="ROOM CODE" onKeyDown={e=>e.key==='Enter'&&join(false)}/><button className="secondary" onClick={()=>join(false)}>Join</button></div>{error&&<div className="error">{error}</div>}</div><div className="rules"><div><b>10</b><span>Rounds</span></div><div><b>+100</b><span>Correct</span></div><div><b>−25</b><span>Wrong</span></div><div><b>2–4</b><span>Players</span></div></div></section></main>}
function Lobby({state,me,invite,copied,onStart,onLeave,error}){const host=state.hostId===me;return <main className="shell"><Header/><section className="panel"><div className="room-top"><div><div className="eyebrow">GAME LOBBY</div><h2>Room <strong>{state.room}</strong></h2><p>Share the code or invite link with your friends.</p></div><button className="copy" onClick={invite}>{copied?'Copied ✓':'Copy invite'}</button></div><div className="players">{state.players.map((p,i)=><div className="player" key={p.id}><div className="avatar" style={{background:palette[Object.keys(palette)[i%6]]}}>{p.name[0].toUpperCase()}</div><div><b>{p.name}{p.id===me?' (you)':''}</b><span>{p.id===state.hostId?'Host':'Ready'}</span></div>{p.id===state.hostId&&<span className="crown">♛</span>}</div>)}</div><div className="lobby-bottom">{state.players.length<2?<p className="hint">Waiting for at least one more player…</p>:host?<button className="primary" onClick={onStart}>Start game <span>→</span></button>:<p className="hint">The host can start when everyone is ready.</p>}</div>{error&&<div className="error">{error}</div>}<button className="ghost" onClick={onLeave}>Leave room</button></section></main>}
function Game({state,me,error,answer}){const [now,setNow]=useState(Date.now());useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),50);return()=>clearInterval(t)},[]);const left=Math.max(0,(state.endsAt-now)/1000);const mine=state.answered?.includes(me);return <main className="shell game-shell"><div className="gamebar"><div className="logo"><span className="logo-mark">✦</span> COLOR CLASH</div><div className="round">ROUND <b>{state.round}</b> / 10</div></div><div className="scoreboard">{[...state.players].sort((a,b)=>b.score-a.score).map(p=><div className={`score ${p.id===me?'me':''}`} key={p.id}><span>{p.name}</span><b>{p.score}</b></div>)}</div><section className="game-card"><div className="timer"><div className="timer-ring" style={{'--progress':`${left/5*360}deg`}}><b>{left.toFixed(1)}</b><span>SEC</span></div></div><p className="instruction">TAP THE</p><div className="target" style={{color:palette[state.target]}}>{state.target.toUpperCase()}</div><p className="instruction small">FIRST CORRECT ANSWER WINS THE ROUND</p><div className="tiles">{state.options.map((c,i)=><button disabled={mine||state.resolved} key={c+i} className="tile" style={{background:palette[c]}} onClick={()=>answer(c)} aria-label={c}>{mine?'✓':''}</button>)}</div>{mine&&<div className="status">Answer locked in — watching the result…</div>}{state.resolved&&<div className="status">Round complete!</div>}{error&&<div className="error">{error}</div>}</section></main>}
function Finished({state,me,onAgain,onLeave}){const sorted=[...state.players].sort((a,b)=>b.score-a.score);return <main className="shell"><Header/><section className="finish"><div className="eyebrow">GAME OVER</div><div className="trophy">🏆</div><h1>{sorted[0].id===me?'You won!':'Victory!'}</h1><p>{sorted[0].name} takes the crown with <b>{sorted[0].score}</b> points.</p><div className="final-list">{sorted.map((p,i)=><div className="final-row" key={p.id}><span>#{i+1}</span><b>{p.name}{p.id===me?' (you)':''}</b><strong>{p.score}</strong></div>)}</div><div className="finish-actions"><button className="primary" onClick={onAgain}>Play again</button><button className="ghost" onClick={onLeave}>Exit</button></div></section></main>}

createRoot(document.getElementById('root')).render(<App/>);
