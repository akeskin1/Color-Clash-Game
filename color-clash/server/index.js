import express from 'express';
import {createServer} from 'http';
import {Server} from 'socket.io';
import path from 'path';
import {fileURLToPath} from 'url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express();
const http=createServer(app);
const io=new Server(http,{cors:{origin:'*'}});

const rooms=new Map();
const COLORS=['red','blue','green','yellow','purple','orange'];

const publicState=r=>({
  room:r.code,
  hostId:r.hostId,
  status:r.status,
  round:r.round,
  endsAt:r.endsAt,
  target:r.target,
  options:r.options,
  resolved:r.resolved,
  answered:[...r.answered],
  players:[...r.players.values()].map(p=>({
    id:p.id,
    name:p.name,
    score:p.score
  }))
});

const broadcast=r=>io.to(r.code).emit('state',publicState(r));

const code=()=>{
  let c;
  do c=Math.random().toString(36).slice(2,8).toUpperCase();
  while(rooms.has(c));
  return c;
};

function makeRound(r){
  const target=COLORS[Math.floor(Math.random()*COLORS.length)];

  let options=[
    target,
    ...COLORS
      .filter(x=>x!==target)
      .sort(()=>Math.random()-.5)
      .slice(0,5)
  ];

  options.sort(()=>Math.random()-.5);

  r.target=target;
  r.options=options;
  r.answered=new Set();
  r.resolved=false;
  r.round+=1;
  r.endsAt=Date.now()+5000;

  broadcast(r);

  setTimeout(()=>{
    if(
      rooms.has(r.code)&&
      r.status==='playing'&&
      !r.resolved&&
      Date.now()>=r.endsAt
    ){
      r.resolved=true;
      broadcast(r);
      setTimeout(()=>next(r),900);
    }
  },5100);
}

function next(r){
  if(!rooms.has(r.code) || r.status!=='playing')
    return;

  if(r.round>=10){
    r.status='finished';
    r.endsAt=0;
    broadcast(r);
    return;
  }

  makeRound(r);
}

io.on('connection',socket=>{

  socket.on('createRoom',({name})=>{
    const r={
      code:code(),
      hostId:socket.id,
      status:'lobby',
      round:0,
      endsAt:0,
      target:null,
      options:[],
      resolved:false,
      answered:new Set(),
      players:new Map()
    };

    r.players.set(socket.id,{
      id:socket.id,
      name:String(name).slice(0,18),
      score:0
    });

    rooms.set(r.code,r);
    socket.join(r.code);
    socket.data.room=r.code;

    broadcast(r);
  });

  socket.on('joinRoom',({name,room})=>{
    const r=rooms.get(String(room||'').toUpperCase());

    if(!r)
      return socket.emit(
        'errorMessage',
        'Room not found. Check the code.'
      );

    if(r.status!=='lobby')
      return socket.emit(
        'errorMessage',
        'That game has already started.'
      );

    if(r.players.size>=4)
      return socket.emit(
        'errorMessage',
        'That room is full.'
      );

    r.players.set(socket.id,{
      id:socket.id,
      name:String(name).slice(0,18),
      score:0
    });

    socket.join(r.code);
    socket.data.room=r.code;

    broadcast(r);
  });

  socket.on('startGame',()=>{
    const r=rooms.get(socket.data.room);

    if(!r||r.hostId!==socket.id)
      return;

    if(r.players.size<2)
      return socket.emit(
        'errorMessage',
        'You need at least 2 players.'
      );

    r.status='playing';
    r.round=0;
    makeRound(r);
  });

  socket.on('answer',({color})=>{
    const r=rooms.get(socket.data.room);

    if(
      !r||
      r.status!=='playing'||
      r.resolved||
      Date.now()>r.endsAt||
      r.answered.has(socket.id)
    )
      return;

    const p=r.players.get(socket.id);

    if(!p)
      return;

    r.answered.add(socket.id);

    if(color===r.target){
      r.resolved=true;
      p.score+=100;
      broadcast(r);
      setTimeout(()=>next(r),700);
    }else{
      p.score=Math.max(0,p.score-25);
      broadcast(r);
    }
  });

  socket.on('playAgain',()=>{
    const r=rooms.get(socket.data.room);

    if(!r||r.status!=='finished'||r.hostId!==socket.id)
      return;

    // A new game requires at least two players.
    if(r.players.size<2)
      return socket.emit(
        'errorMessage',
        'You need at least 2 players to play again.'
      );

    for(const p of r.players.values())
      p.score=0;

    r.status='playing';
    r.round=0;

    makeRound(r);
  });

  socket.on('disconnect',()=>{
    const r=rooms.get(socket.data.room);

    if(!r)
      return;

    r.players.delete(socket.id);

    if(r.players.size===0){
      rooms.delete(r.code);
      return;
    }

    if(r.hostId===socket.id)
      r.hostId=r.players.keys().next().value;

    if(r.status==='playing'&&r.players.size<2){
      r.status='lobby';
      r.round=0;
    }

    broadcast(r);
  });

});

app.get('/health',(req,res)=>
  res.json({
    ok:true,
    rooms:rooms.size
  })
);

const client=path.resolve(__dirname,'../client/dist');

app.use(express.static(client));

app.get('*',(req,res)=>
  res.sendFile(path.join(client,'index.html'))
);

const PORT=process.env.PORT||3000;

http.listen(PORT,()=>
  console.log(`Color Clash listening on ${PORT}`)
);
